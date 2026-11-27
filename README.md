# Luísa Silva Ramos · Site e agendamento

Site, agendamento online e painel administrativo da **Luísa Silva Ramos, maquiadora profissional**
([luisasilvaramos.com.br](https://luisasilvaramos.com.br)).

> Projeto em construção, por fases. Veja o plano em [`docs/fase-0-descoberta.md`](docs/fase-0-descoberta.md)
> e as decisões técnicas em [`docs/adr/`](docs/adr).

## Tecnologias

- **Next.js 16** (App Router) + **TypeScript** em modo estrito
- **Tailwind CSS 4** com os tokens do design (`src/app/globals.css`)
- **Zod** para validar tudo que entra (inclusive as variáveis de ambiente)
- **Vitest** (testes unitários) e **Playwright** + **axe** (testes ponta a ponta e acessibilidade)
- Hospedagem na **Netlify**, CI no **GitHub Actions**

## Rodando na sua máquina (passo a passo)

1. Instale o **Node.js 22** ([nodejs.org](https://nodejs.org)). Se usa `nvm`, rode `nvm use` na pasta do projeto.
2. Instale as dependências (só na primeira vez ou quando o `package-lock.json` mudar):

   ```bash
   npm ci
   ```

3. Crie o arquivo de variáveis locais a partir do modelo. Para a Fase 1 ele pode ficar como está:

   ```bash
   cp .env.example .env.local
   ```

4. Suba o servidor de desenvolvimento e abra <http://localhost:3000>:

   ```bash
   npm run dev
   ```

## Comandos

| Comando             | O que faz                                                    |
| ------------------- | ------------------------------------------------------------ |
| `npm run dev`       | Servidor de desenvolvimento com recarregamento automático    |
| `npm run build`     | Build de produção (valida as variáveis de ambiente)          |
| `npm run start`     | Sobe o build de produção                                     |
| `npm run lint`      | ESLint (zero avisos tolerados)                               |
| `npm run typecheck` | Checagem de tipos do TypeScript                              |
| `npm run format`    | Formata o código com Prettier                                |
| `npm test`          | Testes unitários (Vitest)                                    |
| `npm run test:e2e`  | Testes E2E (Playwright). Rode `npm run build` antes          |
| `npm run check`     | Lint + tipos + formatação + testes + build: rode antes do PR |

Primeira vez com Playwright na sua máquina? Instale o navegador: `npx playwright install chromium`.

## Estrutura

```
src/
  app/                 rotas (páginas, API) e layout
  components/          componentes de interface
  env/                 validação das variáveis de ambiente
  lib/security/        cabeçalhos de segurança e CSP
  lib/observability/   logger estruturado sem dados pessoais
  proxy.ts             CSP com nonce nas áreas dinâmicas (agendar, admin)
tests/
  unit/                Vitest
  e2e/                 Playwright
docs/                  descoberta, ADRs, runbook, segurança, LGPD
```

## Fluxo de trabalho

- Uma branch por fase (`phase-N/nome`). `main` está sempre pronta para publicar.
- Commits no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat:`, `fix:`, `docs:`…).
- Todo PR precisa da CI verde. A Netlify gera um _deploy preview_ para cada PR.
- **Nunca** commite segredos. Use `.env.local` (ignorado pelo Git) e as variáveis da Netlify.

## Documentação

- [Descoberta e plano](docs/fase-0-descoberta.md)
- [Decisões de arquitetura (ADRs)](docs/adr)
- [Runbook: deploy, rollback e incidentes](docs/runbook.md)
- [Segurança](SECURITY.md)
