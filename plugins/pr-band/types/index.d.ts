export type PrFile = { path: string; additions: number; deletions: number }

export type Pr = {
  number: number
  title: string
  url: string
  state: string
  isDraft: boolean
  author: string
  branch: string
  additions: number
  deletions: number
  changedFiles: number
  files: PrFile[]
  review: string
  checks: string
  body: string
  source: string
}

declare module 'claude-code' {
  interface PluginState {
    'pr-band': { prs: Shaped<Pr[]>; selected: number | null }
  }
}
