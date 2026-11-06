// Structural types for the Claude Code mod UI primitives, so this package
// does not depend on the `claude-code` SDK (only available inside plugins).
// The real `EngineInterface['ui']['resolve']` satisfies these shapes.

import type { ReactNode } from "react";

interface BoxProps {
	children?: ReactNode;
	flexDirection?: "row" | "column";
	gap?: number;
	justifyContent?:
		| "flex-start"
		| "flex-end"
		| "center"
		| "space-between"
		| "space-around"
		| "space-evenly";
	width?: number;
}

interface TextProps {
	children?: ReactNode;
	bold?: boolean;
	dimColor?: boolean;
	color?: string;
}

interface ButtonProps {
	label?: string;
	children?: ReactNode;
	onPress?: () => void;
	plain?: boolean;
	dimColor?: boolean;
	variant?: "primary" | "secondary";
}

interface LinkProps {
	href: string;
	label?: string;
}

interface MarkdownProps {
	text: string;
}

interface SvgProps {
	source: string;
	alt: string;
	width?: number;
	height?: number;
}

export interface UiElements {
	Box: (props: BoxProps) => ReactNode;
	Text: (props: TextProps) => ReactNode;
	Button: (props: ButtonProps) => ReactNode;
	Link: (props: LinkProps) => ReactNode;
	Markdown: (props: MarkdownProps) => ReactNode;
}

// The element table each view draws with: `$.ui.resolve(e)` in the mod, a DOM
// table in Storybook. `Svg` exists on desktop/editor/mobile, not on the terminal.
export type Ui = UiElements & {
	Svg?: (props: SvgProps) => ReturnType<Ui["Text"]>;
};

export type PaneTab = "files" | "images";

// One side of a changed image: its bytes as a data URI, or why it is not shown.
export type Picture = { uri: string } | { missing: string };

export type ChangedImage = {
	path: string;
	status: "added" | "modified" | "deleted";
	before?: Picture;
	after?: Picture;
};

// Where the session is: the branch name, and whether the checkout is a linked
// worktree (`git worktree add`) rather than the main one.
export type GitHead = { branch: string; isWorktree: boolean };

export type WorktreeFile = {
	path: string;
	status: string;
	additions: number;
	deletions: number;
};
