# Etapa 7 — Publicação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o FINANCE pronto para uso real na internet: hospedado na Vercel (deploy automático a cada push na `main`), com cabeçalhos de segurança, página de erro amigável, grupo que nunca fica sem administrador, login com Google opcional (aparece sozinho quando o provedor for ligado no Supabase) e um guia em português para a pessoa concluir as configurações nos painéis.

**Architecture:** `vercel.json` com rewrite de SPA, cache correto do service worker e CSP restrita ao próprio domínio + Supabase. Rota raiz ganha `errorElement`. Botão "Continuar com Google" lê `GET /auth/v1/settings` (público) e só aparece se `external.google` estiver ligado; o retorno do OAuth respeita o convite pendente (`readReturnTo`). Migration com gatilho de sucessão de administrador. Guia `docs/publicacao.md` com os passos que só a pessoa pode fazer (contas, chaves, painéis).

**Tech Stack:** Vercel (static + rewrites), Supabase Auth, React Router 8, Vite PWA.

**Spec:** `docs/superpowers/specs/2026-10-10-app-financas-design.md` §2, §3.1 (Google opcional), §3.9 (admin), §6, §9.7.

## Global Constraints

- Tudo das etapas anteriores (4 idiomas com paridade; es "tú"; DESIGN.md; `import type`; commits com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`).
- Nenhuma chave secreta no repositório nem no chat; só a URL e a chave pública (anon) vão para as variáveis da Vercel.
- Implementadores não rodam `db push`, não criam contas e não alteram painéis (Vercel, Supabase, Google); o controlador aplica a migration e a pessoa faz os passos de painel.
- Supabase do projeto: `https://tfvnytofxrskanudhwjj.supabase.co`.

---

### Task 1: Banco — sucessão de administrador + testes

**Files:** Create `supabase/migrations/20261018000001_admin_succession.sql`, `supabase/tests/08_admin_succession.sql`

- [ ] **Step 1: Migration** (exatamente; corrigir só bugs do dry-run):

```sql
-- Etapa 7: um grupo nunca fica sem administrador.
-- Quando a linha do admin some (conta da pessoa apagada), o membro ativo mais antigo vira admin;
-- se não sobrar ninguém ativo, o grupo é excluído (lançamentos continuam com cada pessoa, sem grupo).
create function public.group_admin_succession() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_next uuid;
begin
  if old.role <> 'admin' or not exists (select 1 from public.groups where id = old.group_id) then
    return null;
  end if;
  select m.user_id into v_next from public.group_members m
    where m.group_id = old.group_id and m.left_at is null
    order by m.joined_at, m.user_id
    limit 1;
  if v_next is null then
    delete from public.groups where id = old.group_id;
  else
    update public.group_members set role = 'admin' where group_id = old.group_id and user_id = v_next;
  end if;
  return null;
end;
$$;
revoke execute on function public.group_admin_succession() from public, anon, authenticated;

create trigger group_members_admin_succession after delete on public.group_members
  for each row execute function public.group_admin_succession();
```

- [ ] **Step 2: Testes** `08_admin_succession.sql` (estilo de `05_groups.sql`): A cria G, B e C entram (B antes de C); apagar o usuário A (como `postgres`, `reset role`, `delete from auth.users`) → B vira admin, C continua membro, só um admin; D cria H sozinho e é apagado → H não existe mais e o lançamento de E (ex-membro que saiu de H antes) continua existindo com `group_id` nulo; excluir o grupo inteiro (admin exclui G) não gera erro (o gatilho ignora porque o grupo já não existe); remover membro comum não muda o admin.
- [ ] **Step 3:** dry-run (migration + 08; migration + 05 e 07); commit (`feat: grupo nunca fica sem administrador`).

---

### Task 2: App pronto para produção — Vercel, página de erro, Google, guia

**Files:** Create `vercel.json`, `src/app/ErrorPage.tsx`, `src/features/auth/useAuthProviders.ts`, `src/features/auth/GoogleButton.tsx`, `docs/publicacao.md`; Modify `src/app/router.tsx`, `src/features/auth/{LoginPage,SignupPage}.tsx`, `src/i18n/locales/*.json`, `index.html` (se faltar `<meta name="description">`), testes.

**Comportamento:**
- `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/((?!assets/|.*\\..*).*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }] },
    { "source": "/workbox-(.*).js", "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }] },
    { "source": "/manifest.webmanifest", "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }] },
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://tfvnytofxrskanudhwjj.supabase.co wss://tfvnytofxrskanudhwjj.supabase.co; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        }
      ]
    }
  ]
}
```

  Conferir com `npm run build && npx vite preview` que nada do app viola a CSP (inline scripts no `index.html`? registro do service worker? fontes?). Se o build gerar script inline (ex.: registro do PWA), trocar para `injectRegister: 'script'`/arquivo externo em vez de afrouxar a CSP; registrar no relatório.
- `ErrorPage` como `errorElement` da rota raiz (e das rotas protegidas): tela calma no estilo de `EmptyState` com título `errors.pageTitle` ("Algo deu errado"), texto `errors.pageBody` ("Tente recarregar a página. Se continuar, volte ao início."), botões "Recarregar" (`errors.reload`) e "Ir para o início" (`errors.home`); em 404 de rota usa o `Navigate` já existente. Sem mostrar stack trace em produção (só `console.error`).
- Google: `useAuthProviders()` faz `fetch(\`${VITE_SUPABASE_URL}/auth/v1/settings\`, { headers: { apikey } })` com TanStack Query (`staleTime` 1 h; falha → sem Google) e devolve `{ google: boolean }`. `GoogleButton` (aparece em Login e Cadastro abaixo do formulário, com divisor "ou") chama `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: \`${window.location.origin}${readReturnTo() ?? '/'}\` } })`; botão secundário com o "G" oficial em SVG inline (cores do Google), texto `auth.google` ("Continuar com Google"). Teste: botão some quando `google` é falso; chama `signInWithOAuth` com `redirectTo` incluindo `/join/<token>` quando há convite pendente.
- i18n (4 idiomas): `errors.pageTitle`, `errors.pageBody`, `errors.reload`, `errors.home`, `auth.google`, `auth.or`.
- `docs/publicacao.md` (português, passo a passo numerado para alguém não técnico): (1) criar conta na Vercel com o GitHub e importar o repositório `APP-DE-FINAN-AS`; (2) variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (mesmos valores do `.env.local`; a chave anon é pública por desenho, protegida pelo RLS); (3) deploy e onde ver o endereço `*.vercel.app`; (4) Supabase → Authentication → URL Configuration: Site URL = endereço da Vercel, Redirect URLs = `<endereço>/**` e `http://localhost:5173/**`; (5) e-mails: o remetente padrão do Supabase só entrega para membros da equipe do projeto e tem limite baixo — configurar SMTP próprio (passo a passo com o Resend: criar conta, verificar domínio ou usar o domínio de teste, gerar chave, colar em Supabase → Authentication → Emails → SMTP Settings) **ou**, para uso só entre conhecidos, desligar "Confirm email"; (6) opcional — Google: criar credencial OAuth no Google Cloud (tela de consentimento, tipo "Aplicativo da Web", URI de redirecionamento `https://tfvnytofxrskanudhwjj.supabase.co/auth/v1/callback`), colar Client ID/Secret em Supabase → Authentication → Providers → Google; o botão aparece sozinho no app; (7) instalar no celular (Android: menu → Instalar app; iPhone: Compartilhar → Adicionar à Tela de Início) e no PC (ícone de instalar na barra do navegador); (8) domínio próprio (opcional) na Vercel e atualizar as URLs do passo 4; (9) cada push na `main` publica sozinho.
- [ ] `npm test`, `npm run build`, `npm run e2e`, conferir `vite preview` sem violações de CSP no console (usar o navegador embutido para abrir a tela de login e o cadastro), commit (`feat: pronto para publicar — Vercel, página de erro, login com Google opcional`).

## Cobertura da especificação (Etapa 7)

| Requisito | Task |
|---|---|
| 9.7 Publicação na Vercel + Supabase | 2 (+ passos da pessoa no guia) |
| 3.1 Google opcional | 2 |
| 3.9 Grupo sempre com admin | 1 |
| 6 Só a chave pública no frontend; cabeçalhos de segurança | 2 |
