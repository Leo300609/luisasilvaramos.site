# ADR 0003 · PostgreSQL (Neon) + Drizzle ORM
Status: Proposto · Data: 2026-11-27

## Contexto
A regra anti-conflito precisa de `EXCLUDE USING gist` sobre `tstzrange` (extensão `btree_gist`). As migrations têm de ser versionadas e revisáveis.

## Alternativas
- Prisma: o schema não expressa EXCLUDE (exigiria SQL manual mesmo assim).
- **Drizzle**: SQL explícito e migrations em arquivo.
- Kysely

## Decisão
- Neon Postgres no plano Free.
- Drizzle + driver `@neondatabase/serverless` (Pool via WebSocket, que suporta transações).
- Constraint, trigger e permissões em migrations SQL revisadas.
- Dois papéis: `app_rw` (sem DDL, sem UPDATE/DELETE no `audit_log`) e `migrator`.
- Branch do Neon por preview.

## Consequências
1 GB de storage e 6 h de restore no free, complementados por dump diário cifrado. Compute de 100 CU-h, que exige não manter o banco acordado (jobs de hora em hora, health sem banco).
