# ADR 0010 · Rate limit e anti-bot

Status: Proposto · Data: 2026-11-27

## Decisão

`@upstash/ratelimit` (janela deslizante) por IP e por identificador:

| Endpoint          | Limite                                   |
| ----------------- | ---------------------------------------- |
| login             | 5 / 5 min, depois bloqueio exibido       |
| 2FA               | 5 / 5 min                                |
| recuperar senha   | 3 / h                                    |
| criar agendamento | 5 / h por IP e pendentes ≤ 2 por contato |
| contato           | 3 / h                                    |
| minha agenda      | 5 / h                                    |

- Cloudflare Turnstile no agendamento e no contato, além de honeypot.
- Se o Redis cair: _fail-closed_ no login e _fail-open_ com limite em memória no público. Nunca "tela branca".
