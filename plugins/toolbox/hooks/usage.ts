// The usage ring: the five-hour window of the plan as a circle, and a tooltip with the session's tokens and cost.
import type { LimitWindow, ModelTokens, Usage } from "../types";

export const EMPTY_USAGE: Usage = {
	fiveHour: null,
	sevenDay: null,
	costUsd: null,
	subagentsUsd: 0,
	main: {},
	subagents: {},
};

type Reported = {
	model: string;
	input_tokens: number;
	output_tokens: number;
	cache_read_input_tokens?: number | null;
	cache_creation_input_tokens?: number | null;
};

/** Adds one request's tokens to its model's line. */
export function addRequest(
	lines: Record<string, ModelTokens>,
	u: Reported,
): Record<string, ModelTokens> {
	const was = lines[u.model] ?? {
		requests: 0,
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
	};
	return {
		...lines,
		[u.model]: {
			requests: was.requests + 1,
			input: was.input + u.input_tokens,
			output: was.output + u.output_tokens,
			cacheRead: was.cacheRead + (u.cache_read_input_tokens ?? 0),
			cacheWrite: was.cacheWrite + (u.cache_creation_input_tokens ?? 0),
		},
	};
}

function tokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
	return String(n);
}

function usd(v: number): string {
	return `US$ ${v < 0.01 && v > 0 ? v.toFixed(4) : v.toFixed(2)}`;
}

function resetIn(at: string | undefined, now: number): string {
	if (!at) return "";
	const ms = Date.parse(at) - now;
	if (!Number.isFinite(ms) || ms <= 0) return "";
	const min = Math.round(ms / 60_000);
	const hours = Math.floor(min / 60);
	if (hours >= 24) return `zera em ${Math.floor(hours / 24)}d ${hours % 24}h`;
	return `zera em ${hours}h${String(min % 60).padStart(2, "0")}`;
}

type RawWindow = { percentUsed: number; resetsAt?: string };

/**
 * The next reading of a window. The first one of the session sets the baseline; a new `resetsAt`
 * means the window reset, so what the session used of the old one is carried and the baseline is 0.
 * A value kept before baselines existed counts its last percent as the baseline.
 */
export function nextWindow(
	prev: Partial<LimitWindow> | null,
	read: RawWindow | undefined,
): LimitWindow | null {
	if (!read) return prev?.percent === undefined ? null : (prev as LimitWindow);
	if (!prev || prev.percent === undefined)
		return {
			percent: read.percentUsed,
			resetsAt: read.resetsAt,
			baseline: read.percentUsed,
			carried: 0,
		};
	const baseline = prev.baseline ?? prev.percent;
	const carried = prev.carried ?? 0;
	const didReset =
		prev.resetsAt !== undefined &&
		read.resetsAt !== undefined &&
		prev.resetsAt !== read.resetsAt;
	return didReset
		? {
				percent: read.percentUsed,
				resetsAt: read.resetsAt,
				baseline: 0,
				carried: carried + Math.max(0, prev.percent - baseline),
			}
		: { percent: read.percentUsed, resetsAt: read.resetsAt, baseline, carried };
}

/** What this session used of a window, in points of percent. */
export function sessionShare(w: LimitWindow): number {
	return (
		Math.round((w.carried + Math.max(0, w.percent - w.baseline)) * 10) / 10
	);
}

/** One window as the card shows it. */
export type WindowView = {
	percent: number;
	resets: string;
	/** "+3.5% nesta sessão". */
	session: string;
};

function windowView(w: LimitWindow | null, now: number): WindowView | null {
	if (!w) return null;
	return {
		percent: w.percent,
		resets: resetIn(w.resetsAt, now),
		session: `+${sessionShare(w)}% nesta sessão`,
	};
}

/** One model's line in the card, its figures already written out. */
export type ModelRow = {
	model: string;
	requests: string;
	input: string;
	output: string;
	cacheRead: string;
	cacheWrite: string;
};

/** What the usage card shows, worked out from `Usage`: the card only lays it out. */
export type UsageView = {
	/** The five-hour and the seven-day windows; null before the first reading. */
	fiveHour: WindowView | null;
	sevenDay: WindowView | null;
	/** The session's cost, written out, or "indisponível". */
	cost: string;
	/** The main chat's and the subagents' part of the cost, when subagents spent anything. */
	split: { main: string; subagents: string } | null;
	groups: { title: string; rows: ModelRow[] }[];
};

function rowsOf(lines: Record<string, ModelTokens>): ModelRow[] {
	return Object.entries(lines)
		.sort(([, a], [, b]) => b.output + b.input - (a.output + a.input))
		.map(([model, t]) => ({
			model: model.replace(/^claude-/, ""),
			requests: String(t.requests),
			input: tokens(t.input),
			output: tokens(t.output),
			cacheRead: tokens(t.cacheRead),
			cacheWrite: tokens(t.cacheWrite),
		}));
}

export function usageView(u: Usage, now: number): UsageView {
	const groups = [
		{ title: "Chat principal", rows: rowsOf(u.main) },
		{ title: "Subagents", rows: rowsOf(u.subagents) },
	].filter((g) => g.rows.length > 0);
	return {
		fiveHour: windowView(u.fiveHour, now),
		sevenDay: windowView(u.sevenDay, now),
		cost: u.costUsd === null ? "indisponível" : usd(u.costUsd),
		split:
			u.costUsd !== null && u.subagentsUsd > 0
				? {
						main: usd(Math.max(0, u.costUsd - u.subagentsUsd)),
						subagents: usd(u.subagentsUsd),
					}
				: null,
		groups,
	};
}

/** A bar of `width` cells filled with the window: "██████░░░░". */
export function meter(percent: number, width = 20): string {
	const full = Math.min(
		width,
		Math.max(0, Math.round((percent / 100) * width)),
	);
	return "█".repeat(full) + "░".repeat(width - full);
}

/** The colour the ring takes as the window fills. */
export function ringColor(percent: number): string {
	if (percent >= 90) return "#e5484d";
	if (percent >= 70) return "#f5a524";
	return "#d97757";
}

/** A circle that fills by quarters with the five-hour window: ○ ◔ ◑ ◕ ●. */
export function ringGlyph(percent: number): string {
	const glyphs = ["○", "◔", "◑", "◕", "●"];
	return glyphs[Math.min(4, Math.max(0, Math.round(percent / 25)))] ?? "○";
}

/** A circle that fills clockwise from the top with the five-hour window. */
export function ringSvg(percent: number, size = 18): string {
	const p = Math.min(100, Math.max(0, percent));
	const r = size / 2 - 2;
	const c = 2 * Math.PI * r;
	const mid = size / 2;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="#888" stroke-opacity="0.35" stroke-width="2.5"/><circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="${ringColor(p)}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${((c * p) / 100).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 ${mid} ${mid})"/></svg>`;
}
