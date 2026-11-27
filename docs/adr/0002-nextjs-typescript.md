# ADR 0002 · Next.js (App Router) + TypeScript strict

Status: **Aceito** (Fase 1) · Data: 2026-11-27

## Contexto

O projeto tem páginas públicas estáticas (SEO), um fluxo transacional e um painel, e é mantido por
uma pessoa iniciante.

## Decisão

- Next.js **16.4.6**, React 19.3, Turbopack.
- TypeScript strict com `noUncheckedIndexedAccess`, `noImplicitOverride` e `noFallthroughCasesInSwitch`.
- Tailwind CSS 4 com tokens do design em `@theme`. Breakpoints **substituídos** pelos do design:
  `tablet` = 720 px e `desktop` = 1100 px.
- Fontes **self-hosted** (`next/font/local`, subconjunto latin, OFL): Cormorant Garamond, Jost e Sora.
- `cacheComponents` / PPR **desligados** (o template liga por padrão): são incompatíveis com a CSP
  por nonce das áreas dinâmicas (ver ADR 0011). As páginas públicas continuam estáticas pelo modelo
  clássico.
- `typedRoutes` ligado (links verificados pelo compilador).
- npm como gerenciador. O lockfile foi gerado com npm 11 porque o npm 10 tem um bug com as peer
  deps do Vitest 4. `npm ci` funciona normalmente nas duas versões.

## Consequências

Um repositório e um deploy só. A cada versão nova do Next, ler `node_modules/next/dist/docs` antes de
atualizar (há mudanças incompatíveis frequentes).
