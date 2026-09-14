# Recuperar a conta do Render pelo próprio projeto

Esta edição adiciona ao painel um botão **Descobrir e-mail do Render**.

Ele funciona somente se a variável secreta `RENDER_API_KEY` já estiver configurada no serviço em execução. O servidor consulta `GET https://api.render.com/v1/users` e, como reserva, `GET /v1/owners`.

A API key nunca é enviada ao navegador. O endpoint novo exige a mesma `PANEL_KEY` do painel.

Se `RENDER_API_KEY` não estiver configurada, o código-fonte sozinho não contém o e-mail da conta Render.
