# Coding Plan Usage

Mod do Claude Code que abre, num painel lateral, o consumo do plano lido de
`~/scripts/commands/coding-plan-usage`.

Instalar: `/plugin install coding-plan-usage --marketplace gugacarbo/claude-plugins`

## Comando

- `/coding-plan-usage` abre o painel com a saída do comando. O painel tem um
  botão **↻ Atualizar** para ler de novo. Em terminais estreitos demais para o
  painel, a saída aparece no transcript.

## O comando de origem

O mod executa, sem argumentos:

1. `~/scripts/commands/coding-plan-usage`, se for um arquivo executável;
2. senão, `bash ~/scripts/commands/coding-plan-usage`, se for um arquivo;
3. senão, o mesmo caminho dentro da pasta (`.../coding-plan-usage`).

O contrato é simples: imprimir o relatório de consumo em `stdout` e sair com
código `0`. A saída é exibida como texto pré-formatado, com cores ANSI
removidas. Se o comando não existir, o painel mostra o caminho esperado e o
erro; nada quebra a sessão.
