# ADR 0001 · Hospedagem
Status: Proposto (aguarda P1) · Data: 2026-11-27

## Contexto
O site é comercial (vende atendimentos). O sistema precisa de tarefas agendadas pelo menos de hora em hora: expirar pendentes, reenviar e-mails, lembretes e retenção.

## Alternativas
- Vercel Hobby: R$ 0, mas proíbe uso comercial e o cron roda no máximo 1×/dia.
- **Vercel Pro**: US$ 20/mês por usuário, cron até 1/min, preview por PR.
- Netlify Free: R$ 0 e comercial OK, mas o site é suspenso se os 300 créditos acabarem.
- Cloudflare Workers Free: 10 ms de CPU por requisição, inviável para Argon2id e SSR.
- VPS + Coolify: ≈ €5/mês, com operação manual.

## Decisão
Vercel Pro, com 1 usuário.

## Consequências
Custo fixo de ≈ US$ 20/mês. Melhor DX e confiabilidade. Se o Leo recusar o custo, o plano B é Netlify Free + QStash, aceitando o risco de suspensão.

## Fontes
vercel.com/docs/limits/fair-use-guidelines · vercel.com/docs/cron-jobs/usage-and-pricing
