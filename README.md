# CarolIA — icarolinaporto — sem OBS

Sistema para acompanhar automaticamente o chat da Twitch `icarolinaporto`, selecionar mensagens e responder usando a IA nativa `$(ai)` do StreamElements.

## Arquitetura

```text
Twitch #icarolinaporto
        |
        | EventSub channel.chat.message
        | sua conta Twitch autorizada (MOD)
        v
Render / CarolIA
  - filtro de mensagens
  - fila
  - emoções
  - sensualidade / atrevimento
  - escolha da mensagem
  - montagem do prompt
        |
        | StreamElements Timer + $(customapi)
        v
StreamElements $(ai)
        |
        v
icarolzinhabot (se já estiver configurado como Custom Bot Name)
```

Não usa OBS, Custom Widget ou API externa de IA.

## Por que precisa autorizar sua Twitch?

A Twitch exige autenticação para receber mensagens de chat pelo EventSub. O projeto solicita somente o escopo `user:read:chat` e usa a conta autorizada apenas para ler o chat.

O usuário autorizado deve conseguir acessar o chat. Neste projeto, a conta utilizada é a conta do moderador, não a conta da streamer e não o `icarolzinhabot`.

Documentação Twitch:

- https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/
- https://dev.twitch.tv/docs/eventsub/handling-websocket-events
- https://dev.twitch.tv/docs/chat/send-receive-messages/

## Como o StreamElements responde sem comando do viewer

O StreamElements disponibiliza `$(ai <prompt>)` para gerar resposta e `$(customapi <url>)` para buscar dados de uma API. O projeto usa um Timer:

```text
$(if $(customapi https://SEU-RENDER/should?key=...) $(ai $(customapi https://SEU-RENDER/prompt?key=...)))
```

`/should` retorna `1` apenas quando há uma mensagem válida. Se retornar `0`, o ramo com `$(ai)` não é executado.

Documentação StreamElements:

- https://docs.streamelements.com/chatbot/variables/ai
- https://docs.streamelements.com/chatbot/variables/customapi
- https://docs.streamelements.com/chatbot/variables/if
- https://docs.streamelements.com/chatbot/timers

### Limites importantes

O `$(ai)` tem limite por canal de 10 requisições/minuto em canal regular, 20 em afiliado e 30 em parceiro. O prompt deve ter menos de 512 caracteres.

`$(customapi)` retorna no máximo os primeiros 400 bytes. Por isso o servidor limita o prompt a aproximadamente 388 bytes.

**Nesta arquitetura sem comando**, o maior gargalo é o Timer: o intervalo online do StreamElements é configurado em minutos. Com Timer de 1 minuto, haverá no máximo aproximadamente uma tentativa automática por minuto por esse Timer, mesmo que o canal tenha limite de 20 chamadas de IA por minuto.

## Personalidades

O painel inclui:

- 😇 Suave
- 🙂 Normal
- 😂 Zueira
- 💋 Sensual
- 😏 Safadinha
- 🤪 Insana
- 💀 Caos Pesado

Sliders:

- Felicidade
- Sarcasmo
- Irritação
- Energia
- Caos
- Empatia
- Memes
- Sensualidade
- Atrevimento

O modo Sensual/Safadinha é propositalmente configurado como **flerte e duplo sentido não explícitos**. O prompt instrui a IA a não gerar sexo explícito, assédio, sexualização de menores, ódio ou ameaça. O próprio StreamElements também aplica as restrições do serviço de IA.

## Seleção inteligente das mensagens

O Render não manda todo o chat para `$(ai)`. Primeiro ele filtra localmente:

- bots
- mensagens do próprio `icarolzinhabot`
- comandos `!` e `.`
- mensagens curtas demais
- mensagens que parecem apenas emotes
- usuários da lista de ignorados

Depois aumenta a prioridade de:

- perguntas
- mensagens mencionando Carol / CarolIA
- mensagens de humor
- mensagens de flerte, quando ativado
- VIPs, subs e mods

Isso não gasta chamadas de IA; só a mensagem escolhida vira prompt.

## Variáveis do Render

| Variável | Obrigatória | Uso |
|---|---:|---|
| `CHANNEL_NAME` | sim | Já vem como `icarolinaporto` |
| `BOT_DISPLAY_NAME` | sim | Já vem como `icarolzinhabot` |
| `PANEL_KEY` | sim | Senha para abrir o painel |
| `TIMER_KEY` | sim | Protege `/should` e `/prompt`; Blueprint gera automaticamente |
| `TWITCH_CLIENT_ID` | sim | Aplicação Twitch criada por você |
| `TWITCH_CLIENT_SECRET` | sim | Secret da aplicação Twitch |
| `TWITCH_REFRESH_TOKEN` | depois da 1ª autorização | Mantém sua Twitch conectada após reinícios; pode ser gravado automaticamente |
| `RENDER_API_KEY` | não | Permite ao app atualizar o próprio `TWITCH_REFRESH_TOKEN` no Render |
| `RENDER_SERVICE_ID` | automático | O Render fornece; usado com a API do Render |
| `PUBLIC_BASE_URL` | não | Pode fixar o domínio público; normalmente é detectado |

## Fluxo de autorização Twitch

1. Faça o primeiro deploy no Render.
2. Abra o painel e copie a Callback URL.
3. Cadastre essa URL na sua aplicação Twitch.
4. Adicione Client ID e Client Secret no Render.
5. Opcional: adicione `RENDER_API_KEY` para persistência automática do Refresh Token.
6. Redeploy.
7. No painel clique **Conectar minha Twitch (MOD)**.
8. Autorize sua conta.
9. Com `RENDER_API_KEY`, o app atualiza `TWITCH_REFRESH_TOKEN` sozinho. Sem ela, copie o token mostrado para o Render manualmente.

O Refresh Token é segredo. Não o envie para GitHub, Discord ou chat.

## Configuração do StreamElements

No canal `icarolinaporto`, como Editor:

1. Chatbot > Timers.
2. Crie um Timer chamado `CarolIA`.
3. Cole a linha mostrada no painel em `Response messages`.
4. Online interval: 1 minuto.
5. Chat lines: 1.
6. Ative o Timer.

### Sobre o nome `icarolzinhabot`

Este projeto **não possui nem solicita credenciais do `icarolzinhabot`**.

Para a resposta sair como `icarolzinhabot`, essa conta precisa **já estar autorizada/configurada no próprio StreamElements como Custom Bot Name**. Se isso já foi feito anteriormente pela dona do canal, não é necessária nova autorização para este projeto.

Se ela não estiver configurada, o sistema não pode se passar por `icarolzinhabot`; a resposta usará a identidade que o chatbot do StreamElements estiver usando.

## Render Free

Render oferece Web Services gratuitos, mas serviços Free podem suspender por inatividade. O Timer do StreamElements faz chamadas HTTP para o serviço durante a live e normalmente o desperta, mas o primeiro ciclo depois de uma suspensão pode ter atraso enquanto o serviço inicia e reconecta ao EventSub.

Documentação Render:

- https://render.com/docs/free
- https://render.com/docs/web-services
- https://render.com/docs/blueprint-spec

## Persistência

`TWITCH_REFRESH_TOKEN` deve ficar no Environment do Render. Se `RENDER_API_KEY` estiver configurada, o servidor usa a API oficial do Render para atualizar esse valor quando a Twitch renovar o refresh token. A alteração do Environment é persistida para o próximo deploy. Sem a API Key, a atualização é manual.

A configuração do painel é salva em `data/state.json` durante a execução. Em Web Service Free esse arquivo pode ser perdido em um novo deploy/instância. Por isso o painel tem **Exportar configuração JSON**. O arquivo `data/config.default.json` contém a configuração padrão, atualmente definida como `Safadinha`.

Para tornar uma configuração permanente pelo GitHub, altere `data/config.default.json` e faça commit.

## Segurança

- Não coloque `PANEL_KEY`, Twitch Client Secret, Refresh Token ou `RENDER_API_KEY` no GitHub.
- Não mande o Refresh Token para outras pessoas.
- O `TIMER_KEY` fica apenas na URL do Timer do StreamElements.
- O OAuth usa `state` assinado e expira em 15 minutos.
- O sistema pede apenas `user:read:chat` para a conta usada na leitura.

## Arquivos

```text
CarolIA-Final-icarolinaporto/
├─ server.js
├─ package.json
├─ render.yaml
├─ .env.example
├─ .gitignore
├─ README.md
├─ INSTALACAO_RAPIDA.md
├─ data/
│  └─ config.default.json
├─ public/
│  ├─ index.html
│  ├─ app.js
│  └─ style.css
└─ .github/
   └─ workflows/
      └─ check.yml
```

## Desenvolvimento local

```bash
npm install
cp .env.example .env
npm start
```

Abra `http://localhost:8080`.

Para OAuth local, a Callback URL cadastrada na Twitch precisa ser exatamente a mesma mostrada no painel.
