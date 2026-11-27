# ADR 0004 · Garantia contra reserva dupla

Status: **Aceito** (Fase 3) · Data: 2026-11-27

## Decisão

1. `bookings.occupied tstzrange`, calculado por **trigger** (`[início − ida, fim + volta + intervalo)`). Coluna gerada não serve, porque `timestamptz − interval` não é IMMUTABLE no Postgres.
2. `EXCLUDE USING gist (occupied WITH &&) WHERE status IN ('pendente','confirmado')`.
3. Criar/reagendar numa transação com `pg_advisory_xact_lock(<agenda>)`, revalidando a disponibilidade completa: almoço, bloqueios, expediente e antecedência, coisas que a EXCLUDE não enxerga.
4. Erro 23P01 vira `SLOT_TAKEN`, que a UI mostra como "Esse horário acabou de ser reservado", preservando os dados.
5. Uma `idempotency_key` única por tentativa de envio (gerada no cliente e validada no servidor) faz o clique duplo devolver o mesmo agendamento.

## Consequências

Escritas na agenda ficam serializadas, o que é irrelevante neste volume. **Verificado:** 10 conexões paralelas no mesmo horário resultam em 1 sucesso e 9 `slot-taken`; horários sobrepostos (14:00 × 14:30) também; e clique duplo com a mesma chave gera 1 agendamento (`tests/db/concurrency.test.ts`).
