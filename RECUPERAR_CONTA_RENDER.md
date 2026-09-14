# Recuperar conta Render — V12

O botão do painel não depende mais de RENDER_API_KEY.

Ele tenta, nesta ordem:

1. Render API, se a chave já existir.
2. Metadados automáticos do Render (`RENDER_SERVICE_ID`, `RENDER_GIT_REPO_SLUG`, `RENDER_GIT_COMMIT`).
3. E-mail público do perfil GitHub ligado ao deploy.
4. E-mails de autoria/committer do commit publicado e dos 100 commits mais recentes.
5. Link direto do serviço no Render Dashboard usando o Service ID.

Sem autenticação válida do Render, nenhum aplicativo público consegue ler o e-mail privado de login da conta; nesse caso o painel mostra as melhores pistas reais disponíveis no próprio projeto.
