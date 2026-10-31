import type { EngineInterface } from "claude-code";

import type { Pr } from "../types";

// The element table each view draws with: `$.ui.resolve(e)` in the mod, a DOM
// table in Storybook.
export type Ui = Pick<
	ReturnType<EngineInterface["ui"]["resolve"]>,
	"Box" | "Text" | "Button" | "Link" | "Markdown"
>;

export type WorktreeFile = {
	path: string;
	status: string;
	additions: number;
	deletions: number;
};

export function bandView(
	{ Box, Button, Text }: Ui,
	props: {
		prs: Pr[];
		onOpenPr: (n: number) => void;
		onOpenWorktree: () => void;
	},
) {
	const { prs, onOpenPr, onOpenWorktree } = props;
	if (prs.length === 0) {
		return (
			<Box flexDirection="row" gap={1}>
				<Text dimColor>Nenhum PR relacionado a esta conversa</Text>
				<Button
					key="worktree"
					label="Ver alterações da worktree"
					onPress={onOpenWorktree}
				/>
			</Box>
		);
	}
	return (
		<Box flexDirection="row" gap={1}>
			<Text dimColor>
				{prs.length === 1
					? "1 PR relacionado:"
					: `${prs.length} PRs relacionados:`}
			</Text>
			{prs.slice(0, 5).map((pr) => (
				<Button
					key={`pr-${pr.number}`}
					label={`#${pr.number} ${pr.title.slice(0, 40)} · ${pr.state.toLowerCase()}`}
					onPress={() => onOpenPr(pr.number)}
				/>
			))}
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
