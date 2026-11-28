# ADR 0010 · Limite de requisições e anti-bot

Status: Aceito (Fase 4c) · Data: 2026-11-28

## Decisão

- **Limite por IP no Postgres** (`rate_limits`, janela fixa, um upsert por requisição). Escolhemos isso no lugar do Upstash previsto: o volume é pequeno e ninguém precisa criar conta nem pagar por outro serviço. O IP é guardado só como HMAC, e o job de hora em hora apaga as janelas antigas.

| Rota                                        | Limite por IP                                        |
| ------------------------------------------- | ---------------------------------------------------- |
| Cotação (CEP)                               | 20 a cada 10 min                                     |
| Horários                                    | 150 a cada 10 min                                    |
| Criar agendamento                           | 8 por hora                                           |
| Cancelar, remarcar e .ics da "Minha agenda" | 30 por hora                                          |
| "Perdi o link"                              | 5 por hora (e mais 3 por cliente por hora, ADR 0006) |
| Login do painel                             | Bloqueio próprio, por conta e por IP (ADR 0005)      |

- Passou do limite: resposta **429** com `Retry-After` e mensagem em português. Se o próprio limitador falhar, a requisição passa (_fail open_): uma instabilidade no banco não pode derrubar o agendamento.
- Continuam valendo as defesas que já existiam: mesma origem obrigatória (CSRF), idempotência, limite de pedidos pendentes por contato, cotação assinada (HMAC).
- **Turnstile (Cloudflare) fica para depois:** entra se aparecer abuso de verdade, junto com a mudança do DNS para a Cloudflare (R7). Exige conta e chaves.

## Consequências

Cada requisição pública faz uma escrita a mais no banco. Com o tráfego esperado, o impacto é desprezível.
