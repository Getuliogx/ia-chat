# CarolIA com corpo + voz na live

Esta versão adiciona um avatar de corpo inteiro e voz TTS ao projeto original.

## Como funciona

1. A CarolIA continua escolhendo mensagens do chat e enviando o prompt ao `$(ai)` do StreamElements.
2. Quando `icarolzinhabot` (ou `streamelements`, se o Custom Bot Name não estiver ativo) publica a resposta, o EventSub vê essa mensagem.
3. O servidor reconhece que a mensagem chegou logo depois de um prompt da IA.
4. O servidor gera um MP3 com voz neural em português do Brasil.
5. A página `/avatar.html` recebe a resposta em tempo real, anima o corpo e toca o MP3, sem legenda.

## No Render

O `render.yaml` já cria `OVERLAY_KEY`. Em instalação antiga, o projeto também aceita `TIMER_KEY` como chave do avatar se `OVERLAY_KEY` não existir.

Depois do deploy, abra o painel. A seção **Avatar da IA — corpo + voz** mostra a URL completa e protegida da fonte.

## Colocar na live

Adicione a URL mostrada no painel como **Fonte de Navegador / Browser Source** no software usado para transmitir.

Sugestão:

- largura: `900`
- altura: `1200`
- fundo transparente
- deixe o áudio da Browser Source habilitado

O avatar padrão já vem no projeto. Para trocar pelo seu corpo/personagem, cole no painel uma URL pública de PNG ou WebP transparente em **Imagem personalizada do corpo**.

## Voz padrão

`pt-BR-FranciscaNeural`

Os campos do painel permitem mudar voz, velocidade, tom e volume. A síntese é feita no servidor usando `node-edge-tts`; se ela falhar, o avatar não troca para a voz do navegador, evitando cair em uma voz masculina.

## Teste

1. Abra a URL do avatar em outra aba ou na Browser Source.
2. No painel, escreva um texto em **Texto de teste**.
3. Clique **Testar corpo + voz agora**.
4. O contador **Overlays conectados** deve ser maior que zero.

## Observação importante

O servidor não consegue "injetar" uma imagem dentro do vídeo já enviado à Twitch. Para o corpo aparecer na transmissão, a URL do avatar precisa ser composta na cena por um software/serviço de streaming que aceite uma Browser Source (OBS, Streamlabs, overlay do StreamElements ou equivalente).
