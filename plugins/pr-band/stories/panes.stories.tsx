import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import { prPaneView, worktreePaneView } from "../hooks/views";
import { domUi, Terminal } from "./dom-ui";
import { pr, worktree } from "./fixtures";

type PrArgs = Parameters<typeof prPaneView>[1];

const meta = {
	title: "pr-band/Painel do PR",
	render: (args) => <Terminal>{prPaneView(domUi, args)}</Terminal>,
	args: { pr, onRefresh: fn() },
} satisfies Meta<PrArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ComArquivos: Story = {
	play: async ({ args, canvas, userEvent }) => {
		await expect(canvas.getByText(/e mais 1 arquivos/)).toBeVisible();
		await userEvent.click(canvas.getByRole("button", { name: "Atualizar" }));
		await expect(args.onRefresh).toHaveBeenCalled();
	},
};

export const SemDescricao: Story = {
	args: { pr: { ...pr, body: "", files: [], changedFiles: 0 } },
};

export const NenhumSelecionado: Story = { args: { pr: undefined } };

export const Worktree: StoryObj<{ files: typeof worktree }> = {
	render: ({ files }) => <Terminal>{worktreePaneView(domUi, files)}</Terminal>,
	args: { files: worktree },
};

export const WorktreeLimpa: StoryObj<{ files: typeof worktree }> = {
	render: ({ files }) => <Terminal>{worktreePaneView(domUi, files)}</Terminal>,
	args: { files: [] },
};
