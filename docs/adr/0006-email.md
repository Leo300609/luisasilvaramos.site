# ADR 0006 · E-mail transacional

Status: Aceito (Fase 4b) · Data: 2026-11-27

## Decisão

- **Provedor:** Resend (free: 3.000/mês, 100/dia), chamado direto pela API HTTP (sem SDK), com domínio próprio e SPF/DKIM/DMARC (`p=quarantine` e, depois, `reject`).
- **Padrão outbox** (`email_outbox`): a linha é gravada **na mesma transação** da mudança (criar, cancelar, remarcar). O envio roda logo depois da resposta (`after()` do Next) e é retentado com backoff (1, 5, 30, 120 e 360 min; 6 tentativas). Erros permanentes (4xx exceto 429) param na hora. Mensagens com mais de 72 h são descartadas, não enviadas atrasadas.
- **Sem dados pessoais na fila:** a linha guarda só tipo, destinatário (`cliente`/`luisa`) e IDs. O texto é montado na hora do envio, a partir do agendamento.
- **Links da "Minha agenda" gerados no envio:** cada e-mail recebe um token novo. Nenhum token utilizável fica no banco (só o hash, ADR 0008).
- **Envio único:** `SELECT … FOR UPDATE SKIP LOCKED` com lease de 5 min, mais `Idempotency-Key` no Resend (`lsr-<id da linha>`).
- **Alergias nunca vão por e-mail**: a Luísa recebe só o aviso de que existem (dado de saúde, LGPD art. 11).
- **Templates:** funções TypeScript puras (HTML com estilos inline e texto puro), em pt-BR. Trocamos o React Email planejado por isso: são poucos modelos, e evitamos uma dependência e um passo de build.
- **"Perdi o link":** resposta sempre igual (não revela se o e-mail existe), até 3 envios por hora por cliente e intervalo mínimo de 2 min.

## Consequências

- Uma falha do provedor não perde nem atrasa agendamentos.
- Enquanto não houver tarefa agendada (Fase 6), os e-mails que falharem são reenviados na próxima requisição que dispare o envio. A varredura de hora em hora entra na Fase 6.
- O limite diário do Resend será monitorado na Fase 6 (alerta a 80%).
