# Configurar a produção (passo a passo)

Site oficial na Netlify: **effortless-meringue-dd2411**. O site antigo (`luisasilvaramos-site`) deve
ter os builds parados (ou ser apagado) para não gastar créditos à toa.

Siga na ordem. Nenhum segredo vai para o GitHub nem para o chat: todos ficam só na Netlify e no seu
gerenciador de senhas.

## 1. Desligar o site antigo

Netlify → `luisasilvaramos-site` → _Project configuration → Build & deploy → Continuous deployment →
Build settings_ → **Stop builds**. Se não for mais usar, _Project configuration → General → Delete
project_.

## 2. Banco de dados (Neon)

1. No projeto do Neon, confirme que a região é **AWS US East 2 (Ohio)** e use o banco `neondb`.
2. Copie a _connection string_ **com pooler** (o host tem `-pooler`). Essa é a `DATABASE_URL`.
3. Copie também a string **sem pooler**. Essa é a `DATABASE_MIGRATION_URL` e fica **só** nos segredos
   do GitHub (passo 4), nunca na Netlify.

## 3. Variáveis na Netlify (só produção)

Netlify → `effortless-meringue-dd2411` → _Project configuration → Environment variables_ → **Add a
variable**, com o escopo **Production**. Para gerar cada segredo, rode no seu computador (um por vez):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

| Variável                                         | Valor                                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                   | String do Neon **com pooler**                                                                      |
| `ENC_KEYS`                                       | `v1:` + resultado de `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `ENC_ACTIVE_KEY`                                 | `v1`                                                                                               |
| `BOOKING_SIGNING_SECRET`                         | Segredo gerado                                                                                     |
| `AUTH_SECRET`                                    | Outro segredo gerado                                                                               |
| `CRON_SECRET`                                    | Outro segredo gerado                                                                               |
| `EMAIL_ADMIN_NOTIFY`                             | `luisa.silva.ramos@gmail.com`                                                                      |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Quando a conta do Resend existir (ADR 0006)                                                        |

> **`ENC_KEYS` não pode ser perdida nem trocada sem rotação:** sem ela, endereços e observações
> cifrados ficam ilegíveis. Guarde uma cópia no gerenciador de senhas.

## 4. Migrações do banco e contas do painel

> **Feito em 28/11/2026** (via Neon): as 8 migrações, os 4 serviços e as contas da Luísa e do Leo
> (senhas provisórias; troque em **Ajustes → Segurança → Trocar senha**). Os passos abaixo ficam
> para referência e para bancos novos.

No seu computador, no PowerShell, dentro da pasta do projeto atualizado (`git pull`). As variáveis
abaixo valem **só para esta janela** do terminal; feche-a ao terminar.

```powershell
$env:DATABASE_MIGRATION_URL = "<string do Neon SEM pooler>"
$env:DATABASE_URL = "<string do Neon SEM pooler>"
```

```powershell
npm.cmd run db:migrate
```

```powershell
npm.cmd run db:seed
```

Crie a conta da Luísa (a senha é digitada sem aparecer na tela):

```powershell
npm.cmd run admin -- criar --email luisa.silva.ramos@gmail.com --nome "Luísa Silva Ramos"
```

Repita com o seu e-mail para a conta de emergência (P28). No primeiro acesso a `/admin`, cada pessoa
escaneia o QR code com o app autenticador e guarda os 10 códigos de recuperação.

Para as próximas versões, cadastre também no GitHub (_Settings → Secrets and variables → Actions →
New repository secret_) o `DATABASE_MIGRATION_URL`, para as migrações rodarem sem o seu computador.

## 5. Ajustes iniciais (no painel)

Em **Ajustes**: endereço de saída (CEP e número), serviços e preços, horários da semana e regras.
Sem o endereço de saída, o agendamento online fica indisponível.

## 6. Publicar

Faça o merge do pull request de release. A Netlify publica uma vez (15 créditos). Depois, confira:

- `https://<site>/api/health` responde `ok`;
- `/agendar` mostra os serviços (e não "Em breve");
- em _Netlify → Logs → Functions_, a função `hourly` roda de hora em hora;
- um agendamento de teste chega no painel e é confirmado.
