# Correção de áudio V9

A V9 elimina a dependência de capturar a resposta do bot depois que ela já apareceu no chat.

O Timer agora executa: should -> prompt -> ai -> queryescape -> /say.

`/say` recebe a resposta real do AI, registra a fala e devolve exatamente o mesmo texto ao StreamElements. EventSub fica apenas como fallback.

TTS: primeiro tenta Francisca Neural pelo Edge TTS; se a geração falhar, tenta um MP3 PT-BR de reserva. No Browser Source, se nenhum MP3 tocar, a última reserva usa apenas nomes conhecidos de vozes femininas PT-BR e nunca escolhe uma voz masculina aleatória.

## Obrigatório após o deploy
Copie no painel a nova linha mostrada em **StreamElements — resposta da IA** e substitua a linha antiga em **Response messages** do Timer.
