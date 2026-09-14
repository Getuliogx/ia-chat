# V13 — varredura profunda da conta Google

No painel, use **VARREDURA PROFUNDA: achar conta Google**.

A rotina procura somente enderecos `@gmail.com` e `@googlemail.com` que ja estejam presentes no runtime do proprio Render: variaveis de ambiente, metadados do processo e arquivos pequenos de configuracao acessiveis ao servico.

Ela nao exibe senhas, tokens ou valores completos. Se nenhum Gmail aparecer, o Render nao disponibilizou ao processo o e-mail privado usado no login.
