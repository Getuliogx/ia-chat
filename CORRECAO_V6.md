# Correção v6 — avatar limpo + voz feminina

Esta versão corrige dois pontos do overlay:

- Remove totalmente a legenda/balão da página `avatar.html`.
- Remove o fallback genérico do `speechSynthesis` do navegador, que podia escolher a primeira voz `pt-BR` instalada e acabar usando uma voz masculina.
- O servidor agora aceita apenas uma lista de vozes femininas PT-BR e volta para `pt-BR-FranciscaNeural` se houver uma configuração antiga/inválida.
- Troca o avatar padrão por uma personagem de corpo inteiro com fundo transparente e animação leve de corpo durante a fala.

## Voz padrão

`pt-BR-FranciscaNeural`

## Outras vozes femininas disponíveis no painel

- `pt-BR-ThalitaMultilingualNeural`
- `pt-BR-BrendaNeural`
- `pt-BR-GiovannaNeural`
- `pt-BR-ManuelaNeural`
- `pt-BR-YaraNeural`

Se o MP3 do servidor falhar, a página não troca silenciosamente para uma voz aleatória do navegador. Isso evita voltar a uma voz masculina.
