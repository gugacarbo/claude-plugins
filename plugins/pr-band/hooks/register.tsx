import type { EngineInterface, Register } from "claude-code";
import { atom, read, update } from "claude-code";

import type { Pr } from "../types";

const PANE = "pr-band";
const prs = atom({ plugin: "pr-band", key: "prs" } as const, [], {
	shape: "prs-1",
});
const selected = atom({ plugin: "pr-band", key: "selected" } as const, null);

const FIELDS =
	"number,title,url,state,isDraft,author,headRefName,additions,deletions,changedFiles,reviewDecision,statusCheckRollup,body";
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
		const { Box, Button, Text } = $.ui.resolve(e);

		const openPr = async (n: number) => {
			await update($, selected, () => n);
			await $.ui.open({ id: PANE, title: `PR #${n}` });
		};

		if (list.length === 0) {
			return (
				<Box>
					<Text dimColor>Nenhum PR relacionado a esta conversa</Text>
				</Box>
			);
		}
		return (
			<Box flexDirection="row" gap={1}>
				<Text dimColor>
					{list.length === 1
						? "1 PR relacionado:"
						: `${list.length} PRs relacionados:`}
				</Text>
				{list.slice(0, 5).map((pr) => (
					<Button
						key={`pr-${pr.number}`}
						label={`#${pr.number} ${pr.title.slice(0, 40)} · ${pr.state.toLowerCase()}`}
						onPress={() => openPr(pr.number)}
					/>
				))}
			</Box>
		);
	});

	on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
		const { Box, Text, Link, Markdown, Button } = $.ui.resolve(e);
		const n = await read($, selected);
		const pr = (await read($, prs)).find((p) => p.number === n);
		if (!pr) return <Text dimColor>Nenhum PR selecionado.</Text>;

		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>
					#{pr.number} {pr.title}
				</Text>
				<Link href={pr.url} label="Abrir no GitHub" />
				<Text>
					{pr.state.toLowerCase()} · {pr.author} · {pr.branch}
				</Text>
				<Text>
					+{pr.additions} / −{pr.deletions} em {pr.changedFiles} arquivos
				</Text>
				<Text>
					Review: {pr.review} · CI: {pr.checks}
				</Text>
				<Text dimColor>Relação: {pr.source}</Text>
				<Markdown text={pr.body || "_Sem descrição._"} />
				<Button
					key="refresh"
					label="Atualizar"
					onPress={() => fetchPr($, String(pr.number), pr.source)}
				/>
			</Box>
		);
	});
};
