// A toolbox icon at the right of the band above the prompt. Pressed, it expands to its left the
// shortcuts to the panes of the plugins it controls. Closed, it comes back with /toolbox or the
// right-click menu.

import type { EngineInterface, Register } from "claude-code";
import { atom, read, update } from "claude-code";

const COMMAND = "toolbox";
const ICON = "🛠";

/**
 * The plugins it controls. A press writes `toolbox.request` with the plugin's name; each plugin hears that write
 * (`state.set`) and opens its own pane at once, even mid-turn: `$.command.run` would wait for the session to be idle.
 */
const TOOLS = [
	{ key: "lot-map", label: "Lot Map" },
	{ key: "effort-optimizer", label: "Effort Optimizer" },
] as const;

const isExpanded = atom(
	{ plugin: "toolbox", key: "isExpanded" } as const,
	false,
);
const isHidden = atom({ plugin: "toolbox", key: "isHidden" } as const, false);
const request = atom({ plugin: "toolbox", key: "request" } as const, null);

/** Asks a plugin to open its pane. */
async function runTool($: EngineInterface, target: string): Promise<void> {
	await update($, request, (last) => ({ target, n: (last?.n ?? 0) + 1 }));
}

async function show($: EngineInterface): Promise<void> {
	await update($, isHidden, () => false);
	await update($, isExpanded, () => true);
}

export const register: Register = (on) => {
	on("session.start", async ($, e, next) => {
		await $.command.register({
			name: COMMAND,
			description: "Toolbox: mostra a caixa de ferramentas acima do prompt",
			immediate: true,
		});
		return next(e);
	});

	on("command.run", { command: COMMAND }, ($) =>
		show($).then(
			() => ({ text: "Toolbox aberta." }),
			() => ({ text: "Não consegui abrir a toolbox." }),
		),
	);

	on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
		if (e.props.hasSurvey || (await read($, isHidden))) return next(e);
		const expanded = await read($, isExpanded);
		const { Box, Button, Text } = $.ui.resolve(e);

		return (
			<Box
				flexDirection="row"
				justifyContent="flex-end"
				flexGrow={1}
				columnGap={1}
			>
				{expanded &&
					TOOLS.map((tool) => (
						<Button
							key={tool.key}
							label={tool.label}
							onPress={() => runTool($, tool.key)}
						/>
					))}
				<Button
					key="toggle"
					plain
					onPress={() => update($, isExpanded, (v) => !v)}
				>
					<Text size="caption">{ICON}</Text>
				</Button>
				<Button
					key="close"
					plain
					dimColor
					onPress={() => update($, isHidden, () => true)}
				>
					<Text size="caption">✕</Text>
				</Button>
			</Box>
		);
	});

	on("ui.render", { component: "ContextMenu" }, ($, e) => {
		const { Box, Button } = $.ui.resolve(e);
		return (
			<Box flexDirection="column">
				<Button key="toolbox" onPress={() => show($)}>
					{`${ICON} Toolbox`}
				</Button>
			</Box>
		);
	});
};
