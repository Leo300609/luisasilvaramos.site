# ADR 0011 · Content Security Policy híbrida

Status: **Aceito** (Fase 1) · Data: 2026-11-27

## Contexto

O briefing pede "CSP estrita com nonces". No Next.js 16, CSP com nonce **obriga renderização
dinâmica** de cada página (o nonce muda a cada requisição): sem página estática, sem cache de CDN,
sem ISR (documentação oficial, guia "Content Security Policy").

Consequências se aplicássemos nonce no site público inteiro:

- cada visita executaria uma função no servidor, gastando créditos de compute da Netlify (risco de
  suspensão, ADR 0001);
- pior tempo de resposta (TTFB), o que ameaça a meta de Lighthouse ≥ 95 e LCP < 2,5 s.

## Decisão

| Área                                        | Renderização | CSP                                                                                                                              |
| ------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `/agendar/**`, `/admin/**`, `/a/**` (token) | dinâmica     | **nonce por requisição + `strict-dynamic`**, sem `unsafe-inline` em scripts, `no-store`, `noindex` (admin, minha agenda, tokens) |
| Site público, páginas legais, 404           | estática     | sem nonce: `script-src 'self' 'unsafe-inline'` (necessário para os scripts inline do Next)                                       |

Comum a todas: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
`frame-ancestors 'none'` e `upgrade-insecure-requests`, além de HSTS, nosniff, Referrer-Policy,
Permissions-Policy e COOP.

## Por que o risco residual é aceitável no site público

As páginas estáticas **não renderizam conteúdo enviado por visitantes**. O conteúdo editável vem
só do painel (admin autenticado com 2FA) e é escapado pelo React. A superfície de XSS está nas áreas
com formulários e dados de clientes, e essas têm a CSP estrita.

## Implementação

- `src/lib/security/headers.ts`: monta a política (testada em `tests/unit/security-headers.test.ts`).
- `next.config.ts`: cabeçalhos estáticos (exclui as áreas dinâmicas).
- `src/proxy.ts`: nonce por requisição nas áreas dinâmicas.
- E2E verifica os cabeçalhos e que o nonce muda a cada requisição.

## Revisão futura

Se o Next estabilizar SRI/hashes para scripts inline em páginas estáticas, migrar o site público para
uma política sem `unsafe-inline`.
