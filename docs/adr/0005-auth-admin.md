# ADR 0005 · Autenticação do painel

Status: Aceito (Fase 5a) · Data: 2026-11-28

## Contexto

Requisitos: senha com hash forte, 2FA (P27: TOTP), recuperação de senha, bloqueio por tentativas, "manter conectada", sessão revogável e "sair de todos os dispositivos", trilha de auditoria (ASVS L2, V2/V3/V7).

## Decisão

**Implementação própria, pequena e testada**, seguindo o _Copenhagen Book_ e o ASVS. O ADR anterior previa o Better Auth, com esta opção como reserva. Trocamos pelos motivos abaixo:

- O painel tem 1 ou 2 usuárias e nenhum cadastro público. Uma biblioteca inteira traria rotas, tabelas e superfície de ataque que não usamos.
- O Better Auth precisaria de adaptações para o fluxo de 2 etapas com sessão "pendente" e para a CSP com nonce. O código próprio tem cerca de 500 linhas e cobertura de teste completa.
- Não usamos nenhum módulo nativo. O `@node-rs/argon2` exigiria binário por plataforma no bundle da Netlify. Usamos o `scrypt` do próprio Node.

Detalhes:

| Item                | Escolha                                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hash de senha       | `scrypt` N=2^17, r=8, p=1 (OWASP). O formato guarda os parâmetros e é reprocessado no login se ficarem fracos.                                                                                       |
| Política de senha   | Mínimo de 12 caracteres, sem regras de composição (NIST 800-63B). Recusa senha que contém o e-mail e as óbvias.                                                                                      |
| Usuária inexistente | Calcula um hash "fantasma": mesma resposta e mesmo tempo, sem enumeração.                                                                                                                            |
| 2º fator            | TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s, ±1 passo) com segredo **cifrado** (AES-GCM, ADR 0009). O último passo aceito é guardado, então o código não pode ser reutilizado.                            |
| Recuperação         | 10 códigos de uso único, mostrados uma vez. Só o SHA-256 fica no banco.                                                                                                                              |
| Sessão              | Token aleatório de 256 bits. No banco fica só o SHA-256. Cookie `__Host-lsr_admin` em produção, com HttpOnly, Secure e SameSite=Strict.                                                              |
| Sessão pendente     | Depois da senha, vale 10 min e só serve para o 2º fator. Ao concluir, um **token novo** é emitido (contra fixação de sessão).                                                                        |
| Duração             | Sem "manter conectada": 12 h no máximo e 2 h de inatividade, com cookie de sessão do navegador. Com "manter conectada": 30 dias, renovados com o uso.                                                |
| Bloqueio            | 5 erros de senha por conta ou 20 por IP em 15 min geram bloqueio de 5 min. 5 códigos errados derrubam a sessão pendente. As chaves de contagem são HMAC (AUTH_SECRET), sem e-mail ou IP em claro.    |
| Reset de senha      | Link de uso único, válido por 30 min, gerado **na hora do envio** (outbox, ADR 0006) e passado por cookie (nada de token na URL final). Desconecta todas as sessões. **O 2FA continua obrigatório.** |
| Auditoria           | `audit_log` append-only (trigger): login, falhas, 2FA, logout, reset, confirmar e recusar. IP como HMAC, sem dados pessoais.                                                                         |
| CSRF                | Server Actions (o Next compara Origin e Host) e SameSite=Strict.                                                                                                                                     |
| Contas              | Sem cadastro pelo site. `npm run admin -- criar` cria a conta e o 2FA é configurado no primeiro login (QR gerado no servidor). Leo é o admin de emergência (P28): `resetar-2fa` e `desativar`.       |

## 2FA por e-mail vs TOTP

Código por e-mail divide o canal com o reset de senha (os dois fatores viram um). Escolhemos TOTP. O e-mail fica só para o reset de senha.

## Consequências

- Manter esse código é responsabilidade nossa. Mitigação: testes unitários com os vetores dos RFCs e testes de banco e E2E do fluxo inteiro.
- O limite de tentativas usa o Postgres (sem Redis). Com o tráfego do painel, isso basta. O rate limit do site público fica para a Fase 4c.
