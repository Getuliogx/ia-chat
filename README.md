# CarolIA V10

Sistema híbrido para a live `icarolinaporto`:

- **mensagens normais:** continuam no `$(ai)` do StreamElements através do Timer de 1 minuto;
- **@menções da CarolIA:** não entram no Timer; usam Qwen3 0.6B local pelo llama.cpp no notebook;
- **emoções/persona:** todos os sliders do painel entram no prompt da IA local;
- **chat imediato:** a conta Twitch conectada como bot publica a resposta pela API oficial da Twitch;
- **live:** avatar + voz feminina no mesmo link de Browser Source, sem legenda;
- **PC:** não usa Ollama, não instala serviço e não usa API paga/cota de IA.

Leia `INSTALACAO_RAPIDA.md` para os quatro passos de ativação.
