import type { EngineInterface, Register } from "claude-code";
import { atom, read, update } from "claude-code";

import type { Pr } from "../types";
import {
	bandView,
	type GitHead,
	prPaneView,
	type WorktreeFile,
	worktreePaneView,
} from "./views";

const PANE = "pr-band";
const WORKTREE_PANE = "pr-band-worktree";
const prs = atom({ plugin: "pr-band", key: "prs" } as const, [], {
	shape: "prs-2",
});
const selected = atom({ plugin: "pr-band", key: "selected" } as const, null);

const FIELDS =
	"number,title,url,state,isDraft,author,headRefName,additions,deletions,changedFiles,reviewDecision,statusCheckRollup,body,files";
// Links like github.com/owner/repo/pull/12 in prompts or tool output.
const PR_URL = /github\.com\/[\w.-]+\/[\w.-]+\/pull\/(\d+)/g;

function checksOf(
	rollup: { conclusion?: string; state?: string }[] = [],
): string {
	if (rollup.length === 0) return "sem checks";
	const states = rollup.map((c) =>
		(c.conclusion || c.state || "").toUpperCase(),
	);
	if (states.some((s) => s === "FAILURE" || s === "ERROR")) return "falhando";
	if (states.some((s) => s === "" || s === "PENDING" || s === "IN_PROGRESS"))
		return "rodando";
	return "passando";
}

const REVIEW: Record<string, string> = {
	APPROVED: "aprovado",
	CHANGES_REQUESTED: "mudanças pedidas",
	REVIEW_REQUIRED: "review pendente",
};

async function fetchPr(
	$: EngineInterface,
	ref: string,
	source: string,
): Promise<void> {
	const { exitCode, stdout } = await $.process.run(
		["gh", "pr", "view", ...(ref ? [ref] : []), "--json", FIELDS],
		{
			timeoutMs: 15000,
		},
	);
	if (exitCode !== 0) return;
	const raw = JSON.parse(stdout);
	const pr: Pr = {
		number: raw.number,
		title: raw.title,
		url: raw.url,
		state: raw.isDraft ? "DRAFT" : raw.state,
		isDraft: raw.isDraft,
		author: raw.author?.login ?? "",
		branch: raw.headRefName,
		additions: raw.additions,
		deletions: raw.deletions,
		changedFiles: raw.changedFiles,
		files: (raw.files ?? []).map(
			(f: { path: string; additions: number; deletions: number }) => ({
				path: f.path,
				additions: f.additions,
				deletions: f.deletions,
			}),
		),
		review: REVIEW[raw.reviewDecision] ?? "sem review",
		checks: checksOf(raw.statusCheckRollup),
		body: (raw.body || "").slice(0, 4000),
		source,
	};
	await update($, prs, (list) => {
		const old = list.find((p) => p.number === pr.number);
		const merged = { ...pr, source: old?.source ?? source };
		return old
			? list.map((p) => (p.number === pr.number ? merged : p))
			: [...list, merged];
	});
}

// Changes of the current worktree against HEAD, untracked files included.
async function worktreeChanges($: EngineInterface): Promise<WorktreeFile[]> {
	const status = await $.process.run(["git", "status", "--porcelain=v1"], {
		timeoutMs: 15000,
	});
	if (status.exitCode !== 0) return [];
	const numstat = await $.process.run(["git", "diff", "--numstat", "HEAD"], {
		timeoutMs: 15000,
	});
	const counts = new Map<string, [number, number]>();
	for (const line of numstat.stdout.split("\n")) {
		const [add, del, path] = line.split("\t");
		if (path) counts.set(path, [Number(add) || 0, Number(del) || 0]);
	}
	return status.stdout
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const path = line.slice(3).replace(/^.* -> /, "");
			const [additions, deletions] = counts.get(path) ?? [0, 0];
			return { path, status: line.slice(0, 2).trim(), additions, deletions };
		});
}

async function gitHead($: EngineInterface): Promise<GitHead> {
	const r = await $.process.run(
		[
			"git",
			"rev-parse",
			"--abbrev-ref",
			"HEAD",
			"--path-format=absolute",
			"--git-dir",
			"--git-common-dir",
		],
		{ timeoutMs: 15000 },
	);
	const [branch = "", gitDir, commonDir] = r.stdout.trim().split("\n");
	return { branch, isWorktree: gitDir !== commonDir };
}

async function refreshAll($: EngineInterface): Promise<void> {
	// The PR of the current branch, then refresh what is already listed.
	await fetchPr($, "", "branch atual").catch(() => {});
	for (const pr of await read($, prs)) {
		await fetchPr($, String(pr.number), pr.source).catch(() => {});
	}
}

async function collectUrls(
	$: EngineInterface,
	text: string,
	source: string,
): Promise<void> {
	for (const m of text.matchAll(PR_URL)) {
		const known = (await read($, prs)).some((p) =>
			p.url.endsWith(`/pull/${m[1]}`),
		);
		if (!known)
			await fetchPr(
				$,
				m[0].startsWith("http") ? m[0] : `https://${m[0]}`,
				source,
			).catch(() => {});
	}
}

// The fields of a tool result this mod reads (Bash carries all of them).
type BashOutput = {
	stdout?: string;
	gitOperation?: {
		pr?: { number: number; action: string };
		push?: unknown;
		branch?: unknown;
	};
};

export const register: Register = (on) => {
	on("session.start", async ($, e, next) => {
		const ran = await next(e);
		void refreshAll($);
		return ran;
	});

	on("prompt.submit", async ($, e, next) => {
		void collectUrls($, e.text ?? "", "citado no chat");
		return next(e);
	});

	on("tool.call", async ($, e, next) => {
		const ran = await next(e);
		const result = ran.result as unknown as BashOutput | undefined;
		const op = result?.gitOperation?.pr;
		if (op)
			void fetchPr($, String(op.number), `PR ${op.action} nesta sessão`).catch(
				() => {},
			);
		if (e.tool === "Bash" && typeof result?.stdout === "string") {
			void collectUrls($, result.stdout, "citado no chat");
			if (result.gitOperation?.push || result.gitOperation?.branch)
				void fetchPr($, "", "branch atual").catch(() => {});
		}
		return ran;
	});

	on("turn.complete", async ($, e, next) => {
		const ran = await next(e);
		void refreshAll($);
		return ran;
	});

	on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
		if (e.props.hasSurvey) return next(e);
		const list = await read($, prs);

		const openPr = async (n: number) => {
			await update($, selected, () => n);
			await $.ui.open({ id: PANE, title: `PR #${n}` });
		};

		const worktree = await worktreeChanges($);
		const head =
			worktree.length > 0
				? await gitHead($)
				: { branch: "", isWorktree: false };
		const view = bandView($.ui.resolve(e), {
			prs: list,
			onOpenPr: (n) => void openPr(n),
			head,
			worktree,
			onOpenWorktree: () =>
				void $.ui.open({ id: WORKTREE_PANE, title: "Alterações da worktree" }),
		});
		return view ?? next(e);
	});

	on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
		const n = await read($, selected);
		const pr = (await read($, prs)).find((p) => p.number === n);
		return prPaneView($.ui.resolve(e), {
			pr,
			onRefresh: () => {
				if (pr) void fetchPr($, String(pr.number), pr.source);
			},
		});
	});

	on(
		"ui.render",
		{ component: "Pane", requestId: WORKTREE_PANE },
		async ($, e) => {
			return worktreePaneView($.ui.resolve(e), await worktreeChanges($));
		},
	);
};
