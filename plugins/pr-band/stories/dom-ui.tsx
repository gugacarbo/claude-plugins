import type { CSSProperties, ReactNode } from "react";

import type { Ui } from "../hooks/views";

// A DOM stand-in for the element table `$.ui.resolve(e)` hands the mod, so the
// views render in Storybook. It mimics the terminal look, not its exact paint.
const COLORS: Record<string, string> = {
	green: "#3fb950",
	red: "#f85149",
	magenta: "#a371f7",
	gray: "#8b949e",
};

type BoxProps = {
	children?: ReactNode;
	flexDirection?: "row" | "column";
	gap?: number;
	justifyContent?: CSSProperties["justifyContent"];
	width?: number;
};
const Box = ({
	children,
	flexDirection = "column",
	gap = 0,
	justifyContent,
	width,
}: BoxProps) => (
	<div
		style={{
			display: "flex",
			flexDirection,
			gap: `${gap * 0.5}em`,
			justifyContent,
			width: width === undefined ? undefined : `${width}ch`,
			flexShrink: width === undefined ? undefined : 0,
			flexWrap: flexDirection === "row" ? "nowrap" : "wrap",
			alignItems: flexDirection === "row" ? "center" : "stretch",
		}}
	>
		{children}
	</div>
);

type TextProps = {
	children?: ReactNode;
	bold?: boolean;
	dimColor?: boolean;
	color?: string;
};
const Text = ({ children, bold, dimColor, color }: TextProps) => {
	const style: CSSProperties = {
		fontWeight: bold ? 700 : undefined,
		opacity: dimColor ? 0.6 : undefined,
		color: color ? (COLORS[color] ?? color) : undefined,
		whiteSpace: "pre-wrap",
	};
	return <span style={style}>{children}</span>;
};

// `plain` draws without chrome, as the terminal does; `dimColor` dims it at rest.
const Button = ({
	label,
	children,
	onPress,
	plain,
	dimColor,
}: {
	label?: string;
	children?: ReactNode;
	onPress?: () => void;
	plain?: boolean;
	dimColor?: boolean;
}) => (
	<button
		type="button"
		onClick={onPress}
		style={{
			font: "inherit",
			color: "inherit",
			cursor: "pointer",
			opacity: dimColor ? 0.6 : undefined,
			...(plain
				? { background: "none", border: "none", padding: 0, textAlign: "left" }
				: {
						background: "#30363d",
						border: "1px solid #484f58",
						borderRadius: 4,
						padding: "0 0.6em",
					}),
		}}
	>
		{children ?? label}
	</button>
);

const Link = ({ href, label }: { href: string; label?: string }) => (
	<a href={href} target="_blank" rel="noreferrer" style={{ color: "#58a6ff" }}>
		{label ?? href}
	</a>
);

const Markdown = ({ text }: { text: string }) => (
	<div style={{ whiteSpace: "pre-wrap", opacity: 0.85 }}>{text}</div>
);

export const domUi = { Box, Text, Button, Link, Markdown } as unknown as Ui;

export const Terminal = ({ children }: { children: ReactNode }) => (
	<div
		style={{
			fontFamily: "ui-monospace, Menlo, monospace",
			fontSize: 13,
			lineHeight: 1.5,
			color: "#e6edf3",
			background: "#0d1117",
			padding: 16,
			borderRadius: 8,
			maxWidth: 720,
		}}
	>
		{children}
	</div>
);
