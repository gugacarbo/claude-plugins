import type { EngineInterface } from "claude-code";

import type { Pr } from "../types";

// The element table each view draws with: `$.ui.resolve(e)` in the mod, a DOM
// table in Storybook.
export type Ui = Pick<
	ReturnType<EngineInterface["ui"]["resolve"]>,
	"Box" | "Text" | "Button" | "Link" | "Markdown"
>;

// Where the session is: the branch name, and whether the checkout is a linked
// worktree (`git worktree add`) rather than the main one.
export type GitHead = { branch: string; isWorktree: boolean };

export type WorktreeFile = {
	path: string;
	status: string;
	additions: number;
	deletions: number;
};

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

function truncate(text: string, max: number) {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// The status dot's color: open, draft, merged or closed.
function prColor(pr: Pr): string {
	if (pr.isDraft || pr.state === "DRAFT") return "gray";
	if (pr.state === "MERGED") return "magenta";
	if (pr.state === "CLOSED") return "red";
	return "green";
}

export function bandView(
	{ Box, Button, Text }: Ui,
	props: {
		prs: Pr[];
		onOpenPr: (n: number) => void;
		head: GitHead;
		worktree: WorktreeFile[];
		onOpenWorktree: () => void;
	},
) {
	const { prs, onOpenPr, head, worktree, onOpenWorktree } = props;
	if (prs.length === 0 && worktree.length === 0) return null;
	const s = worktreeSummary(worktree);
	const shown = prs.slice(0, 5);

	// Right-hand columns share one width across rows so the counts line up.
	const rows = [
		...shown.map((pr) => [pr.additions, pr.deletions]),
		...(worktree.length > 0 ? [[s.additions, s.deletions]] : []),
	];
	const addW = Math.max(...rows.map(([a = 0]) => `+${a}`.length));
	const delW = Math.max(...rows.map(([, d = 0]) => `−${d}`.length));

	const counts = (additions: number, deletions: number) => (
		<Box flexDirection="row" gap={1}>
			<Text color="green">{`+${additions}`.padStart(addW)}</Text>
			<Text color="red">{`−${deletions}`.padStart(delW)}</Text>
		</Box>
	);

	return (
		<Box flexDirection="column" gap={1}>
			{shown.length > 0 && (
				<Box flexDirection="column">
					{shown.map((pr) => (
						<Box
							key={`row-${pr.number}`}
							flexDirection="row"
							justifyContent="space-between"
							gap={2}
						>
							<Button
								key={`pr-${pr.number}`}
								plain
								onPress={() => onOpenPr(pr.number)}
							>
								<Text color={prColor(pr)}>●</Text>{" "}
								<Text bold>#{pr.number}</Text> {truncate(pr.title, 44)}
							</Button>
							{counts(pr.additions, pr.deletions)}
						</Box>
					))}
				</Box>
			)}
			{worktree.length > 0 && (
				<Box flexDirection="row" justifyContent="space-between" gap={2}>
					<Button key="worktree" plain onPress={onOpenWorktree}>
						<Text color="cyan">{head.isWorktree ? "⎇" : "⧉"}</Text>{" "}
						<Text bold color="cyan">
							{head.branch}
						</Text>{" "}
						{s.modified > 0 && <Text color="yellow">~{s.modified} </Text>}
						{s.added > 0 && <Text color="green">+{s.added} </Text>}
						{s.deleted > 0 && <Text color="red">−{s.deleted} </Text>}
						<Text dimColor>{s.files === 1 ? "arquivo" : "arquivos"}</Text>
					</Button>
					{counts(s.additions, s.deletions)}
				</Box>
			)}
		</Box>
	);
}

export function prPaneView(
	{ Box, Text, Link, Markdown, Button }: Ui,
	props: { pr: Pr | undefined; onRefresh: () => void },
) {
	const { pr, onRefresh } = props;
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
			{pr.files.length > 0 && (
				<Box flexDirection="column">
					<Text bold>Arquivos alterados</Text>
					{pr.files.map((f) => (
						<Text key={`file-${f.path}`}>
							<Text color="green">+{f.additions}</Text>{" "}
							<Text color="red">−{f.deletions}</Text> {f.path}
						</Text>
					))}
					{pr.files.length < pr.changedFiles && (
						<Text dimColor>
							… e mais {pr.changedFiles - pr.files.length} arquivos
						</Text>
					)}
				</Box>
			)}
			<Markdown text={pr.body || "_Sem descrição._"} />
			<Button key="refresh" label="Atualizar" onPress={onRefresh} />
		</Box>
	);
}

export function worktreePaneView({ Box, Text }: Ui, files: WorktreeFile[]) {
	if (files.length === 0)
		return <Text dimColor>Nenhuma alteração na worktree.</Text>;

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>
				{files.length === 1
					? "1 arquivo alterado"
					: `${files.length} arquivos alterados`}
			</Text>
			<Box flexDirection="column">
				{files.map((f) => (
					<Text key={`wt-${f.path}`}>
						<Text dimColor>{f.status.padEnd(2)}</Text>{" "}
						<Text color="green">+{f.additions}</Text>{" "}
						<Text color="red">−{f.deletions}</Text> {f.path}
					</Text>
				))}
			</Box>
		</Box>
	);
}
