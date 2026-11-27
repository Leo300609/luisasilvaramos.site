# ADR 0015 · Cotação assinada, CEP e fluxo de agendamento

Status: **Aceito** (Fase 4a) · Data: 2026-11-27

## Contexto

A taxa e o tempo de deslocamento dependem do endereço. Esses valores **não podem vir do
navegador**: a cliente poderia editar a taxa ou encurtar o deslocamento e "abrir" horários que
não existem.

## Decisão

1. **CEP → coordenadas:** BrasilAPI `cep/v2`, gratuita e sem chave; devolve coordenadas para a
   maioria dos CEPs. Timeout de 4 s. Sem coordenadas, a cliente é orientada a agendar pelo
   WhatsApp (não inventamos distância).
2. **Cotação assinada:** o servidor calcula endereço, taxa e tempo e devolve um token
   `payload.HMAC-SHA256` (segredo `BOOKING_SIGNING_SECRET`), válido por 2 h. Disponibilidade e
   criação **verificam a assinatura** e usam só os valores assinados.
3. **Endpoints POST** (não GET) para disponibilidade, porque a cotação contém o endereço e não
   pode ir para URLs nem logs. Todos exigem `Origin` do próprio site (CSRF), além do cookie
   `SameSite=Lax`.
4. **Fluxo em 5 passos** (Fase 0, R4): Serviço → Evento e local → Data e horário → Seus dados →
   Confirmação. Estados do design implementados: carregando (skeleton), dia lotado com sugestões,
   **"Esse horário acabou de ser reservado"** com dados preservados, erros de formulário e
   "Não conseguimos confirmar agora" com "Tentar de novo" (a chave de idempotência é a mesma, então
   o retry nunca duplica).
5. **Testes sem serviços externos:** `FAKE_EXTERNAL_SERVICES=1` troca a BrasilAPI por um falso
   determinístico (CEP 99999-999 = não encontrado; 88888-888 = fora do raio). **Recusado em
   produção.**

## CSP

As páginas do agendamento usam nonce. O React renderiza `style=""` no servidor (ex.: variável CSS
da barra de progresso), e isso era bloqueado. Liberamos **só atributos de estilo**
(`style-src-attr 'unsafe-inline'`); `<style>` e scripts continuam exigindo nonce.

## Consequências

- Sem endereço-base configurado (o CEP de partida da Luísa), a cotação responde
  "configurando, fale no WhatsApp". O endereço-base é cadastrado por
  `npm run db:set-base` (Fase 5: pelo painel).
- Em produção, enquanto as variáveis do banco não estiverem configuradas, `/agendar` mostra a
  página "Em breve" com o WhatsApp.
