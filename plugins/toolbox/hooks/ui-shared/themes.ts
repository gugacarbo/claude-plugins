// Palette used by DOM stand-ins (Storybook) and as a reference for what the
// Claude Code runtime maps its color names to.
export const COLORS = {
	green: "#3fb950",
	red: "#f85149",
	magenta: "#a371f7",
	cyan: "#39c5cf",
	yellow: "#d29922",
	gray: "#8b949e",
} as const;

export type ThemeColor = keyof typeof COLORS;

// Resolve a Ui color name to a hex, falling back to the raw string (for custom
// colors the runtime may accept verbatim).
export function resolveColor(name: string): string {
	return (COLORS as Record<string, string>)[name] ?? name;
}
