# Segurança

## Como reportar uma vulnerabilidade

Encontrou uma falha de segurança no site ou no sistema de agendamento? **Não abra uma issue pública.**
Use o reporte privado do GitHub: aba **Security → Report a vulnerability** deste repositório.
(Até o go-live haverá também um endereço dedicado, `seguranca@luisasilvaramos.com.br`.)

Inclua:

- o que você encontrou e onde (URL, passo a passo);
- o impacto que imagina;
- se possível, como reproduzir.

Responderemos em até 5 dias úteis. Pedimos que não acesse, altere ou divulgue dados de clientes.

## Práticas adotadas

O detalhamento (modelo de ameaças STRIDE e checklist OWASP ASVS nível 2) fica em `docs/security/`
e é construído ao longo das fases. Resumo:

- Cabeçalhos de segurança em todas as respostas (HSTS, CSP, nosniff, frame-ancestors, Permissions-Policy).
- CSP com _nonce_ por requisição nas áreas dinâmicas (agendamento e painel).
- Variáveis de ambiente validadas no boot; segredos só em variáveis do provedor, nunca no repositório.
- Logs estruturados sem dados pessoais.
- Dependências auditadas na CI (`npm audit`) e atualizadas pelo Dependabot.
