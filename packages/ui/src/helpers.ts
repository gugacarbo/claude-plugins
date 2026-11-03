import type { WorktreeFile } from "./types";

export const IMAGE_EXT = /\\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i;

export function isImage(path: string) {
	return IMAGE_EXT.test(path);
}

export function truncate(text: string, max: number) {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Statuses come from `git status --porcelain`: "A"/"??" added, "D" deleted.
export function worktreeSummary(files: WorktreeFile[]) {
	const s = {
		files: files.length,
		modified: 0,
		added: 0,
		deleted: 0,
		additions: 0,
		deletions: 0,
	};
	for (const f of files) {
		const st = f.status.trim();
		if (st.startsWith("A") || st === "??") s.added++;
		else if (st.startsWith("D")) s.deleted++;
		else s.modified++;
		s.additions += f.additions;
		s.deletions += f.deletions;
	}
	return s;
}
