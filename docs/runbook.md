# Runbook

> Documento vivo: cada fase acrescenta seções. Última atualização: Fase 1.

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
