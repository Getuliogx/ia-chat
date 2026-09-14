# INSTALAÇÃO RÁPIDA — CarolIA V10

## 1. GitHub / Render

Substitua os arquivos do projeto atual pelos arquivos desta pasta e faça o deploy no Render.

O Timer do StreamElements continua sendo o mesmo campo exibido pelo painel. Mensagens normais continuam usando o Timer de 1 minuto.

## 2. Twitch

No painel:

- mantenha a conta que lê o chat conectada;
- clique em **Conectar icarolzinhabot para responder** e faça login na conta Twitch que deve publicar as respostas imediatas.

As duas autorizações usam a mesma Callback URL já cadastrada no Twitch Developer Console.

## 3. Notebook

Abra:

`PC_LOCAL\INICIAR_CAROLIA_LOCAL.cmd`

Na primeira vez ele baixa automaticamente llama.cpp + Qwen3 0.6B Q4_K_M. Não usa Ollama.

## 4. OBS

Continue usando **um único link**, a URL do avatar mostrada pelo painel. Nessa Browser Source marque **Controlar áudio via OBS**.

## Resultado

- mensagem normal → Timer StreamElements de 1 minuto;
- `@icarolzinhabot` / `@CarolIA` → Qwen local imediatamente, fora do Timer;
- resposta local → Twitch + voz feminina + avatar;
- todos os sliders de emoção/personalidade entram no prompt local.
