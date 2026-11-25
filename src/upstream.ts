/**
 * Pure logic for plugins imported from other repositories ("upstreams").
 *
 * Each imported plugin is a plain copy under `plugins/<name>/` plus an entry in
 * `upstreams.json` that records where it came from and the upstream commit the
 * copy is based on (`base`). Pulling an update applies the upstream diff
 * `base..new` on top of the local copy with a 3-way merge, so local edits are
 * kept. The git side lives in `upstream-git.ts`.
 */

export type Upstream = {
	/** Clone URL of the upstream repository. */
	repo: string;
	/** Branch or tag followed. */
	ref: string;
	/** Folder of the plugin inside the upstream repository ("." for the root). */
	path: string;
	/** Upstream commit the local copy was last synced with. */
	base: string;
};

export type Upstreams = Record<string, Upstream>;

export type MarketplaceEntry = {
	name: string;
	source: string;
	description?: string;
};

export type UpstreamCommand =
	| {
			command: "import";
			repo: string;
			ref: string;
			path: string;
			name: string;
	  }
	| { command: "status" }
	| { command: "pull"; names: string[] };

const NAME = /^[a-z0-9][a-z0-9-]*$/;

/** Normalizes a folder inside the upstream repository: no leading `./`, no trailing `/`. */
export function normalizePath(path: string): string {
	const clean = path
		.trim()
		.replace(/^(\.\/)+/, "")
		.replace(/\/+$/, "");
	return clean === "" || clean === "." ? "." : clean;
}

/** Plugin name from the upstream folder, or from the repository name when it is the root. */
export function defaultName(repo: string, path: string): string {
	const source = path === "." ? repo : path;
	const last = source.replace(/\/+$/, "").split(/[/:]/).pop() ?? "";
	return last.replace(/\.git$/, "").toLowerCase();
}

function option(argv: string[], flag: string): string | undefined {
	const i = argv.indexOf(flag);
	if (i === -1) return undefined;
	const value = argv[i + 1];
	if (value === undefined || value.startsWith("--")) {
		throw new Error(`${flag} precisa de um valor`);
	}
	return value;
}

function positionals(argv: string[]): string[] {
	const out: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i] as string;
		if (arg.startsWith("--")) i++;
		else out.push(arg);
	}
	return out;
}

/**
 * Parses `import <repo> [--ref r] [--path p] [--name n]`,
 * `upstream status` and `upstream pull [names...]`.
 */
export function parseUpstreamArgs(argv: string[]): UpstreamCommand {
	const [head, ...rest] = argv;
	if (head === "import") {
		const [repo] = positionals(rest);
		if (!repo) {
			throw new Error(
				"Uso: import <repo> [--ref main] [--path pasta] [--name nome]",
			);
		}
		const path = normalizePath(option(rest, "--path") ?? ".");
		const name = option(rest, "--name") ?? defaultName(repo, path);
		if (!NAME.test(name)) {
			throw new Error(
				`Nome inválido: "${name}" (use minúsculas, números e hífens; ou passe --name)`,
			);
		}
		return {
			command: "import",
			repo,
			ref: option(rest, "--ref") ?? "main",
			path,
			name,
		};
	}
	if (head === "upstream") {
		const [sub, ...names] = positionals(rest);
		if (sub === "status") return { command: "status" };
		if (sub === "pull") return { command: "pull", names };
		throw new Error("Uso: upstream status | upstream pull [nomes...]");
	}
	throw new Error(`Comando desconhecido: ${head}`);
}

/** Which plugins a pull touches; fails on names that are not imported. */
export function selectUpstreams(
	upstreams: Upstreams,
	names: string[],
): string[] {
	if (names.length === 0) return Object.keys(upstreams).sort();
	const unknown = names.filter((n) => !(n in upstreams));
	if (unknown.length > 0) {
		throw new Error(
			`Sem upstream registrado: ${unknown.join(", ")} (veja upstreams.json)`,
		);
	}
	return names;
}

/** Tree-ish of the plugin folder at a commit, for `git archive`. */
export function treeish(commit: string, path: string): string {
	return path === "." ? commit : `${commit}:${path}`;
}

/** `git diff` arguments for the upstream changes of the plugin folder, relative to it. */
export function diffArgs(base: string, next: string, path: string): string[] {
	const args = ["diff", "--binary", "--full-index", "--no-color"];
	if (path === ".") return [...args, base, next];
	return [...args, `--relative=${path}`, base, next, "--", path];
}

/** `git apply` arguments that merge that diff into `plugins/<name>`. */
export function applyArgs(name: string): string[] {
	return [
		"apply",
		"--3way",
		"--whitespace=nowarn",
		`--directory=plugins/${name}`,
	];
}

type Semver = [number, number, number];

function parseSemver(version: string): Semver | undefined {
	const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
	return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
}

function compare(a: Semver, b: Semver): number {
	return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * Version for the local copy after a pull: one patch above the higher of the
 * local and upstream versions, so `claude plugin update` always sees a change
 * and the copy never goes behind upstream. Undefined when neither is semver.
 */
export function nextVersion(
	local: string | undefined,
	upstream: string | undefined,
): string | undefined {
	const a = local ? parseSemver(local) : undefined;
	const b = upstream ? parseSemver(upstream) : undefined;
	const top = a && b ? (compare(a, b) >= 0 ? a : b) : (a ?? b);
	if (!top) return undefined;
	return `${top[0]}.${top[1]}.${top[2] + 1}`;
}

/** Replaces the top-level `"version"` of a plugin.json text, keeping its formatting. */
export function setVersion(json: string, version: string): string {
	const re = /^(\s*"version"\s*:\s*)"[^"]*"/m;
	if (re.test(json)) return json.replace(re, `$1"${version}"`);
	return json.replace(/\{/, `{\n  "version": "${version}",`);
}

/** Adds (or keeps) a plugin entry in the marketplace list, sorted by name. */
export function addToMarketplace(
	plugins: MarketplaceEntry[],
	entry: MarketplaceEntry,
): MarketplaceEntry[] {
	if (plugins.some((p) => p.name === entry.name)) return plugins;
	return [...plugins, entry].sort((a, b) => a.name.localeCompare(b.name));
}

/** `upstreams.json` text with stable key order. */
export function formatUpstreams(upstreams: Upstreams): string {
	const sorted: Upstreams = {};
	for (const key of Object.keys(upstreams).sort()) {
		sorted[key] = upstreams[key] as Upstream;
	}
	return `${JSON.stringify(sorted, null, 2)}\n`;
}
