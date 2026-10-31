import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";

import { bandView } from "../hooks/views";
import { domUi, Terminal } from "./dom-ui";
import { prs } from "./fixtures";

type Args = Parameters<typeof bandView>[1];

const meta = {
	title: "pr-band/Faixa acima do prompt",
	render: (args) => <Terminal>{bandView(domUi, args)}</Terminal>,
	args: { prs, onOpenPr: fn(), onOpenWorktree: fn() },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VariosPrs: Story = {
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.click(canvas.getByRole("button", { name: /#41/ }));
		await expect(args.onOpenPr).toHaveBeenCalledWith(41);
	},
};

export const UmPr: Story = { args: { prs: prs.slice(0, 1) } };

export const SemPrs: Story = {
	args: { prs: [] },
	play: async ({ args, canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: "Ver alterações da worktree" }),
		);
		await expect(args.onOpenWorktree).toHaveBeenCalled();
	},
};
