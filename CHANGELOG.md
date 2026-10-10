# Histórico de atualizações

Cada atualização recebe um número de versão `MAIOR.MENOR.CORREÇÃO.AJUSTE` e uma tag no Git (`v1.0.0.0`, `v1.1.0.0`…).

- **MAIOR** — mudança grande na estrutura do app.
- **MENOR** — nova etapa ou funcionalidade (ex.: lançamentos, cartões, grupos).
- **CORREÇÃO** — correção de erro.
- **AJUSTE** — pequenos ajustes de texto, visual ou configuração.

---

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
