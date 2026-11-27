# ADR 0014 · Deslocamento e regra do horário do evento

Status: **Aceito** (Fase 3) · Data: 2026-11-27 · Valores padrão: `TODO(Leo)`, a confirmar com a Luísa

## Contexto

Não há estúdio: todo atendimento é no endereço da cliente. A Luísa sai, faz a maquiagem, volta e
só então fica livre (Fase 0, R4). A cliente informa o horário do evento, e precisa estar pronta
antes dele (R3).

## Decisão

- **Ocupação na agenda:** `[início − ida, fim + volta + intervalo)`, imposta pelo banco.
  O expediente configurado inclui os deslocamentos.
- **Tempo de deslocamento:** tempo da rota × fator de segurança (1,3), arredondado para cima em
  múltiplos de 15 min. Ida e volta são consideradas simétricas.
- **Taxa:** `max(mínimo, km × 2 × R$/km)`, arredondada para cima em R$ 5. Acima do raio máximo, não
  há agendamento online ("fale com a Luísa no WhatsApp").
- **Padrões (editáveis no painel):** mínimo R$ 30, R$ 2,50/km, raio de 40 km.
- **Regra do evento:** pronta até `evento − 30 min` (limite rígido); recomendado terminar até
  `evento − 90 min`. O horário mais tarde que respeita a recomendação ganha o selo
  "Recomendado"; os seguintes, até o limite, aparecem como "apertado".
- **Rotas:** interface `RouteProvider`. Nos testes e como reserva usa-se uma **estimativa
  conservadora** (linha reta × 1,35 a 22 km/h). A API real (Google Routes ou OpenRouteService)
  entra na Fase 4, com a chave obtida pela Luísa/Leo.

## Consequências

- A disponibilidade depende do endereço, por isso o fluxo da cliente pede local e evento
  **antes** do calendário (5 passos).
- Se a API de rotas cair, a estimativa pede mais tempo, nunca menos: pode sobrar folga, mas não
  falta.
