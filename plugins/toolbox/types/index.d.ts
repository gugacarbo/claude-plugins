/** Tokens of one model, as the API reported them over the session's requests. */
export type ModelTokens = {
  requests: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

/**
 * One window of the plan as last read, with what this session has used of it: `baseline` is the
 * percent at the session's first reading (0 after a reset), `carried` what the session used in
 * windows that have since reset.
 */
export type LimitWindow = {
  percent: number
  resetsAt?: string
  baseline: number
  carried: number
}

/** What the usage ring shows and its tooltip lists. */
export type Usage = {
  /** The five-hour window of the plan: percent used and when it resets; null off a subscription or before the first reading. */
  fiveHour: LimitWindow | null
  /** The seven-day window of the plan. */
  sevenDay: LimitWindow | null
  /** The session's cost as `/cost` has it, in USD: an estimate, not the bill. */
  costUsd: number | null
  /** The subagents' part of `costUsd`. */
  subagentsUsd: number
  /** Tokens per model, the main chat apart from the subagents. */
  main: Record<string, ModelTokens>
  subagents: Record<string, ModelTokens>
}

declare module 'claude-code' {
  interface PluginState {
    toolbox: {
      isExpanded: boolean
      isHidden: boolean
      /** The usage card pinned open by a click on the ring. */
      isCardOpen: boolean
      /** The pane a toolbox button asked for; `n` changes on every press so the same pane can be asked twice. */
      request: { target: string; n: number } | null
      usage: Usage
    }
  }
}
