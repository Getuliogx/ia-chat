# INSTALAÇÃO RÁPIDA — CarolIA / icarolinaporto

Esta versão é **sem OBS**.

- Canal lido: `icarolinaporto`
- Conta que autoriza a leitura: **a SUA conta Twitch (MOD do canal)**
- Conta que deve aparecer respondendo: `icarolzinhabot`, **se ela já estiver configurada como Custom Bot Name no StreamElements**
- IA: `$(ai)` nativa do StreamElements
- Hospedagem: Render
- Código: GitHub

## 1. Coloque esta pasta no GitHub

Crie um repositório e envie todos os arquivos desta pasta. Não envie `.env`, tokens ou senhas.

## 2. Crie o serviço no Render

No Render, crie um Blueprint usando o repositório. O `render.yaml` cria o Web Service.

No primeiro Blueprint, você só precisa informar:

- `PANEL_KEY`: uma senha forte para o painel

`TIMER_KEY` é gerada automaticamente. As credenciais da Twitch são adicionadas **depois do primeiro deploy**, quando o painel já consegue mostrar a Callback URL exata.

## 3. Descubra a Callback URL

Abra o endereço do Render e entre com `PANEL_KEY`.

No painel, copie **Callback URL**, parecida com:

`https://carolia-icarolinaporto.onrender.com/auth/twitch/callback`

## 4. Crie uma aplicação Twitch

No Twitch Developer Console, crie uma aplicação e cadastre exatamente a Callback URL copiada acima como OAuth Redirect URL.

Copie o Client ID e gere/copiei o Client Secret.

No Render, adicione manualmente em Environment:

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

Opcional, mas recomendado para manter automaticamente o token da Twitch atualizado entre futuros redeploys:

- `RENDER_API_KEY` — crie uma API Key na sua própria conta Render. O `RENDER_SERVICE_ID` já existe automaticamente no serviço.

Faça um redeploy.

## 5. Autorize A SUA Twitch

Abra o painel CarolIA e clique em **Conectar minha Twitch (MOD)**.

Entre com **a sua própria conta Twitch**, a conta que é moderadora de `icarolinaporto`.

A amiga não precisa autorizar a conta dela.

Se `RENDER_API_KEY` estiver configurada, o sistema grava/atualiza `TWITCH_REFRESH_TOKEN` automaticamente no Environment do próprio serviço.

Sem `RENDER_API_KEY`, a tela mostrará o Refresh Token para você copiar manualmente para `TWITCH_REFRESH_TOKEN` no Render.

**Nunca coloque Refresh Token nem Render API Key no GitHub.**

## 6. Configure o Timer no StreamElements

Entre no StreamElements do canal como Editor e abra Chatbot > Timers.

Crie um Timer e cole em **Response messages** a linha gerada pelo painel CarolIA.

Use:

- Online interval: `1 minuto`
- Chat lines: `1`
- Timer ativado

Não existe comando para os viewers.

## 7. icarolzinhabot

Se `icarolzinhabot` **já estiver conectado** no StreamElements como Custom Bot Name do canal, os Timers/respostas do chatbot devem sair por ele.

Se não estiver conectado, este projeto não pode fingir ser essa conta. Nesse caso, o StreamElements responderá com a identidade atualmente configurada no chatbot.

## Teste

No painel:

1. Escolha `Sensual`, `Safadinha`, `Zueira`, etc.
2. Clique em **Salvar configurações**.
3. Use **Simular prompt** para conferir a personalidade sem gastar IA.
4. Use **Colocar teste na fila** para testar o fluxo do próximo Timer.

