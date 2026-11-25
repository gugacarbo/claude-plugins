/**
 * Git side of the upstream commands: import a plugin from another repository,
 * check for updates and merge them into the local copy. Nothing is committed:
 * the result stays in the working tree for review (the weekly workflow opens a
 * PR with it).
 */

import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
	addToMarketplace,
	applyArgs,
	diffArgs,
	formatUpstreams,
	type MarketplaceEntry,
	nextVersion,
	parseUpstreamArgs,
	selectUpstreams,
	setVersion,
	treeish,
	type Upstream,
	type Upstreams,
} from "./upstream";

type Result = { code: number; stdout: string; stderr: string };

async function run(
	cwd: string,
	cmd: string[],
	input?: Uint8Array,
): Promise<Result> {
	const proc = Bun.spawn(cmd, {
		cwd,
		stdin: input ?? "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { code, stdout, stderr };
}

async function git(root: string, args: string[]): Promise<string> {
	const r = await run(root, ["git", ...args]);
	if (r.code !== 0) {
		throw new Error(
			`git ${args[0]} falhou: ${r.stderr.trim() || r.stdout.trim()}`,
		);
	}
	return r.stdout;
}

/** Fetches `ref` from `repo` without adding a remote; returns the commit. */
async function fetchRef(
	root: string,
	repo: string,
	ref: string,
): Promise<string> {
	await git(root, ["fetch", "--quiet", "--no-tags", repo, ref]);
	return (await git(root, ["rev-parse", "FETCH_HEAD^{commit}"])).trim();
}

/** Makes sure `commit` is in the local object store (it may be gone after a force push upstream). */
async function ensureCommit(
	root: string,
	repo: string,
	commit: string,
): Promise<void> {
	const has = await run(root, ["git", "cat-file", "-e", `${commit}^{commit}`]);
	if (has.code === 0) return;
	await git(root, ["fetch", "--quiet", "--no-tags", repo, commit]);
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
	return existsSync(path) ? ((await Bun.file(path).json()) as T) : fallback;
}

async function upstreamVersion(
	root: string,
	commit: string,
	path: string,
): Promise<string | undefined> {
	const file = `${path === "." ? "" : `${path}/`}.claude-plugin/plugin.json`;
	const r = await run(root, ["git", "show", `${commit}:${file}`]);
	if (r.code !== 0) return undefined;
	try {
		return (JSON.parse(r.stdout) as { version?: string }).version;
	} catch {
		return undefined;
	}
}

const out = (line: string) => process.stdout.write(`${line}\n`);
const short = (sha: string) => sha.slice(0, 7);

async function importPlugin(
	root: string,
	repo: string,
	ref: string,
	path: string,
	name: string,
): Promise<void> {
	const upstreamsFile = join(root, "upstreams.json");
	const upstreams = await readJson<Upstreams>(upstreamsFile, {});
	const dest = join(root, "plugins", name);
	if (upstreams[name] || existsSync(dest)) {
		throw new Error(`plugins/${name} já existe; escolha outro nome com --name`);
	}

	out(`Buscando ${repo} (${ref})…`);
	const commit = await fetchRef(root, repo, ref);
	const tree = await run(root, [
		"git",
		"cat-file",
		"-t",
		treeish(commit, path),
	]);
	if (tree.code !== 0 || !["tree", "commit"].includes(tree.stdout.trim())) {
		throw new Error(`A pasta "${path}" não existe em ${repo}@${ref}`);
	}

	await mkdir(dest, { recursive: true });
	const archive = Bun.spawn(
		["git", "archive", "--format=tar", treeish(commit, path)],
		{ cwd: root, stdout: "pipe" },
	);
	const tar = Bun.spawn(["tar", "-x", "-C", dest], {
		stdin: archive.stdout,
		stderr: "pipe",
	});
	if ((await archive.exited) !== 0 || (await tar.exited) !== 0) {
		await rm(dest, { recursive: true, force: true });
		throw new Error("Não consegui extrair os arquivos do plugin");
	}

	const manifest = join(dest, ".claude-plugin/plugin.json");
	if (!existsSync(manifest)) {
		await rm(dest, { recursive: true, force: true });
		throw new Error(
			`"${path}" não é um plugin (falta .claude-plugin/plugin.json); use --path`,
		);
	}

	upstreams[name] = { repo, ref, path, base: commit };
	await Bun.write(upstreamsFile, formatUpstreams(upstreams));

	const marketFile = join(root, ".claude-plugin/marketplace.json");
	const market = await readJson<{ plugins: MarketplaceEntry[] }>(marketFile, {
		plugins: [],
	});
	const { description } = (await Bun.file(manifest).json()) as {
		description?: string;
	};
	market.plugins = addToMarketplace(market.plugins, {
		name,
		source: `./plugins/${name}`,
		...(description ? { description } : {}),
	});
	await Bun.write(marketFile, `${JSON.stringify(market, null, 2)}\n`);

	out(`Importei ${name} de ${repo}@${short(commit)} em plugins/${name}.`);
	out(
		"Revise a descrição no marketplace.json, commite e rode bun run plugins:install.",
	);
}

async function status(root: string): Promise<void> {
	const upstreams = await readJson<Upstreams>(join(root, "upstreams.json"), {});
	const names = Object.keys(upstreams).sort();
	if (names.length === 0) {
		out("Nenhum plugin importado (upstreams.json vazio).");
		return;
	}
	for (const name of names) {
		const u = upstreams[name] as Upstream;
		const r = await run(root, ["git", "ls-remote", u.repo, u.ref]);
		const head = r.stdout.split(/\s/)[0];
		if (r.code !== 0 || !head) {
			out(`${name}: não consegui ler ${u.repo} (${u.ref})`);
		} else if (head === u.base) {
			out(`${name}: atualizado (${short(u.base)})`);
		} else {
			out(`${name}: há atualização ${short(u.base)} → ${short(head)}`);
		}
	}
}

type PullOutcome = "current" | "updated" | "conflict";

async function pullOne(
	root: string,
	name: string,
	u: Upstream,
): Promise<{ outcome: PullOutcome; next: string }> {
	const next = await fetchRef(root, u.repo, u.ref);
	if (next === u.base) return { outcome: "current", next };
	await ensureCommit(root, u.repo, u.base);

	const patch = await git(root, diffArgs(u.base, next, u.path));
	if (patch.trim() === "") return { outcome: "updated", next };

	// The local copy bumps "version" on every pull, so that line would conflict
	// whenever upstream bumps it too. Put the base version back while merging,
	// then write the next version on top.
	const manifest = join(root, "plugins", name, ".claude-plugin/plugin.json");
	const localVersion = existsSync(manifest)
		? (JSON.parse(await Bun.file(manifest).text()) as { version?: string })
				.version
		: undefined;
	const baseVersion = await upstreamVersion(root, u.base, u.path);
	if (baseVersion && localVersion && baseVersion !== localVersion) {
		await Bun.write(
			manifest,
			setVersion(await Bun.file(manifest).text(), baseVersion),
		);
		await git(root, ["add", "--", manifest]);
	}

	const applied = await run(
		root,
		["git", ...applyArgs(name)],
		new TextEncoder().encode(patch),
	);
	const conflicted = (
		await git(root, [
			"diff",
			"--name-only",
			"--diff-filter=U",
			"--",
			`plugins/${name}`,
		])
	)
		.split("\n")
		.filter(Boolean);
	if (applied.code !== 0 && conflicted.length === 0) {
		throw new Error(`git apply falhou em ${name}: ${applied.stderr.trim()}`);
	}

	const manifestConflicted = conflicted.some((f) =>
		f.endsWith(".claude-plugin/plugin.json"),
	);
	if (existsSync(manifest) && !manifestConflicted) {
		const text = await Bun.file(manifest).text();
		const version = nextVersion(
			localVersion,
			await upstreamVersion(root, next, u.path),
		);
		if (version) await Bun.write(manifest, setVersion(text, version));
	}

	if (conflicted.length > 0) {
		out(`${name}: conflitos em\n${conflicted.map((f) => `  ${f}`).join("\n")}`);
		return { outcome: "conflict", next };
	}
	return { outcome: "updated", next };
}

async function pull(root: string, names: string[]): Promise<boolean> {
	const upstreamsFile = join(root, "upstreams.json");
	const upstreams = await readJson<Upstreams>(upstreamsFile, {});
	const selected = selectUpstreams(upstreams, names);

	const dirty = (
		await git(root, [
			"status",
			"--porcelain",
			"--",
			...selected.map((n) => `plugins/${n}`),
			"upstreams.json",
		])
	).trim();
	if (dirty) {
		throw new Error(
			`Há mudanças não commitadas nos plugins a atualizar; commite antes:\n${dirty}`,
		);
	}

	let conflicts = false;
	for (const name of selected) {
		const u = upstreams[name] as Upstream;
		const { outcome, next } = await pullOne(root, name, u);
		if (outcome === "current") {
			out(`${name}: já atualizado (${short(u.base)})`);
			continue;
		}
		upstreams[name] = { ...u, base: next };
		await Bun.write(upstreamsFile, formatUpstreams(upstreams));
		if (outcome === "conflict") conflicts = true;
		else out(`${name}: atualizado ${short(u.base)} → ${short(next)}`);
	}

	if (conflicts) {
		out(
			"\nResolva os marcadores de conflito, rode `git add` nos arquivos e commite.",
		);
	}
	return !conflicts;
}

/** Runs `import …` or `upstream status|pull …`; exits 2 when a pull left conflicts. */
export async function runUpstream(root: string, argv: string[]): Promise<void> {
	const cmd = parseUpstreamArgs(argv);
	if (cmd.command === "import") {
		await importPlugin(root, cmd.repo, cmd.ref, cmd.path, cmd.name);
	} else if (cmd.command === "status") {
		await status(root);
	} else if (!(await pull(root, cmd.names))) {
		process.exitCode = 2;
	}
}
