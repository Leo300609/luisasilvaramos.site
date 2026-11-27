# ADR 0002 · Next.js (App Router) + TypeScript strict
Status: Proposto · Data: 2026-11-27

## Contexto
O sistema tem páginas públicas estáticas e de SEO, um fluxo transacional e um painel. A equipe é uma pessoa, iniciante.

## Alternativas
- Next.js
- Remix/React Router
- Astro + API separada
- SvelteKit

## Decisão
Next.js na versão estável atual (confirmada na Fase 1), com:
- Server Components, Server Actions e Route Handlers;
- `strict: true` e `noUncheckedIndexedAccess`;
- Tailwind + Radix/shadcn com os tokens do design;
- `next/font` self-hosted.

## Consequências
Um repositório e um deploy só, com SSG/ISR para o site e lógica sensível sempre no servidor. Ficamos presos ao ritmo de mudanças do Next; as versões são fixadas pelo lockfile.
