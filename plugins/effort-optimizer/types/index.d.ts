export type Level = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type Band = {
  /** offer: the suggestion and its buttons. applied: one line for a few seconds. info: the Learn more panel, open until closed. */
  phase: 'offer' | 'applied' | 'info'
  /** Changes with every new band, so an old timer never clears a newer one. */
  id: number
  /** The level the framework picked. */
  level: Level
  /** The level the chat ran at when the prompt went in. */
  from: Level | ''
  /** One short reason, from the framework. */
  why: string
  /** A line under the buttons: an error, or how the level was set. */
  note: string
}

/** One Sonnet check, as kept in `$.store` under `usage`. */
export type UsageCall = {
  /** When the call ended, ISO. */
  at: string
  /** How long the call took. */
  ms: number
  /** False when the model gave no usable reply. */
  ok: boolean
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  /** Estimated cost at Sonnet 5.5 list prices. */
  usd: number
}

export type UsageTotals = {
  calls: number
  failed: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  ms: number
  usd: number
}

export type UsageLog = {
  total: UsageTotals
  /** Totals per local day, keyed YYYY-MM-DD. */
  days: Record<string, UsageTotals>
  /** The latest calls, oldest first, capped. */
  calls: UsageCall[]
}

declare module 'claude-code' {
  interface PluginState {
    'effort-optimizer': {
      band: Band | null
      /** Shown above the prompt while the pick runs, e.g. "picking effort…". */
      checking: string | null
      /** The level the mod puts on every main-chat request when the effort setting could not be changed. */
      override: Level | null
    }
  }
}
