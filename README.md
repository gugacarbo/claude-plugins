# claude-plugins

Marketplace pessoal de plugins do Claude Code.

| Plugin       | O que faz                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| `pr-context` | Skill e comando `/related-prs`: o Claude busca PRs relacionados à conversa e resume cada um.               |
| `pr-band`    | Mod só código: faixa acima do prompt com os PRs relacionados; ao clicar, abre o resumo num painel lateral. |

## Instalar ou atualizar

Requer Bun 1.2+, o CLI `claude` e, para os plugins de PR, o `gh` autenticado (`gh auth login`).

```bash
git clone https://github.com/gugacarbo/claude-plugins ~/apps/claude-plugins
cd ~/apps/claude-plugins
bun install
bun run plugins:install
```

- `bun run plugins:install`: adiciona o marketplace (esta pasta) e instala os plugins que faltam.
- `bun run plugins:update`: atualiza o marketplace e todos os plugins instalados.
- `bun run plugins:status`: mostra o estado de cada plugin.
- Passe `--remote` para usar o repositório do GitHub como marketplace, e `--dry-run` para só
  mostrar os comandos: `bun src/index.ts install --remote --dry-run`.

Abra uma nova sessão do Claude Code depois de instalar ou atualizar.

### Em máquinas SSH sem Bun

```bash
claude plugin marketplace add gugacarbo/claude-plugins
claude plugin install pr-context@gugacarbo-plugins
claude plugin install pr-band@gugacarbo-plugins
```

Para atualizar: `claude plugin marketplace update gugacarbo-plugins` e
`claude plugin update <plugin>@gugacarbo-plugins`.

## Desenvolvimento

```bash
bun run check     # Biome
bun run typecheck # tsc
bun test          # testes do script
bun run knip      # código e dependências não usados
bun run spell     # ortografia
```

Commits seguem Conventional Commits (commitlint no hook `commit-msg`).
