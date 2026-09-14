# V14 — Busca estrita da conta Google

A V13 podia capturar e-mails de documentação do Node. A V14 elimina esse falso positivo.

A busca agora considera somente:
- variáveis cujo nome indica e-mail/Google/owner/account/login/user/workspace/Render;
- arquivos específicos de identidade/configuração;
- IDs internos de owner/workspace quando existirem.

Não varre Node, READMEs, dependências ou listas de autores.
