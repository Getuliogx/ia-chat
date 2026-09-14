# Correção de áudio v8

Esta versão remove o `AudioContext` do avatar. O MP3 TTS agora toca diretamente no elemento `<audio>`, evitando que o Browser Source fique mudo quando o contexto de áudio é suspenso.

Também:
- toda mensagem do `icarolzinhabot` ou `StreamElements` é enviada para fala;
- o MP3 é validado antes de ser publicado;
- o painel mostra quantos MP3 foram gerados e o último erro de TTS;
- continua sendo **um único link** de Browser Source;
- não há legenda nem fallback de voz masculina.

No OBS, abra Propriedades da Fonte de Navegador e marque **Controlar áudio via OBS**. A própria fonte aparecerá no Mixer de Áudio.
