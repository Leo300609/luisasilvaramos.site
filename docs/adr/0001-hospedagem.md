# ADR 0001 · Hospedagem

Status: **Aceito** (Leo, 27/11/2026) · Substitui a proposta inicial (Vercel Pro)

## Contexto

O site é comercial (vende atendimentos). O orçamento pede R$ 0 no início. O sistema precisa de
tarefas agendadas de hora em hora.

## Alternativas

| Opção              | Custo      | Por que não / por que sim                                     |
| ------------------ | ---------- | ------------------------------------------------------------- |
| Vercel Hobby       | R$ 0       | **Proíbe uso comercial**: conta pode ser pausada; cron 1×/dia |
| Vercel Pro         | US$ 20/mês | Melhor DX, mas custo fixo                                     |
| **Netlify Free**   | R$ 0       | Uso comercial permitido; 300 créditos/mês; previews grátis    |
| Cloudflare Workers | US$ 0–5    | Limites de CPU e adaptador Next.js com restrições             |
| VPS                | ≈ €5/mês   | Operação manual (patches, TLS, backup)                        |

## Decisão

Netlify Free. Código **portátil**: nada específico do provedor no domínio da aplicação.
Tarefas agendadas por Netlify Scheduled Functions (ADR 0007).

## Consequências

- Créditos (valores de 27/11/2026): deploy de produção = 15, banda = 20/GB, 10 mil requisições = 2,
  compute = 10/GB-hora. Estimativa para este site: 100 a 150 créditos/mês.
- **Risco:** estourar os créditos **suspende o site até o mês seguinte**. Mitigações: produção só
  recebe deploy em lotes; páginas públicas estáticas (sem compute); alerta de consumo a 70%;
  gatilho de upgrade documentado no runbook.
- Migrar para Vercel Pro ou Netlify Pro é troca de configuração (`netlify.toml` / variáveis).

## Fontes

- https://vercel.com/docs/limits/fair-use-guidelines
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
