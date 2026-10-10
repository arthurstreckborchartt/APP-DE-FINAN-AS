# App de Finanças — Especificação de Design (v1)

Data: 2026-10-10
Status: aguardando revisão

## 1. Objetivo

PWA (Progressive Web App) instalável no celular (Android/iOS) e no PC para gestão de
finanças pessoais e de grupos. Cada pessoa gere as próprias finanças e pode criar ou
entrar em grupos para ver totais compartilhados, sem perder a visão individual de
quanto e em que cada membro gasta.

Fora do escopo da v1 (projetos futuros): gestão de empresas, conversão de câmbio,
lançamentos offline, transferências entre contas, importação de extratos.

## 2. Plataforma e tecnologia

| Camada | Escolha |
|---|---|
| Frontend | React + TypeScript, Vite, Tailwind CSS |
| PWA | `vite-plugin-pwa` (manifest, service worker, cache da interface) |
| Dados no cliente | `@supabase/supabase-js` + TanStack Query |
| Rotas | React Router |
| Gráficos | Recharts |
| Idiomas | i18next — `pt-BR`, `pt-PT`, `en`, `es` |
| Backend | Supabase: PostgreSQL, Auth, Realtime, `pg_cron` |
| Hospedagem | Vercel (frontend) + Supabase (backend) |
| Testes | Vitest (lógica), testes SQL de RLS, Playwright (ponta a ponta) |

Projeto Supabase: `tfvnytofxrskanudhwjj`. Migrations versionadas em `supabase/migrations/`.

## 3. Conceitos e regras de negócio

### 3.1 Pessoas
- Cadastro por e-mail/senha. Login com Google é opcional e depende de configurar o
  OAuth no Google Cloud na fase de publicação.
- Perfil: nome, idioma, moeda principal, tema (claro/escuro/sistema).
- Primeiro acesso: assistente pede idioma, moeda, primeira conta e (opcional) primeiro cartão.

### 3.2 Moedas
- Valores armazenados como **inteiro em centavos** (`bigint`) + código ISO 4217.
- Contas, cartões e grupos têm moeda própria. Lançamento herda a moeda da conta/cartão.
- Sem conversão de câmbio. Totais com moedas diferentes são mostrados separados por moeda.

### 3.3 Contas
- Tipos: dinheiro/carteira, conta corrente, poupança, outra.
- Saldo = saldo inicial + receitas − despesas da conta − pagamentos de fatura.
- Contas podem ser arquivadas (somem das listas, histórico preservado).

### 3.4 Categorias
- Categorias padrão do sistema (receita e despesa), com nome traduzido por chave i18n.
- Cada pessoa pode criar categorias próprias (nome, ícone, cor, tipo).
- Membros de um grupo podem ler nome/ícone/cor das categorias usadas em lançamentos do grupo.

### 3.5 Lançamentos
- Campos: dono, tipo (receita/despesa), valor, data, categoria, descrição, origem
  (exatamente uma: conta **ou** cartão; receitas só em conta), grupo (opcional).
- Marcar para um grupo exige que a moeda do lançamento seja igual à do grupo e que o
  dono seja membro do grupo.
- Só o dono edita ou exclui o próprio lançamento.

### 3.6 Cartões de crédito
- Campos: nome, limite, dia de fechamento (1–28), dia de vencimento (1–28), moeda, cor.
- **Fatura**: identificada por cartão + mês de referência (mês em que fecha).
  - Compra com dia < dia de fechamento → fatura que fecha neste mês.
  - Compra com dia ≥ dia de fechamento → fatura que fecha no mês seguinte.
  - Vencimento: se dia de vencimento > dia de fechamento, no mesmo mês do fechamento;
    senão, no mês seguinte.
- **Parcelamento**: compra em N parcelas (1–48). Valor dividido em centavos; o resto da
  divisão vai na 1ª parcela. A parcela k cai na fatura k−1 meses depois da fatura da compra.
- **Limite disponível** = limite − soma das parcelas de faturas ainda não pagas.
  A compra reserva o valor total no momento do lançamento. Calculado no banco (view).
- **Pagar fatura**: pagamento integral, escolhendo a conta de origem. Marca a fatura como
  paga, debita a conta e libera o limite. O pagamento **não** conta como despesa nos
  relatórios (as despesas já foram contadas nas parcelas).
- Estados da fatura: aberta → fechada → paga (ou vencida, se fechada e não paga após o vencimento).
- Excluir ou editar uma compra com parcelas em fatura já paga é bloqueado.

### 3.7 Competência (o que conta em cada mês)
- Lançamento em conta: conta no mês da data.
- Compra no cartão: **cada parcela** conta no mês da data da compra + (k−1) meses.
  Compra à vista = 1 parcela no mês da compra.

### 3.8 Recorrentes
- Campos: tipo, valor, categoria, descrição, origem (conta ou cartão), grupo opcional,
  frequência (semanal, mensal, anual), data de início, data de fim opcional.
- Tarefa diária (`pg_cron`, função SQL) gera os lançamentos devidos até hoje. Cada
  ocorrência tem chave única (recorrente + data), então nunca duplica.
- Ao criar um recorrente, as ocorrências até hoje são geradas na hora.
- Editar um recorrente afeta só ocorrências futuras; pausar e retomar são permitidos.

### 3.9 Grupos
- Qualquer pessoa cria um grupo (nome, moeda, ícone). Quem cria é administrador.
- Convite por link/código com validade de 7 dias, reutilizável até expirar ou ser revogado.
- Administrador remove membros e revoga convites; membro pode sair.
- Lançamentos de quem saiu continuam no histórico do grupo.
- O administrador só sai se excluir o grupo ou passar a administração a outro membro.
- Membros veem **apenas** lançamentos marcados para o grupo, nunca contas, cartões ou
  lançamentos pessoais dos outros.
- Tela do grupo: total do mês, ranking de gasto por membro, gastos por categoria e por
  membro, lista de lançamentos do grupo, orçamento do grupo.

### 3.10 Orçamentos e metas
- **Orçamento**: limite mensal por categoria, pessoal ou do grupo (soma os lançamentos do
  grupo de todos os membros). Avisos visuais a 80% e 100%.
- **Meta de poupança**: nome, valor-alvo, prazo opcional, valor guardado (aportes manuais).
  Mostra progresso e quanto falta por mês até o prazo.

### 3.11 Relatórios
- Gastos por categoria (pizza/barras), evolução mensal (receitas × despesas), filtro por
  período, conta, cartão e grupo. No grupo: comparação entre membros.

## 4. Telas

Layout responsivo: no celular, barra inferior (Início, Lançamentos, **+**, Cartões, Grupos)
com menu "Mais" no cabeçalho; no PC/tablet (≥ 1024 px), menu lateral fixo e conteúdo em colunas.

1. **Início** — saldo das contas, gasto do mês × orçamento, cartões com barra de limite,
   próximas contas/faturas a vencer, últimos lançamentos.
2. **Lançamentos** — lista por mês, filtros, busca, editar/excluir.
3. **Novo lançamento (+)** — teclado numérico grande, tipo, categoria, conta/cartão,
   parcelas, data, grupo. Pré-preenche com as escolhas mais usadas.
4. **Cartões** — lista; detalhe com fatura atual e futuras, parcelas, limite, "Pagar fatura".
5. **Grupos** — lista; detalhe conforme 3.9; convidar membros.
6. **Relatórios** — conforme 3.11.
7. **Mais/Configurações** — contas, recorrentes, orçamentos, metas, categorias, perfil,
   idioma, moeda, tema, sair.
8. **Autenticação e boas-vindas** — login, cadastro, recuperar senha, assistente inicial.
9. **Entrar no grupo** — página aberta pelo link de convite.

Instalação: prompt "Instalar app" (Android/PC); no iOS, instrução "Compartilhar → Adicionar
à Tela de Início". Tema claro/escuro.

## 5. Modelo de dados (resumo)

- `profiles` (id = auth.users.id, name, locale, currency, theme)
- `accounts` (user_id, name, type, currency, initial_balance, archived)
- `categories` (user_id nulo = sistema, kind, name ou i18n_key, icon, color)
- `cards` (user_id, name, limit_amount, closing_day, due_day, currency, color, archived)
- `invoices` (card_id, reference_month, closing_date, due_date, paid_at, payment_account_id)
- `transactions` (user_id, kind, amount, currency, date, category_id, description,
  account_id | card_id, group_id, installments_count, recurring_id, recurring_date)
- `installments` (transaction_id, number, amount, invoice_id, competence_month)
- `recurring` (user_id, kind, amount, category_id, description, account_id | card_id,
  group_id, frequency, start_date, end_date, paused)
- `groups` (name, currency, icon, created_by)
- `group_members` (group_id, user_id, role: admin|member, joined_at, left_at)
- `group_invites` (group_id, token, expires_at, revoked)
- `budgets` (user_id | group_id, category_id, amount)
- `goals` (user_id, name, target_amount, saved_amount, deadline)
- Views: `card_limits` (limite disponível), `account_balances`, `monthly_summary`.

Regras críticas (fatura, parcelas, limite, recorrentes) vivem em funções SQL e são
espelhadas em funções TypeScript puras testadas com Vitest, usadas para pré-visualização na UI.

## 6. Segurança

- Row Level Security em todas as tabelas.
- Dono lê/escreve os próprios registros.
- Membro ativo de um grupo lê os lançamentos com aquele `group_id`, os perfis (nome) dos
  outros membros e as categorias referenciadas. Nunca lê contas, cartões ou faturas alheias.
- Entrada em grupo apenas via função `join_group(token)` que valida o convite.
- Só a chave pública (anon) fica no frontend; nenhuma chave secreta no repositório.

## 7. Tempo real e offline

- Realtime do Supabase nas tabelas de lançamentos/faturas: limite, saldos e totais do grupo
  atualizam na hora em todos os aparelhos.
- Offline: a interface abre e mostra os últimos dados em cache; criar/editar exige conexão.

## 8. Testes

- Vitest: cálculo de fatura, divisão de parcelas, competência, limite, geração de recorrentes.
- Testes de RLS: membro de grupo não acessa dados pessoais de outro membro.
- Playwright: cadastro → conta → cartão → compra parcelada → conferir limite → grupo.

## 9. Ordem de construção

1. Base: projeto, login, perfil, i18n, tema, layout responsivo, PWA instalável.
2. Contas, categorias, lançamentos.
3. Cartões, faturas, parcelas, limite em tempo real.
4. Recorrentes.
5. Grupos e convites.
6. Orçamentos, metas, relatórios e painel inicial completo.
7. Publicação (Vercel + Supabase, Google OAuth opcional).
