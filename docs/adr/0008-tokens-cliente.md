# ADR 0008 · Acesso da cliente a "Minha agenda"
Status: Proposto · Data: 2026-11-27

## Decisão
- Token de 32 bytes (CSPRNG, base64url); o banco guarda só o SHA-256.
- Escopo `manage` para um agendamento.
- Expira 30 dias depois do horário do atendimento; é revogado ao cancelar.
- Link `/a/{token}`: valida, grava cookie `HttpOnly; Secure; SameSite=Lax; Path=/agendar` e redireciona para a URL limpa.
- Para recuperar o acesso, a cliente informa e-mail ou WhatsApp e recebe a resposta genérica + e-mail com o link.
- Rate limit por IP e por contato.
- O código `LSR-0001` é só um rótulo; **nunca** serve de credencial.

## Consequências
Sem conta nem senha para a cliente. Quem tem o e-mail dela acessa, o que é aceitável para o risco.
