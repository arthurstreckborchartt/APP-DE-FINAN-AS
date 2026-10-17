# Como publicar o FINANCE na internet

Este guia leva o app do seu computador para um endereço na internet, que você
pode abrir no celular e no PC e instalar como aplicativo. Não precisa saber
programar: são cliques em sites. Reserve uns 30 minutos (mais uns 20 se for
configurar e-mail próprio e o login com Google).

Você vai usar três sites:

- **Vercel** (vercel.com) — onde o app fica hospedado. É grátis para uso pessoal.
- **Supabase** (supabase.com) — onde ficam os dados e as contas. Você já usa.
- **GitHub** (github.com) — onde está o código. Você já usa.

> **Sobre segurança:** neste guia você só copia dois valores — o endereço do
> Supabase e a chave **anon** (pública). Nunca cole em lugar nenhum a chave
> `service_role` nem a senha do banco de dados.

---

## 1. Criar a conta na Vercel e importar o projeto

1. Abra **vercel.com** e clique em **Sign Up** (Cadastrar).
2. Escolha **Continue with GitHub** e entre com a sua conta do GitHub.
   Se a Vercel pedir permissão para ver seus repositórios, autorize.
3. No painel da Vercel, clique em **Add New…** → **Project**.
4. Na lista de repositórios, encontre **APP-DE-FINAN-AS** e clique em **Import**.
   - Se ele não aparecer, clique em **Adjust GitHub App Permissions** e libere
     o acesso a esse repositório.
5. Na tela de configuração, a Vercel já reconhece o projeto como **Vite**.
   Não mude nada em *Build Command* nem em *Output Directory* — o arquivo
   `vercel.json` do projeto já cuida disso. **Ainda não clique em Deploy**:
   antes faça o passo 2.

## 2. Informar as duas variáveis do Supabase

Ainda na tela de configuração do projeto na Vercel:

1. Abra a seção **Environment Variables** (Variáveis de ambiente).
2. Adicione a primeira variável:
   - **Name (Nome):** `VITE_SUPABASE_URL`
   - **Value (Valor):** o mesmo valor que está no arquivo `.env.local` do
     projeto, na linha `VITE_SUPABASE_URL=`. (Copie só o que vem depois do `=`.)
3. Adicione a segunda variável:
   - **Name:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** o mesmo valor da linha `VITE_SUPABASE_ANON_KEY=` do `.env.local`.

Se não encontrar o `.env.local`, os mesmos valores estão no Supabase em
**Project Settings → API**: o *Project URL* e a chave **anon public**.

> A chave **anon** é pública por desenho: ela vai dentro do app que roda no
> navegador de qualquer pessoa. Quem protege os dados são as regras de acesso
> (RLS) do banco, que já estão ativas — cada pessoa só enxerga o que é dela e
> dos grupos de que participa.

## 3. Publicar e descobrir o endereço do app

1. Clique em **Deploy** e espere um ou dois minutos.
2. Quando aparecer a tela de parabéns, clique em **Continue to Dashboard**.
3. No painel do projeto, em **Domains**, aparece o endereço do app, algo como
   `https://app-de-finan-as.vercel.app`. **Anote esse endereço** — ele será
   usado nos próximos passos. Neste guia ele aparece como `<endereço>`.
4. Abra o endereço no navegador: a tela de login do FINANCE deve aparecer.
   (Ainda não crie conta por ele; faça antes os passos 4 e 5.)

## 4. Avisar o Supabase sobre o novo endereço

Sem isto, os links dos e-mails (confirmar conta, trocar senha) levariam para o
seu computador em vez do app publicado.

1. Abra o Supabase e entre no projeto do FINANCE.
2. No menu da esquerda, vá em **Authentication** → **URL Configuration**.
3. Em **Site URL**, apague o que estiver lá e cole o `<endereço>` da Vercel
   (por exemplo `https://app-de-finan-as.vercel.app`). Clique em **Save**.
4. Em **Redirect URLs**, clique em **Add URL** e adicione, uma de cada vez:
   - `<endereço>/**` (por exemplo `https://app-de-finan-as.vercel.app/**`)
   - `http://localhost:5173/**` (para o app continuar funcionando no seu computador)
5. Clique em **Save**.

## 5. Fazer os e-mails chegarem

O remetente de e-mail que vem com o Supabase é só para testes: ele **só entrega
para os e-mails da equipe do projeto no Supabase** e manda poucos e-mails por
hora. Para outras pessoas criarem conta, escolha **uma** das opções abaixo.

### Opção A — e-mail próprio com o Resend (recomendada)

1. Abra **resend.com** e crie uma conta grátis.
2. Escolha o remetente:
   - **Se você tem um domínio** (ex.: `meusite.com.br`): em **Domains** →
     **Add Domain**, digite o domínio e siga as instruções para adicionar os
     registros DNS no site onde comprou o domínio. Espere o status ficar
     **Verified**.
   - **Se não tem domínio:** dá para testar com o domínio de teste do Resend
     (`onboarding@resend.dev`), mas ele também só entrega para o seu próprio
     e-mail. Para uso de verdade, é preciso um domínio verificado.
3. Em **API Keys** → **Create API Key**, dê um nome (ex.: `supabase`), permissão
   **Sending access**, e clique em **Add**. Copie a chave mostrada (começa com
   `re_`). Ela só aparece uma vez — cole direto no Supabase no próximo item e
   não guarde em outro lugar.
4. No Supabase, vá em **Authentication** → **Emails** → **SMTP Settings** e
   ligue **Enable Custom SMTP**. Preencha:
   - **Sender email:** um endereço do seu domínio verificado (ex.: `nao-responda@meusite.com.br`)
   - **Sender name:** `FINANCE`
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** a chave `re_…` que você copiou
5. Clique em **Save**. Para conferir, crie uma conta de teste no app com outro
   e-mail seu e veja se a mensagem de confirmação chega.

### Opção B — desligar a confirmação de e-mail (só entre conhecidos)

Se o app vai ser usado só por você e pessoas de confiança, dá para pular a
confirmação por e-mail:

1. No Supabase, vá em **Authentication** → **Sign In / Providers** → **Email**.
2. Desligue **Confirm email** e salve.

Assim a conta já entra direto depois do cadastro. Atenção: sem e-mail
configurado, o **"Esqueci minha senha"** também não chega para outras pessoas.

## 6. (Opcional) Entrar com Google

O botão **"Continuar com Google"** aparece sozinho nas telas de login e de
cadastro assim que o Google é ligado no Supabase. Se não quiser, pule este passo.

1. Abra **console.cloud.google.com** e entre com sua conta Google.
2. No topo, clique no seletor de projetos → **New Project**, dê o nome
   `FINANCE` e clique em **Create**. Confira que ele ficou selecionado.
3. Vá em **APIs & Services** → **OAuth consent screen** (Tela de consentimento):
   - Escolha o tipo **External** (Externo).
   - Preencha o nome do app (`FINANCE`), seu e-mail de suporte e seu e-mail de
     contato. Salve e avance até o fim.
   - Enquanto o app estiver em modo de teste, adicione em **Test users** os
     e-mails de quem vai usar — ou clique em **Publish app** para liberar para todos.
4. Vá em **APIs & Services** → **Credentials** → **Create Credentials** →
   **OAuth client ID**:
   - **Application type:** **Web application** (Aplicativo da Web).
   - **Name:** `FINANCE`.
   - Em **Authorized redirect URIs**, clique em **Add URI** e cole exatamente:
     `https://tfvnytofxrskanudhwjj.supabase.co/auth/v1/callback`
   - Clique em **Create**. Aparecem o **Client ID** e o **Client Secret**.
5. No Supabase, vá em **Authentication** → **Sign In / Providers** → **Google**:
   - Ligue **Enable Sign in with Google**.
   - Cole o **Client ID** e o **Client Secret** do passo anterior e salve.
6. Recarregue a tela de login do app: o botão **"Continuar com Google"** aparece.
   (Pode levar até uma hora para aparecer em um navegador que já tinha o app aberto.)

> O Client Secret é secreto: cole só no Supabase. Não coloque no código, no
> GitHub nem na Vercel.

## 7. Instalar no celular e no computador

Abra o `<endereço>` do app e:

- **Android (Chrome):** toque no menu **⋮** → **Instalar app** (ou
  **Adicionar à tela inicial**). O app também pode mostrar um aviso
  "Instalar" na própria tela.
- **iPhone (Safari):** toque em **Compartilhar** (o quadrado com a seta para
  cima) → **Adicionar à Tela de Início** → **Adicionar**.
- **PC (Chrome ou Edge):** clique no ícone de instalar que aparece no lado
  direito da barra de endereço (um monitor com uma seta) → **Instalar**.

Depois disso o FINANCE abre como um aplicativo, com ícone próprio.

## 8. (Opcional) Usar um domínio próprio

Se você tiver um domínio (ex.: `financas.meusite.com.br`):

1. Na Vercel, abra o projeto → **Settings** → **Domains** → digite o domínio e
   clique em **Add**.
2. A Vercel mostra os registros DNS que você precisa criar no site onde comprou
   o domínio. Crie-os e espere a Vercel mostrar **Valid Configuration**.
3. **Volte ao passo 4** e troque o endereço `*.vercel.app` pelo novo domínio:
   - **Site URL** = `https://financas.meusite.com.br`
   - adicione `https://financas.meusite.com.br/**` em **Redirect URLs**
     (pode manter o endereço da Vercel também).

## 9. Atualizações daqui para frente

Não precisa repetir nada disto. Toda vez que uma alteração for enviada para a
branch **main** no GitHub, a Vercel publica a nova versão sozinha em um ou dois
minutos. Quem já tem o app aberto recebe a atualização na próxima vez que abrir.

Se algo der errado numa publicação, no painel da Vercel, em **Deployments**,
dá para abrir uma versão anterior e clicar em **Promote to Production** para
voltar a ela.
