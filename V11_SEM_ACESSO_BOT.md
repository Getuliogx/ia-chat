# CarolIA V11 — canal de amigo / usuário é MOD

Esta versão NÃO pede login na conta `icarolzinhabot`.

## Como a resposta imediata funciona

1. Sua própria conta Twitch (MOD de `icarolinaporto`) lê o chat.
2. @menções não entram no Timer de 1 minuto.
3. Qwen local gera a resposta.
4. O servidor guarda a resposta por alguns segundos.
5. Sua conta MOD envia `!caroliareply <id>` automaticamente.
6. O StreamElements executa um Custom Command privado de nível Moderator e busca a resposta em `/se-local-reply`.
7. O StreamElements publica o texto usando o Custom Bot Name que já estiver configurado no canal.
8. A mensagem de gatilho da sua conta MOD é apagada automaticamente quando a Twitch permitir.
9. O mesmo texto dispara voz + avatar.

## Depois do deploy

1. Clique novamente em **Conectar minha Twitch (MOD)**. A V11 pede `user:read:chat`, `user:write:chat` e `moderator:manage:chat_messages`.
2. Entre SOMENTE com a sua conta de moderador.
3. Clique em **Preparar / corrigir relay do StreamElements**.
4. Deixe `PC_LOCAL/INICIAR_CAROLIA_LOCAL.cmd` aberto e o Browser Source do avatar ativo.
5. Teste no chat: `@CarolIA oi`.

Você não precisa de senha, token ou acesso à conta `icarolzinhabot`.
