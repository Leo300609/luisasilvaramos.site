# ADR 0007 · Tarefas agendadas

Status: Aceito (Fase 6) · Data: 2026-11-28 · Substitui a versão de 2026-11-27, que previa o Vercel Cron.

## Decisão

- Uma **Netlify Scheduled Function** (`netlify/functions/hourly.mts`, `@hourly`) chama `POST /api/cron/hourly` com `Authorization: Bearer CRON_SECRET`. Sem o segredo, a rota responde 404.
- Tudo roda **uma vez por hora**, num único job (`src/server/jobs/hourly.ts`):

| Passo                | Regra                                                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expirar pendentes    | Passou do prazo de confirmação (ajuste "Prazo para confirmar"): o pedido vira cancelado (`expirado`), o horário é liberado e a cliente recebe um e-mail.                                        |
| Lembrete da véspera  | A partir das 18h do dia anterior (P33), uma vez por agendamento confirmado e só para quem tem e-mail.                                                                                           |
| Resumo diário        | A partir das 7h, para `EMAIL_ADMIN_NOTIFY`, com os atendimentos do dia, horário de saída e endereço.                                                                                            |
| Fila de e-mails      | Reenvia o que falhou (ADR 0006).                                                                                                                                                                |
| Retenção (LGPD, P24) | Alergias apagadas 30 dias depois do atendimento. Clientes sem atendimento há 2 anos são anonimizadas. Tentativas de login com mais de 30 dias e sessões, links e e-mails vencidos são apagados. |

- **Idempotente:** cada e-mail tem chave de deduplicação. Rodar duas vezes, ou atrasado, não duplica nada.
- **Sem execução dupla:** cada execução vira uma linha em `job_runs`. Se outra começou há menos de 10 min e não terminou, esta pula (_lease_). Um advisory lock de sessão não serve com pool de conexões.
- **Monitoramento:** `job_runs` guarda início, fim, sucesso e o relatório (contagens, sem dados pessoais).

## Por que de hora em hora (e não a cada 5 min)

Manteria o banco do Neon sempre acordado e consumiria o plano gratuito. Para lembretes e expiração, uma hora de precisão basta.

## Consequências

Scheduled Functions só rodam no deploy publicado de produção. Em preview, use `curl` com o segredo (veja o runbook).
