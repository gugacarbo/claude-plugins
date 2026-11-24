// A toolbox icon at the left of the band above the prompt. Pressed, it expands to its right the
// shortcuts to the panes of the plugins it controls. Closed, it comes back with /toolbox or the
// right-click menu.

import type { EngineInterface, Register, RenderNode } from "claude-code";
import { atom, read, update } from "claude-code";
import type { WindowView } from "./usage";
import {
	addRequest,
	EMPTY_USAGE,
	meter,
	nextWindow,
	ringColor,
	ringGlyph,
	ringSvg,
	usageView,
} from "./usage";

const COMMAND = "toolbox";
/** The hover group of the usage ring and its card. */
const HOVER = "toolbox-usage";
const ICON = "🛠";

/**
 * The plugins it controls. A press writes `toolbox.request` with the plugin's name; each plugin hears that write
 * (`state.set`) and opens its own pane at once, even mid-turn: `$.command.run` would wait for the session to be idle.
 */
const TOOLS = [
	{ key: "lot-map", icon: "🗺", label: "Lot Map" },
	{ key: "effort-optimizer", icon: "⚡", label: "Effort Optimizer" },
] as const;

const isExpanded = atom(
	{ plugin: "toolbox", key: "isExpanded" } as const,
	false,
);
const isCardOpen = atom(
	{ plugin: "toolbox", key: "isCardOpen" } as const,
	false,
);
const isHidden = atom({ plugin: "toolbox", key: "isHidden" } as const, false);
const request = atom({ plugin: "toolbox", key: "request" } as const, null);
const usage = atom({ plugin: "toolbox", key: "usage" } as const, EMPTY_USAGE);

/** The plan's windows and the session's cost, as `session.measure` and `$.session.usage()` give them. */
async function measure(
	$: EngineInterface,
	m: {
		rateLimits: readonly {
			kind: string;
			percentUsed: number;
			resetsAt?: string;
		}[];
		cost?: { usd: number };
	},
): Promise<void> {
	const five = m.rateLimits.find((w) => w.kind === "five_hour");
	const week = m.rateLimits.find((w) => w.kind === "seven_day");
	const agents = await $.agent.list().catch(() => []);
	const subagentsUsd = agents.reduce((n, a) => n + (a.cost?.usd ?? 0), 0);
	await update($, usage, (u) => ({
		...u,
		fiveHour: nextWindow(u.fiveHour, five),
		sevenDay: nextWindow(u.sevenDay ?? null, week),
		costUsd: m.cost?.usd ?? u.costUsd,
		subagentsUsd,
	}));
}

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
		const now = await $.session.usage().catch(() => undefined);
		if (now) await measure($, now).catch(() => undefined);
		return next(e);
	});

	// Pushed after each main turn and when a window of the plan moves a point.
	on("session.measure", async ($, e, next) => {
		await measure($, e).catch(() => undefined);
		return next(e);
	});

	// Every model request, the main chat's and each subagent's: its tokens, by the model that answered.
	on("turn.step", async function* ($, e, next) {
		const result = yield* next(e);
		const reported = result.usage;
		if (reported) {
			const side = e.agentId === undefined ? "main" : "subagents";
			await update($, usage, (u) => ({
				...u,
				[side]: addRequest(u[side], reported),
			})).catch(() => undefined);
		}
		return result;
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
		const u = await read($, usage);
		const view = usageView(u, await $.clock.now());
		const { Box, Button, Text } = $.ui.resolve(e);
		const isPinned = await read($, isCardOpen);
		const percent = u.fiveHour ? `${u.fiveHour.percent}%` : "—";

		// The desktop draws the ring as an SVG beside the button (a Button holds text alone); the terminal, a glyph in it.
		const fill = u.fiveHour?.percent ?? 0;
		let ringIcon: RenderNode | null = null;
		let ringText = `${ringGlyph(fill)} ${percent}`;
		if (e.surface === "desktop") {
			const { Svg } = $.ui.resolve(e);
			ringIcon = (
				<Svg
					source={ringSvg(fill)}
					alt={`Limite de 5h: ${percent}`}
					width={18}
					height={18}
				/>
			);
			ringText = percent;
		}

		// The card: a summary on top (label column, value column), then one table per group of models,
		// the numbers right-aligned in columns of their own so the digits line up.
		const LABEL = 16;
		const COLUMNS = [
			{ title: "Req", width: 5 },
			{ title: "Entrada", width: 8 },
			{ title: "Saída", width: 8 },
			{ title: "Cache lido", width: 11 },
			{ title: "Cache grav.", width: 11 },
		] as const;
		const fact = (label: string, value: RenderNode) => (
			<Box key={label} flexDirection="row">
				<Box width={LABEL} flexShrink={0}>
					<Text size="caption" dimColor>
						{label}
					</Text>
				</Box>
				<Box flexGrow={1} flexShrink={1} minWidth={0}>
					{value}
				</Box>
			</Box>
		);
		const num = (text: string, width: number, isHead = false) => (
			<Box width={width} flexShrink={0} justifyContent="flex-end">
				<Text size="caption" mono={!isHead} dimColor={isHead} bold={false}>
					{text}
				</Text>
			</Box>
		);
		// One window of the plan: its bar and percent, when it resets, and this session's part of it.
		const limit = (w: WindowView | null) =>
			w === null ? (
				<Text size="caption" dimColor>
					sem leitura ainda
				</Text>
			) : (
				<Box flexDirection="column">
					<Text size="caption" wrap="truncate-end">
						<Text color={ringColor(w.percent)}>{meter(w.percent)}</Text>
						<Text bold>{`  ${w.percent}%`}</Text>
						{w.resets ? <Text dimColor>{`  ·  ${w.resets}`}</Text> : null}
					</Text>
					<Text size="caption" dimColor>
						{w.session}
					</Text>
				</Box>
			);
		const card = (
			<Box
				key="usage-card"
				flexDirection="column"
				// Pinned by a click it stays shown; otherwise the pointer on the ring reveals it.
				{...(isPinned
					? {}
					: {
							display: "none" as const,
							hover: { scope: HOVER, display: "flex" as const },
						})}
				borderStyle="round"
				borderDimColor
				paddingX={2}
				paddingY={1}
				marginBottom={1}
				rowGap={1}
			>
				<Box flexDirection="column">
					{fact("Limite de 5h", limit(view.fiveHour))}
					{fact("Limite semanal", limit(view.sevenDay))}
					{fact(
						"Custo da sessão",
						<Text size="caption" wrap="truncate-end">
							<Text bold>{view.cost}</Text>
							<Text dimColor>{"  estimativa"}</Text>
						</Text>,
					)}
					{view.split
						? fact(
								"",
								<Text size="caption" dimColor wrap="truncate-end">
									{`chat principal ${view.split.main}  ·  subagents ${view.split.subagents}`}
								</Text>,
							)
						: null}
				</Box>
				{view.groups.length === 0 ? (
					<Text size="caption" dimColor>
						Nenhuma requisição ao modelo desde que a toolbox carregou.
					</Text>
				) : (
					<Box flexDirection="column">
						<Box flexDirection="row" columnGap={2}>
							<Box flexGrow={1} flexShrink={1} minWidth={12}>
								<Text size="caption" dimColor>
									Modelo
								</Text>
							</Box>
							{COLUMNS.map((c) => num(c.title, c.width, true))}
						</Box>
						{view.groups.map((group) => [
							<Box key={`g-${group.title}`} marginTop={1}>
								<Text size="caption" color="claude" bold>
									{group.title}
								</Text>
							</Box>,
							...group.rows.map((row) => (
								<Box
									key={`${group.title}-${row.model}`}
									flexDirection="row"
									columnGap={2}
								>
									<Box flexGrow={1} flexShrink={1} minWidth={12}>
										<Text size="caption" wrap="truncate-end">
											{row.model}
										</Text>
									</Box>
									{num(row.requests, COLUMNS[0].width)}
									{num(row.input, COLUMNS[1].width)}
									{num(row.output, COLUMNS[2].width)}
									{num(row.cacheRead, COLUMNS[3].width)}
									{num(row.cacheWrite, COLUMNS[4].width)}
								</Box>
							)),
						])}
					</Box>
				)}
			</Box>
		);

		return (
			<Box flexDirection="column" flexGrow={1}>
				{e.surface === "terminal" ? null : card}
				<Box flexDirection="row" flexGrow={1} columnGap={1}>
					<Button
						key="toggle"
						plain
						onPress={() => update($, isExpanded, (v) => !v)}
					>
						<Text size="title">{ICON}</Text>
					</Button>
					{expanded &&
						TOOLS.map((tool) => (
							<Button
								key={tool.key}
								label={`${tool.icon} ${tool.label}`}
								onPress={() => runTool($, tool.key)}
							/>
						))}
					<Box flexGrow={1} />
					{/* A click pins the card open, a second one closes it; the pointer on it reveals it too. */}
					{/* The ring and its percent: the pointer on either reveals the card, a click on the percent pins it. */}
					<Box
						key="usage-ring"
						hover={{ scope: HOVER }}
						flexDirection="row"
						alignItems="center"
						columnGap={1}
					>
						{ringIcon}
						<Button
							key="usage"
							plain
							dimColor
							onPress={() => update($, isCardOpen, (v) => !v)}
						>
							{ringText}
						</Button>
					</Box>
					<Button
						key="close"
						plain
						dimColor
						onPress={() => update($, isHidden, () => true)}
					>
						<Text size="caption">✕</Text>
					</Button>
				</Box>
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
