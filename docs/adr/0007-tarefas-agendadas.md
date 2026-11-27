# ADR 0007 · Tarefas agendadas

Status: Proposto (implementação na Fase 6). Atualizado para Netlify (ADR 0001) · Data: 2026-11-27

## Jobs

| Job                 | Frequência                                                 |
| ------------------- | ---------------------------------------------------------- |
| expirar pendentes   | 1 h                                                        |
| outbox              | 1 h, além do envio imediato                                |
| lembrete da véspera | 1 h, idempotente; envia a partir das 18:00 do dia anterior |
| retenção LGPD       | 1×/dia                                                     |
| backup              | 1×/dia, via GitHub Actions                                 |

## Decisão

Vercel Cron (Pro), chamando Route Handlers protegidos por `CRON_SECRET`. Cada execução fica em `job_runs`, com lock para não rodar em dobro e alerta se falhar.

Plano B (sem Pro): Upstash QStash, com 1.000 mensagens/dia no free.

## Por que não de 5 em 5 minutos

Manteria o Neon sempre ativo e estouraria os 100 CU-h do plano gratuito.
