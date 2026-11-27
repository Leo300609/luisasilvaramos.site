# ADR 0013 · Formulário de contato envia pelo WhatsApp (Fase 2)

Status: **Aceito** (Fase 2) · Data: 2026-11-27 · Revisão prevista: Fase 4

## Contexto

O design mostra um formulário "Vamos conversar" com a mensagem _"Obrigada! Recebi sua mensagem e
retorno em breve."_ Guardar o lead exige banco de dados (Fase 3), e notificar a Luísa exige e-mail
(Fase 4). A Luísa atende pelo WhatsApp.

Dizer "recebi sua mensagem" sem guardar nada seria enganoso.

## Decisão

Na Fase 2:

1. O formulário valida no navegador (nome, WhatsApp com DDD, tipo de evento, data, mensagem) com
   erros acessíveis (`aria-invalid`, `aria-describedby` e foco no primeiro campo com erro).
2. Ao enviar, monta a mensagem e abre o `wa.me` da Luísa com o texto pronto (codificado com
   `encodeURIComponent`). A confirmação na tela diz a verdade: _"Abrimos o WhatsApp com a sua
   mensagem pronta: é só tocar em enviar."_, com um link de reserva caso o navegador bloqueie a
   nova aba.
3. Nada é guardado pelo site. Isso também aparece em um aviso abaixo do formulário.
4. Honeypot contra bots simples.
5. A validação no cliente é TypeScript puro, **sem Zod**: o Zod no navegador acrescentava cerca de
   40 KB de JavaScript à página inicial e disparava um aviso de CSP (`eval`). O servidor (Fase 4)
   validará de novo com Zod.

## Consequências

- Sem custo, sem dados pessoais armazenados e sem LGPD extra nesta fase.
- A mensagem só chega se a pessoa tocar em "enviar" no WhatsApp.
- **Fase 4:** os leads passam a ser salvos e notificados por e-mail (outbox), com rate limit e
  Turnstile. O WhatsApp continua como opção.
