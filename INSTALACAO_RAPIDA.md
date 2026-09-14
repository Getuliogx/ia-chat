# INSTALAÇÃO RÁPIDA — CarolIA V11

## GitHub / Render
Envie tudo desta pasta para o GitHub, exceto `PC_LOCAL`. Faça o deploy no Render.

## Twitch
No painel da CarolIA, clique em **Conectar minha Twitch (MOD)** e entre SOMENTE com a sua própria conta, que é moderadora de `icarolinaporto`.

A V11 pede estas permissões para a sua conta MOD:
- ler o chat;
- enviar o gatilho do relay;
- apagar o gatilho depois.

Você NÃO precisa de acesso, senha ou token da conta `icarolzinhabot`.

## StreamElements
Depois de conectar sua Twitch, clique em **Preparar / corrigir relay do StreamElements**. O sistema cria/ajusta automaticamente o comando `!caroliareply` usando seus privilégios de moderador.

O bot do StreamElements publica a resposta usando o Custom Bot Name já configurado no canal.

## PC local
Abra `PC_LOCAL/INICIAR_CAROLIA_LOCAL.cmd`. Deixe o avatar/Browser Source aberto no OBS.

## Teste
No chat, envie: `@CarolIA oi`. A @menção não entra no Timer de 1 minuto; vai ao Qwen local e o StreamElements publica a resposta.
