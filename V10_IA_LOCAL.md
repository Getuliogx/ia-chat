# CarolIA V10 — IA local leve + Timer de 1 minuto

## O que mudou

- Mensagens normais continuam usando o Timer do StreamElements a cada 1 minuto.
- Mensagens com `@icarolzinhabot` ou `@CarolIA` **não entram no Timer**.
- Essas @menções vão para o Qwen3 0.6B Q4_K_M rodando localmente no notebook pelo llama.cpp.
- O modelo recebe todos os controles de emoção/personalidade do painel.
- A resposta imediata é publicada no chat pela conta Twitch conectada em **Conta Twitch que envia a resposta imediata**.
- A mesma resposta dispara a voz feminina e o avatar. Continua existindo **um único link de Browser Source** no OBS.
- Não usa Ollama e não precisa de chave/cota de IA.

## PC

Abra `PC_LOCAL/INICIAR_CAROLIA_LOCAL.cmd`.

Na primeira execução ele baixa automaticamente o llama.cpp CPU x64 e o modelo Qwen3 0.6B Q4_K_M. Depois inicia em `127.0.0.1:11435` com 2 threads, contexto 1024 e reasoning desligado.

Para encerrar: `PC_LOCAL/PARAR_CAROLIA_LOCAL.cmd`.

## Render/painel

Depois de publicar esta versão:

1. Conecte a conta que lê o chat como antes.
2. Clique em **Conectar icarolzinhabot para responder** e faça login na conta que deve publicar as respostas locais.
3. Deixe **IA local para respostas imediatas** e **somente em @menções** ativados.
4. Use o mesmo link do avatar no OBS.

A Callback URL é a mesma para as duas autorizações da Twitch.
