# ADR 0012 · Observabilidade

Status: **Aceito** (Fase 1, parcial) · Data: 2026-11-27

## Decisão

**Fase 1 (feito):**

- Logger estruturado próprio (JSON por linha, `src/lib/observability/log.ts`), com **redação de
  dados pessoais**: chaves sensíveis viram `[redacted]` e e-mails, CPFs e telefones em texto livre
  são mascarados. Testado.
- `onRequestError` (instrumentation) registra erros de servidor sem cabeçalhos nem query string.
- `GET /api/health` raso (sem banco) para o monitor externo.
- Validação de ambiente no boot e no build.

**Fase 3 (adiado de propósito):** Sentry (plano gratuito) entra quando houver banco e regras de
negócio. Na Fase 1 não há código de servidor relevante para monitorar, e o SDK acrescenta
configuração e peso ao bundle. O `SENTRY_DSN` já está previsto no `.env.example`.

**Fase 8:** monitor de uptime externo (verificar se o plano gratuito escolhido permite uso
comercial) e alertas.
