/**
 * Copies the shared UI package (`packages/ui/src`) into a plugin's
 * `hooks/ui-shared/` directory, so hook modules can import it by relative
 * path (the Claude Code runtime only allows relative file imports plus the
 * `claude-code` module).
 *
 * The copy is idempotent: files are only rewritten when content changes.
 */

import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_SRC = join(HERE, "../packages/ui/src");

const PLUGIN_HOOKS = join(HERE, "../plugins");

// Files not needed by hook modules at runtime (only the Storybook consumes them).
const EXCLUDE = new Set(["storybook.tsx"]);

/** Find every `hooks/` directory under `plugins/<name>/`. */
async function* findHookDirs(dir: string): AsyncGenerator<string> {
	for (const entry of await readdir(dir)) {
		const full = join(dir, entry);
		if ((await stat(full)).isDirectory()) {
			if (entry === "hooks") yield full;
			else yield* findHookDirs(full);
		}
	}
}

async function fileNeedsUpdate(src: string, dst: string): Promise<boolean> {
	try {
		const [srcContent, dstContent] = await Promise.all([
			Bun.file(src).text(),
			Bun.file(dst).text(),
		]);
		return srcContent !== dstContent;
	} catch {
		return true; // dst doesn't exist or unreadable
	}
}

async function copyDir(src: string, dst: string): Promise<number> {
	await mkdir(dst, { recursive: true });
	let copied = 0;
	for (const entry of await readdir(src)) {
		const srcPath = join(src, entry);
		const dstPath = join(dst, entry);
		const info = await stat(srcPath);
		if (info.isDirectory()) {
			copied += await copyDir(srcPath, dstPath);
		} else if (info.isFile() && !EXCLUDE.has(entry)) {
			if (await fileNeedsUpdate(srcPath, dstPath)) {
				await cp(srcPath, dstPath, { force: true });
				copied++;
			}
		}
	}
	return copied;
}

/** Sync `packages/ui/src` into every plugin's `hooks/ui-shared/`. */
export async function syncUiToPlugins(): Promise<{
	plugins: string[];
	files: number;
}> {
	const plugins: string[] = [];
	let totalFiles = 0;

	for await (const hooksDir of findHookDirs(PLUGIN_HOOKS)) {
		const dest = join(hooksDir, "ui-shared");
		const copied = await copyDir(UI_SRC, dest);
		if (copied > 0) {
			const name = hooksDir.split("/").at(-2);
			if (name) plugins.push(name);
			totalFiles += copied;
		}
	}

	return { plugins, files: totalFiles };
}

/** Remove synced copies (for cleanup or testing). */
export async function removeUiFromPlugins(): Promise<void> {
	for await (const hooksDir of findHookDirs(PLUGIN_HOOKS)) {
		await rm(join(hooksDir, "ui-shared"), { recursive: true, force: true });
	}
}
