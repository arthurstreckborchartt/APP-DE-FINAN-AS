# Histórico de atualizações

Cada atualização recebe um número de versão `MAIOR.MENOR.CORREÇÃO.AJUSTE` e uma tag no Git (`v1.0.0.0`, `v1.1.0.0`…).

- **MAIOR** — mudança grande na estrutura do app.
- **MENOR** — nova etapa ou funcionalidade (ex.: lançamentos, cartões, grupos).
- **CORREÇÃO** — correção de erro.
- **AJUSTE** — pequenos ajustes de texto, visual ou configuração.

---

## Atualização 1.7.0.0 — 2026-10-17

Etapa 6: orçamentos, metas e relatórios.

- **Orçamentos**: limite mensal por categoria de despesa, em cada moeda. A barra fica amarela ao chegar em 80% ("Perto do limite") e vermelha ao passar de 100% ("Acima do limite"), mostrando quanto falta ou quanto passou. Compras parceladas contam parcela a parcela.
- **Início**: novo quadro "Orçamento do mês" com o total e as categorias mais perto do limite.
- **Orçamento do grupo**: o administrador define limites por categoria para o grupo todo, somando os lançamentos de todos os membros; todos acompanham na tela do grupo.
- **Metas**: valor-alvo, prazo opcional, ícone e cor. Registre o que guardou ou retirou e veja o progresso, quanto falta e quanto guardar por mês até o prazo. Metas podem ser arquivadas. Os valores das metas não mexem no saldo das contas.
- **Relatórios**: receitas × despesas mês a mês em gráfico de barras, gastos por categoria, resumo do período (saldo e média de gastos), filtros de 3, 6 ou 12 meses ou o ano, por conta/cartão e por moeda. No grupo: gastos por membro e comparação entre membros.
- Relatórios, Orçamentos e Metas no menu lateral e em Ajustes.
- Tudo atualiza ao vivo entre aparelhos e respeita o "ocultar valores".

## Atualização 1.6.0.0 — 2026-10-17

Etapa 5: grupos e convites.

- Nova aba **Grupos** na barra inferior (Contas continua no menu lateral e em Ajustes).
- Crie grupos com nome, moeda e ícone; quem cria é o administrador.
- Convite por link válido por 7 dias, que várias pessoas podem usar; dá para copiar, compartilhar, revogar e gerar um novo. Quem abre o link sem estar logado volta para o convite depois de entrar ou criar a conta.
- Ao lançar (ou criar uma recorrente), escolha um grupo da mesma moeda. O grupo vê **só** os lançamentos marcados para ele — nunca contas, cartões ou outros gastos de ninguém.
- Tela do grupo: gasto do mês, sua parte, quem gastou quanto, gastos por categoria, lançamentos do grupo (compras parceladas contam parcela a parcela) e membros.
- Administrador remove membros, passa a administração e exclui o grupo; membros podem sair. Os lançamentos de quem saiu continuam no histórico; quem foi removido só volta com um link novo.
- Tempo real mais seguro: cada pessoa recebe avisos só dos próprios dados e dos grupos de que participa.
- Lançamentos do grupo aparecem com um ícone no extrato.

## Atualização 1.5.0.0 — 2026-10-13

Etapa 4: contas fixas e recorrentes.

- Nova tela **Recorrentes** (menu lateral e Ajustes): receitas e despesas que se repetem toda semana, todo mês ou todo ano, pagas com conta ou cartão, com data de início e fim opcional.
- Os lançamentos são criados sozinhos: ao abrir o app e também uma vez por dia no servidor, sem duplicar e sem "atrasados" ao retomar uma recorrente pausada.
- Pausar, retomar, editar e excluir recorrentes (o histórico já lançado é mantido).
- Datas de fim de mês respeitadas (ex.: dia 31 cai no último dia de meses mais curtos; 29/02 em anos não bissextos).
- Lançamentos gerados por recorrente mostram um ícone de repetição no extrato.
- Início: novo quadro **Próximos vencimentos**, com as próximas recorrentes e faturas a pagar dos próximos 30 dias (faturas vencidas em destaque).
- Atualização em tempo real entre dispositivos.

## Atualização 1.4.0.0 — 2026-10-12

Gráficos e cartões animados.

- Gráficos de linha (componente `@spell/chart`) com balão que acompanha o dedo ou o mouse:
  - Início: saldo das contas ao longo do mês (dentro do painel de saldo) e gastos acumulados no mês.
  - Lançamentos: gastos por dia do mês escolhido (respeita os filtros).
  - Cartão: histórico do total das faturas mês a mês.
- Cartões com efeito 3D de inclinação e brilho ao passar o mouse (componente `@spell/tilt-card`); no celular o cartão não inclina para não atrapalhar a rolagem.
- Valores no balão dos gráficos também ficam ocultos quando o "olho" está fechado.
- Projeto preparado para componentes shadcn (`components.json`, atalho `@/`).

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
