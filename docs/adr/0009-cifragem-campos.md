# ADR 0009 · Cifragem de campos sensíveis

Status: **Aceito** (Fase 3) · Data: 2026-11-27

## Decisão

Os campos endereço, complemento, observações, alergias, notas internas e segredo TOTP usam AES-256-GCM (Node `crypto`), com nonce aleatório e formato `v1:<iv>:<ct>:<tag>`.

- Chaves em `ENC_KEYS` (várias versões) e `ENC_ACTIVE_KEY`.
- Um job regrava com a chave nova, o que permite rotação.
- A busca do admin é só por nome e código, que não são cifrados.

Cada valor é amarrado ao seu campo por AAD (`bookings.address` etc.): um valor cifrado copiado para outra coluna não decifra.

## Consequências

Um vazamento do banco sem a variável de ambiente não expõe esses dados. Não dá para filtrar por endereço no SQL (aceitável).
