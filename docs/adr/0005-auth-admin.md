# ADR 0005 · Autenticação do painel
Status: Proposto (aguarda P27) · Data: 2026-11-27

## Contexto
Requisitos: Argon2id, 2FA, recuperação de senha, bloqueio por tentativas, "manter conectada", logout global e sessão revogável. O Auth.js com Credentials obriga sessão JWT (não revogável no servidor).

## Alternativas
- Auth.js
- **Better Auth** (sessão no banco, plugin 2FA TOTP + backup codes, adapter Drizzle, hash de senha customizável)
- Implementação própria seguindo o "Copenhagen Book" com @oslojs

## Decisão
Better Auth com:
- Argon2id (`@node-rs/argon2`, m=19 MiB, t=2, p=1, conforme OWASP);
- TOTP + 10 códigos de recuperação;
- sessões no banco;
- rate limit próprio no Redis.

Se na Fase 5 algum requisito não for atendido, fazemos a implementação própria com @oslojs.

## 2FA por e-mail vs TOTP
Código por e-mail divide o canal com o reset de senha (os dois fatores viram um). TOTP é recomendado. O e-mail fica só como alerta de "novo login".
