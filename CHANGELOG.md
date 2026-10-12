# Histórico de atualizações

Cada atualização recebe um número de versão `MAIOR.MENOR.CORREÇÃO.AJUSTE` e uma tag no Git (`v1.0.0.0`, `v1.1.0.0`…).

- **MAIOR** — mudança grande na estrutura do app.
- **MENOR** — nova etapa ou funcionalidade (ex.: lançamentos, cartões, grupos).
- **CORREÇÃO** — correção de erro.
- **AJUSTE** — pequenos ajustes de texto, visual ou configuração.

---

## Atualização 1.3.0.0 — 2026-10-12

Etapa 3: cartões de crédito, faturas e parcelas.

- Cartões com limite, dia de fechamento e vencimento, moeda e cor; o cartão aparece como um "cartão de verdade" na tela.
- Compras no cartão à vista ou parceladas (até 48x); a primeira parcela cai na fatura certa conforme o fechamento, com prévia no formulário.
- Faturas por mês (aberta, fechada, paga, vencida), com a lista de compras e parcelas de cada uma.
- Pagar fatura a partir de uma conta da mesma moeda (libera o limite e desconta o saldo da conta); dá para desfazer o pagamento.
- Limite disponível atualiza na hora em todos os aparelhos (tempo real).
- Compra lançada depois de a fatura ser paga vai automaticamente para a próxima fatura em aberto.
- Lançamentos de fatura paga ficam protegidos contra edição.
- Relatórios do mês contam cada parcela no seu mês; o extrato mostra "2/10" nas parcelas.
- Início com "Seus cartões": limite disponível e fatura atual de cada cartão.
- Banco: novas tabelas e regras com testes automáticos de segurança.

## Atualização 1.2.0.1 — 2026-10-11

Ajuste de identidade visual: "Equilíbrio".

- Nova logo: dois círculos que se encontram (o que entra e o que sai) com a lente violeta do equilíbrio; ícones do app renovados.
- Nova paleta violeta serena, no tema claro e no escuro.
- O motivo dos dois círculos aparece no painel de saldo e na tela de login.

## Atualização 1.2.0.0 — 2026-10-11

Novo visual: o app passa a se chamar **FINANCE**.

- Visual no padrão de apps de banco (tema claro e escuro), fonte Manrope com números alinhados.
- Início com painel de saldo, botão de ocultar valores, atalhos, resumo do mês com barras, "Para onde foi o dinheiro" (gastos por categoria, com atalho para o extrato filtrado) e últimos lançamentos.
- Extrato agrupado por dia com total diário; no PC, resumo e filtros numa coluna lateral.
- Novo lançamento sem barra inferior no celular, com botão de voltar, "Salvar" fixo e digitação pelo teclado do computador.
- Contas, Categorias, Configurações, Login e boas-vindas redesenhados; Contas e Categorias no menu principal.
- Logo e ícones do app renovados; sistema visual documentado em `DESIGN.md`.

## Atualização 1.1.0.0 — 2026-10-11

Etapa 2: contas, categorias e lançamentos.

- Contas (dinheiro, conta corrente, poupança, outra) com saldo calculado, saldo inicial, arquivar e excluir (bloqueado se houver lançamentos).
- Categorias: 19 padrão traduzidas nos 4 idiomas + categorias próprias com ícone e cor.
- Novo lançamento com teclado numérico grande, receita/despesa, categoria, conta, data e descrição; sugere a conta e a categoria mais usadas.
- Lista de lançamentos do mês com resumo (entradas, saídas, resultado), busca e filtros por tipo, conta e categoria.
- Início com saldo das contas, resumo do mês e últimos lançamentos.
- Assistente de boas-vindas agora cria a primeira conta.
- Totais sempre separados por moeda; a moeda do lançamento vem da conta.
- Banco: novas tabelas com regras de segurança e testes automáticos de segurança (`npm run test:db`).

## Atualização 1.0.0.0 — 2026-10-10

Primeira versão: a base do app (Etapa 1).

- Cadastro, login, recuperação de senha e criação de nova senha (Supabase Auth).
- Assistente de boas-vindas: nome, idioma, moeda principal e tema.
- Quatro idiomas: português do Brasil, português de Portugal, inglês e espanhol.
- Tema claro, escuro ou automático, sem "piscar" ao abrir.
- Layout responsivo: barra inferior com botão "+" no celular e menu lateral no PC.
- Tela de Configurações (perfil, idioma, moeda, tema, sair).
- App instalável (PWA): ícone, tela cheia, aviso "Instalar app" e instrução para iPhone.
- Banco de dados: tabela de perfis com regras de segurança (cada pessoa só acessa o próprio perfil).
- Testes automáticos (57 testes de unidade e 8 de ponta a ponta no celular e no PC).
