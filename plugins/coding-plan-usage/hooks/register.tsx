import type { EngineInterface, Register } from "claude-code";
import { atom, read, update } from "claude-code";

import type { UsageReport } from "../types";

const PANE = "coding-plan-usage";
const COMMAND = "coding-plan-usage";
const TIMEOUT_MS = 60_000;
const MAX_CHARS = 100_000;

const EMPTY: UsageReport = {
	output: "",
	error: "",
	ranAt: 0,
	isLoading: false,
};
const usage = atom(
	{ plugin: "coding-plan-usage", key: "usage" } as const,
	EMPTY,
);

// The command keeps its own output readable in the pane: strip color and
// control characters the elements would refuse or draw as escape text.
// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escapes are what this strips.
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what this strips.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

function clean(text: string): string {
	return text.replace(ANSI, "").replace(/\r\n?/g, "\n").replace(CONTROL, "");
}

// The command may be a file or a folder holding a file of the same name.
const RUNNER = [
	'p="$HOME/scripts/commands/coding-plan-usage"',
	'if [ -x "$p" ] && [ ! -d "$p" ]; then exec "$p"; fi',
	'if [ -f "$p" ]; then exec bash "$p"; fi',
	'if [ -x "$p/coding-plan-usage" ] && [ ! -d "$p/coding-plan-usage" ]; then exec "$p/coding-plan-usage"; fi',
	'if [ -f "$p/coding-plan-usage" ]; then exec bash "$p/coding-plan-usage"; fi',
	'printf "Comando não encontrado: %s\\n" "$p" >&2',
	"exit 127",
].join("\n");

function clock(ms: number): string {
	const date = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

let generation = 0;

async function refresh($: EngineInterface): Promise<void> {
	const mine = ++generation;
	await update($, usage, (old) => ({ ...old, isLoading: true, error: "" }));
	const now = await $.clock.now();

	try {
		const { exitCode, stdout, stderr } = await $.process.run(
			["bash", "-c", RUNNER],
			{ timeoutMs: TIMEOUT_MS },
		);
		if (mine !== generation) return;

		const output = clean(stdout).slice(0, MAX_CHARS).trimEnd();
		const error = clean(stderr).slice(0, MAX_CHARS).trim();

		if (exitCode === 127) {
			await update($, usage, () => ({
				output: "",
				error:
					"Comando não encontrado em ~/scripts/commands/coding-plan-usage.",
				ranAt: now,
				isLoading: false,
			}));
			return;
		}

		if (exitCode !== 0) {
			await update($, usage, () => ({
				output,
				error: error || `O comando terminou com código ${exitCode}.`,
				ranAt: now,
				isLoading: false,
			}));
			return;
		}

		await update($, usage, () => ({
			output: output || error,
			error: "",
			ranAt: now,
			isLoading: false,
		}));
	} catch (e) {
		if (mine !== generation) return;
		const message = e instanceof Error ? e.message : String(e);
		await update($, usage, () => ({
			output: "",
			error: `Falha ao rodar o comando: ${message}`,
			ranAt: now,
			isLoading: false,
		}));
	}
}

type Ui = Pick<
	ReturnType<EngineInterface["ui"]["resolve"]>,
	"Box" | "Text" | "Button" | "Code"
>;

function usageView(
	{ Box, Text, Button, Code }: Ui,
	report: UsageReport,
	onRefresh: () => void,
) {
	return (
		<Box flexDirection="column" gap={1}>
			<Box flexDirection="row" justifyContent="space-between" gap={2}>
				<Text weight="semibold">Consumo do plano</Text>
				<Button key="refresh" plain onPress={onRefresh}>
					<Text color="cyan">
						{report.isLoading ? "… atualizando" : "↻ Atualizar"}
					</Text>
				</Button>
			</Box>
			{report.ranAt > 0 && (
				<Text dimColor>Atualizado às {clock(report.ranAt)}</Text>
			)}
			{report.error ? (
				<Text color="red">{report.error}</Text>
			) : report.isLoading ? (
				<Text dimColor>Lendo ~/scripts/commands/coding-plan-usage…</Text>
			) : report.output ? (
				<Code source={report.output} wrap="wrap" />
			) : (
				<Text dimColor>O comando não retornou nada.</Text>
			)}
		</Box>
	);
}

export const register: Register = (on) => {
	on("session.start", async ($, e, next) => {
		await $.command.register({
			name: COMMAND,
			description: "Abre o consumo do plano num painel lateral.",
		});
		return next(e);
	});

	on("command.run", { command: COMMAND }, async ($) => {
		const opened = await $.ui.open({
			id: PANE,
			title: "Consumo do plano",
			columns: 70,
			rows: 24,
		});
		await refresh($);
		if (opened.isPlaced) return {};

		const report = await read($, usage);
		return {
			text: report.error
				? `Consumo do plano: ${report.error}`
				: report.output || "Consumo do plano: sem dados.",
		};
	}).catch((_$, _e, next) => ({
		text: `Consumo do plano: não foi possível abrir o painel (${next.error.message ?? next.error.kind}).`,
	}));

	on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
		const report = await read($, usage);
		return usageView($.ui.resolve(e), report, () => {
			void refresh($);
		});
	});
};
