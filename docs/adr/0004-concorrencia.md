# ADR 0004 · Garantia contra reserva dupla

Status: Proposto · Data: 2026-11-27

## Decisão

1. `bookings.occupied tstzrange` (gerado a partir de início, fim e buffer).
2. `EXCLUDE USING gist (occupied WITH &&) WHERE status IN ('pendente','confirmado')`.
3. Criar/reagendar numa transação com `pg_advisory_xact_lock(<agenda>)`, revalidando a disponibilidade completa: almoço, bloqueios, expediente e antecedência, coisas que a EXCLUDE não enxerga.
4. Erro 23P01 vira `SLOT_TAKEN`, que a UI mostra como "Esse horário acabou de ser reservado", preservando os dados.
5. Uma `idempotency_key` única por tentativa de envio (gerada no cliente e validada no servidor) faz o clique duplo devolver o mesmo agendamento.

## Consequências

Escritas na agenda ficam serializadas, o que é irrelevante neste volume. Há teste de integração com N reservas paralelas contra Postgres real.
