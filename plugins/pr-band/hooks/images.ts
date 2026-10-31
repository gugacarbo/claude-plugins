import type { EngineInterface } from "claude-code";

import type { Pr } from "../types";
import {
	type ChangedImage,
	isImage,
	type Picture,
	type WorktreeFile,
} from "./views";

// The Svg element takes at most 131072 characters; the data URI must fit with its wrapper.
const MAX_URI = 120_000;
const MAX_IMAGES = 12;
const MIME: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	bmp: "image/bmp",
	ico: "image/x-icon",
	avif: "image/avif",
};

// Writes the file to a temp file with the producer ($1 is the path), shrinks it
// with ffmpeg when it is too big and ffmpeg is there, then prints
// "<converted 0|1>" and the base64 on the next line. Exit 3: no such file.
const PICTURE_SCRIPT = `f=$(mktemp) || exit 1
trap 'rm -f "$f" "$f.webp"' EXIT
produce "$@" > "$f" 2>/dev/null || exit 3
[ -s "$f" ] || exit 3
c=0
case "$1" in *.svg|*.SVG) ;; *)
  if [ "$(wc -c < "$f")" -gt 88000 ] && command -v ffmpeg >/dev/null 2>&1 &&
    ffmpeg -v error -y -i "$f" -vf "scale='min(480,iw)':-2" -frames:v 1 -c:v libwebp -quality 70 "$f.webp" 2>/dev/null; then
    mv "$f.webp" "$f"; c=1
  fi;;
esac
echo "$c"
base64 -w0 "$f"`;

const PRODUCERS = {
	file: 'produce() { cat -- "$1"; }',
	head: 'produce() { git show "HEAD:$1"; }',
	github:
		'produce() { gh api -H "Accept: application/vnd.github.raw" "repos/$2/contents/$3?ref=$4"; }',
} as const;

async function loadPicture(
	$: EngineInterface,
	producer: keyof typeof PRODUCERS,
	args: string[],
	cwd?: string,
): Promise<Picture | undefined> {
	const r = await $.process.run(
		["sh", "-c", `${PRODUCERS[producer]}\n${PICTURE_SCRIPT}`, "sh", ...args],
		{ timeoutMs: 30000, cwd },
	);
	if (r.exitCode === 3) return undefined;
	if (r.exitCode !== 0) return { missing: "não foi possível ler a imagem" };
	const [flag, data = ""] = r.stdout.split("\n");
	const ext = (args[0]?.split(".").pop() ?? "").toLowerCase();
	const mime = flag === "1" ? "image/webp" : (MIME[ext] ?? "image/png");
	const uri = `data:${mime};base64,${data.trim()}`;
	if (uri.length > MAX_URI)
		return {
			missing: "grande demais para o painel (instale o ffmpeg para reduzir)",
		};
	return { uri };
}

// Pictures already read, by a key that changes when the bytes do.
const pictureCache = new Map<string, Promise<Picture | undefined>>();

function cached(
	key: string,
	load: () => Promise<Picture | undefined>,
): Promise<Picture | undefined> {
	let p = pictureCache.get(key);
	if (!p) {
		p = load().catch(() => ({ missing: "não foi possível ler a imagem" }));
		pictureCache.set(key, p);
		if (pictureCache.size > 200) {
			const first = pictureCache.keys().next().value;
			if (first !== undefined) pictureCache.delete(first);
		}
	}
	return p;
}

function statusOf(before: Picture | undefined, after: Picture | undefined) {
	if (!before) return "added" as const;
	if (!after) return "deleted" as const;
	return "modified" as const;
}

// Changed images of the worktree: HEAD's version beside the file on disk.
export async function worktreeImages(
	$: EngineInterface,
	files: WorktreeFile[],
): Promise<ChangedImage[]> {
	const list = files.filter((f) => isImage(f.path)).slice(0, MAX_IMAGES);
	if (list.length === 0) return [];
	const top = (
		await $.process.run(["git", "rev-parse", "--show-toplevel"], {
			timeoutMs: 15000,
		})
	).stdout.trim();
	const head = (
		await $.process.run(["git", "rev-parse", "HEAD"], { timeoutMs: 15000 })
	).stdout.trim();
	// Modification times key the cache of the files on disk.
	const stat = await $.process.run(
		["stat", "-c", "%Y %s %n", "--", ...list.map((f) => f.path)],
		{ timeoutMs: 15000, cwd: top },
	);
	const stamps = new Map<string, string>();
	for (const line of stat.stdout.split("\n")) {
		const m = /^(\d+ \d+) (.*)$/.exec(line);
		if (m?.[1] && m[2]) stamps.set(m[2], m[1]);
	}
	return Promise.all(
		list.map(async (f) => {
			const st = f.status.trim();
			const isNew = st === "??" || st.startsWith("A");
			const isGone = st.startsWith("D");
			const before = isNew
				? undefined
				: await cached(`head:${head}:${top}/${f.path}`, () =>
						loadPicture($, "head", [f.path], top),
					);
			const after = isGone
				? undefined
				: await cached(
						`file:${top}/${f.path}:${stamps.get(f.path) ?? ""}`,
						() => loadPicture($, "file", [f.path], top),
					);
			return { path: f.path, status: statusOf(before, after), before, after };
		}),
	);
}

// Changed images of a PR: the base branch's version beside the head's.
export async function prImages(
	$: EngineInterface,
	pr: Pr,
): Promise<ChangedImage[]> {
	const repo = /github\.com\/([\w.-]+\/[\w.-]+)\/pull\//.exec(pr.url)?.[1];
	if (!repo || !pr.headSha) return [];
	const list = pr.files.filter((f) => isImage(f.path)).slice(0, MAX_IMAGES);
	return Promise.all(
		list.map(async (f) => {
			const encoded = f.path.split("/").map(encodeURIComponent).join("/");
			const at = (sha: string) =>
				sha
					? cached(`gh:${repo}@${sha}:${f.path}`, () =>
							loadPicture($, "github", [f.path, repo, encoded, sha]),
						)
					: Promise.resolve(undefined);
			const [before, after] = await Promise.all([
				at(pr.baseSha),
				at(pr.headSha),
			]);
			return { path: f.path, status: statusOf(before, after), before, after };
		}),
	);
}
