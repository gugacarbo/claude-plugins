---
name: manage-plugins
description: Instala, atualiza, edita, adiciona ou importa plugins do marketplace gugacarbo-plugins deste repo, incluindo plugins de terceiros copiados de outros repositórios (upstreams.json). Use quando pedirem para instalar ou atualizar os plugins, criar ou editar um plugin em plugins/, importar um plugin de outro repo ou puxar atualizações do upstream.
---

# Gerenciar os plugins do marketplace

Este repo é um marketplace pessoal do Claude Code. Cada plugin vive em `plugins/<nome>/`
e está listado em `.claude-plugin/marketplace.json`. O CLI em `src/index.ts` instala,
atualiza e importa plugins.

| Arquivo                                     | Papel                                                       |
| ------------------------------------------- | ----------------------------------------------------------- |
| `.claude-plugin/marketplace.json`           | Plugins do marketplace (`name`, `source`, `description`)    |
| `plugins/<nome>/.claude-plugin/plugin.json` | Manifesto do plugin; o `version` decide se há update        |
| `upstreams.json`                            | Origem dos plugins importados de outros repos               |
| `packages/ui/src/`                          | UI compartilhada, copiada para `plugins/*/hooks/ui-shared/` |

## Instalar e atualizar no Claude Code

```bash
bun run plugins:install # adiciona o marketplace e instala o que falta
bun run plugins:update  # atualiza marketplace e plugins já instalados
bun run plugins:status  # mostra o que está instalado/ativo
```

- `--dry-run` mostra os comandos `claude plugin …` sem rodar; `--remote` usa o repo do
  GitHub em vez da pasta local.
- `install` e `update` antes sincronizam `packages/ui` para os hooks dos plugins.
- Depois de instalar ou atualizar, é preciso abrir uma nova sessão do Claude Code.

## Editar um plugin

1. Altere os arquivos em `plugins/<nome>/`.
2. Incremente `version` em `plugins/<nome>/.claude-plugin/plugin.json`. Sem isso o
   `claude plugin update` não vê a mudança.
3. Para testar sem instalar: `claude --plugin-dir plugins/<nome>`.
4. Rode `bun run plugins:update` e abra uma nova sessão.

Hooks só podem importar arquivos do próprio plugin (caminho relativo) e o módulo
`claude-code`. Para UI compartilhada, importe de `./ui-shared/…` e edite a fonte em
`packages/ui/src/`, nunca a cópia em `hooks/ui-shared/` (ela é sobrescrita).

## Criar um plugin novo

1. Crie `plugins/<nome>/.claude-plugin/plugin.json` com `name`, `version` e `description`.
2. Adicione `{ "name", "source": "./plugins/<nome>", "description" }` em
   `.claude-plugin/marketplace.json`.
3. Rode `claude plugin validate plugins/<nome>` e `bun run plugins:install`.

## Plugins de outros repos (upstream)

Um plugin de terceiros é uma cópia editável em `plugins/<nome>/`. A entrada em
`upstreams.json` guarda `repo`, `ref` (branch ou tag), `path` (pasta no upstream, `.`
para a raiz) e `base` (commit do upstream em que a cópia se baseia).

```bash
bun run plugins:import main] [--path pasta/no/upstream] [--name nome] < repo > [--ref
bun run plugins:upstream status          # há commits novos no upstream?
bun run plugins:upstream pull [nomes...] # traz as atualizações
```

- `import` copia a pasta, registra a origem em `upstreams.json` e adiciona ao
  `marketplace.json`. Revise a descrição (os textos do repo são em português).
- `pull` aplica o diff `base..novo` do upstream sobre a cópia com merge de 3 vias:
  as alterações locais ficam. Depois avança o `base` e põe no `version` um patch acima
  da maior versão entre local e upstream. O conflito na linha `version` é resolvido sozinho.
- Antes do `pull`, os plugins atualizados não podem ter mudanças não commitadas.
- Se houver conflito, o comando lista os arquivos, deixa os marcadores
  `<<<<<<< ours` / `>>>>>>> theirs` e sai com código 2. Resolva, rode `git add` e commite.
- Nenhum dos dois comandos commita: revise com `git diff` e commite.
- O workflow `.github/workflows/upstream.yml` roda o `pull` toda segunda e abre um PR.

Para conflitos raros, prefira colocar as alterações locais em arquivos novos a editar
muito os do upstream. Para ver tudo o que mudou localmente em relação ao upstream:
`git fetch <repo> <ref>` e `git diff <base> HEAD:plugins/<nome>` (com `path` `.`).

## Antes de commitar

Rode `bun run check`, `bun run typecheck` e `bun test`, e use Conventional Commits.
