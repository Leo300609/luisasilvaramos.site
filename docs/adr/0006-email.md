# ADR 0006 · E-mail transacional
Status: Proposto · Data: 2026-11-27

## Decisão
- Resend (free: 3.000/mês, 100/dia), com domínio próprio e SPF/DKIM/DMARC (`p=quarantine` e, depois, `reject`).
- Padrão **outbox**: a mensagem é gravada na transação e enviada logo depois. Retry com backoff exponencial; a varredura roda de hora em hora.
- Templates em React Email, em pt-BR.

## Consequências
Uma falha do provedor não perde agendamentos. O limite diário é monitorado e gera alerta a 80%.
