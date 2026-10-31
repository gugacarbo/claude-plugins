export type PrFile = { path: string; additions: number; deletions: number }

export type Pr = {
  number: number
  title: string
  url: string
  state: string
  isDraft: boolean
  author: string
  branch: string
  /** Commits the images tab reads the PR's files at. */
  headSha: string
  baseSha: string
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
    'pr-band': {
      prs: Shaped<Pr[]>
      selected: number | null
      /** The tab each pane shows: changed files or changed images. */
      prTab: 'files' | 'images'
      worktreeTab: 'files' | 'images'
    }
  }
}
