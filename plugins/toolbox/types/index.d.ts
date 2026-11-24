declare module 'claude-code' {
  interface PluginState {
    toolbox: {
      isExpanded: boolean
      isHidden: boolean
      /** The pane a toolbox button asked for; `n` changes on every press so the same pane can be asked twice. */
      request: { target: string; n: number } | null
    }
  }
}
