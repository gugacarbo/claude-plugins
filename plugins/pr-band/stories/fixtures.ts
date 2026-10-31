import type { Pr } from "../types";
import type { ChangedImage, WorktreeFile } from "../hooks/views";

export const pr: Pr = {
	number: 42,
	title: "feat(pr-band): lista arquivos do PR e mudanças da worktree",
	url: "https://github.com/gugacarbo/claude-plugins/pull/42",
	state: "OPEN",
	isDraft: false,
	author: "gugacarbo",
	branch: "feat/pr-band-files",
	headSha: "abc123",
	baseSha: "def456",
	additions: 120,
	deletions: 34,
	changedFiles: 4,
	files: [
		{ path: "plugins/pr-band/hooks/register.tsx", additions: 80, deletions: 30 },
		{ path: "plugins/pr-band/types/index.d.ts", additions: 10, deletions: 2 },
		{ path: "AGENTS.md", additions: 30, deletions: 2 },
	],
	review: "review pendente",
	checks: "passando",
	body: "## Resumo\n\n- Lista os arquivos do PR no painel.\n- Adiciona o painel de alterações da worktree.",
	source: "branch atual",
};

export const prs: Pr[] = [
	pr,
	{ ...pr, number: 41, title: "fix: corrige leitura do statusCheckRollup", state: "MERGED", checks: "falhando", review: "aprovado", source: "citado no chat" },
	{ ...pr, number: 43, title: "chore: atualiza dependências do marketplace e ajusta o lockfile", state: "DRAFT", source: "PR created nesta sessão" },
];

export const worktree: WorktreeFile[] = [
	{ path: "plugins/pr-band/hooks/views.tsx", status: "??", additions: 0, deletions: 0 },
	{ path: "plugins/pr-band/hooks/register.tsx", status: "M", additions: 22, deletions: 110 },
	{ path: ".storybook/main.ts", status: "M", additions: 1, deletions: 0 },
];

const dot = (color: string) =>
	`data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="${color}"/></svg>`)}`;

export const images: ChangedImage[] = [
	{ path: "assets/logo.svg", status: "modified", before: { uri: dot("#d97757") }, after: { uri: dot("#16a34a") } },
	{ path: "docs/screenshot.png", status: "added", after: { uri: dot("#58a6ff") } },
	{ path: "docs/old.png", status: "deleted", before: { missing: "grande demais para o painel (instale o ffmpeg para reduzir)" } },
];
