# Runbook

> Documento vivo: cada fase acrescenta seções. Última atualização: Fase 3.

## Ambientes

| Ambiente | Onde                                 | Quando é publicado                   |
| -------- | ------------------------------------ | ------------------------------------ |
| Local    | `npm run dev`                        | Na sua máquina                       |
| Preview  | URL `deploy-preview-N--…netlify.app` | Automaticamente em cada pull request |
| Produção | `luisasilvaramos.com.br`             | A cada merge na `main`               |

O ambiente lógico (`APP_ENV`) vem do `netlify.toml`. Previews **nunca** são indexados (`robots.txt`
bloqueia tudo enquanto `SITE_INDEXABLE` não for `true`, e isso só é aceito em produção).

## Deploy

1. Abra um PR para a `main`. A CI (GitHub Actions) roda lint, tipos, testes, build e E2E.
2. A Netlify publica um _deploy preview_. Confira nele.
3. Com a CI verde, faça o merge. A Netlify publica em produção.
4. Confira `https://luisasilvaramos.com.br/api/health` (deve responder `{"status":"ok"}` com o commit novo).

Custo: deploy de produção consome 15 créditos da Netlify (300/mês no plano gratuito). Deploys de
preview são grátis. Por isso juntamos mudanças e publicamos em lotes.

## Rollback (voltar para a versão anterior)

1. Netlify → **Deploys** → escolha o último deploy bom → **Publish deploy**. Leva segundos e não gasta crédito.
2. Abra um PR revertendo o commit problemático (`git revert <commit>`) para a `main` voltar a refletir produção.

## Health check

- `GET /api/health`: resposta rápida, **sem tocar no banco** (para não acordar o Neon a cada checagem).

## Variáveis de ambiente

Lista completa e explicada em `.env.example`. Para mudar na Netlify: _Site configuration →
Environment variables_. Depois de mudar, faça um novo deploy (variáveis só valem em builds novos).

## Banco de dados

- **Migrações:** `npm run db:migrate` (usa `DATABASE_MIGRATION_URL`). Sempre **retrocompatíveis**:
  primeiro adiciona-se (coluna, tabela), o código novo vai ao ar e só num deploy seguinte se
  remove o que ficou sem uso.
- **Nova migração:** altere `src/server/db/schema.ts` e rode `npm run db:generate`. O que o
  Drizzle não expressa (constraints, triggers) vai num arquivo `--custom`
  (`npx drizzle-kit generate --custom --name nome`). A CI roda `drizzle-kit check` e aplica tudo
  num banco vazio.
- **Seed:** `npm run db:seed` cria os serviços (seguro em produção). `-- --demo` cria agendamentos
  fictícios e é recusado em produção.
- **Pausar agendamentos** (emergência): `update schedule_settings set bookings_paused = true;`.
  Na Fase 5 vira um botão no painel.
- **Restauração:** o Neon Free guarda 6 h de histórico (restore instantâneo pelo console). O dump
  diário cifrado entra na Fase 6.

## E-mails

- **Ver a fila:** `select kind, recipient, status, attempts, last_error, created_at from email_outbox order by created_at desc limit 20;`
  (a fila não guarda nome, e-mail nem endereço, então dá para consultar sem expor dados).
- **Status:** `pendente` (na fila ou aguardando nova tentativa), `enviado`, `falhou` (6 tentativas
  ou erro permanente; `last_error` mostra só o código HTTP) e `descartado` (sem destinatário,
  agendamento inativo ou mais de 72 h).
- **Reenviar um que falhou** (depois de corrigir a causa, por exemplo a chave do Resend):
  `update email_outbox set status = 'pendente', attempts = 0, next_attempt_at = now() where id = '…';`.
  Ele sai na próxima ação que dispare envio (a varredura automática entra na Fase 6).
- **Sem `RESEND_API_KEY`** em preview/produção, os e-mails esperam na fila. Em local e nos testes
  E2E, eles são gravados em `.emails/` (abra o `.html` no navegador).
- **Domínio:** no Resend, verifique `luisasilvaramos.com.br` e crie os registros SPF, DKIM e DMARC
  que ele indicar, no DNS do domínio.

## Testes de banco na sua máquina (opcional)

Precisa de Docker:

```bash
docker run -d --name lsr-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17
```

```bash
docker exec lsr-pg psql -U postgres -c "create database lsr_test"
```

Depois, com `DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/lsr_test` no
`.env.local` (ou no terminal), rode `npm run test:db`. Sem Docker, a CI roda esses testes em cada PR.
