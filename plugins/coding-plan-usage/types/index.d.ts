/** What the pane draws: the command's output, or why it could not be read. */
export type UsageReport = {
	/** The command's stdout, already cleaned of ANSI and control characters. */
	output: string
	/** A failure message shown instead of the output. */
	error: string
	/** When the report was last read, in `$.clock.now()` milliseconds. */
	ranAt: number
	/** True while the command is running. */
	isLoading: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'coding-plan-usage': {
      usage: UsageReport
    }
  }
}
