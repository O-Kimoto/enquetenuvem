# EnqueteNuvem

Mini-SaaS de enquetes ao vivo, feito para a demonstração do seminário sobre **SaaS (Software como Serviço)**.

Um único sistema, rodando numa única instância na nuvem, atende vários clientes (multi-tenant). Cada cliente tem seu espaço em `/t/<nome-do-espaco>` e só enxerga os próprios dados.

## Rodar no computador

Precisa só do Node.js 18 ou mais novo. Não tem dependências para instalar.

```bash
node server.js
```

Abra http://localhost:3000

## Publicar na nuvem (Render, plano gratuito)

Jeito rápido: clique no botão abaixo, entre no Render com a conta do GitHub e confirme em **Deploy Blueprint**. O arquivo `render.yaml` já diz tudo para o Render (Node, plano Free, comandos de build e start).

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/O-Kimoto/enquetenuvem)

Jeito manual:

1. Suba esta pasta para um repositório no GitHub.
2. Em render.com, entre com a conta do GitHub.
3. **New → Web Service** → escolha o repositório.
4. Runtime: **Node** · Build Command: `npm install` · Start Command: `npm start` · Instance Type: **Free**.
5. Clique em **Deploy**. Em 1–3 minutos sai um endereço `https://<nome>.onrender.com`.

O plano gratuito "dorme" depois de 15 minutos sem acesso e leva um tempo para acordar no primeiro acesso. Abra o link alguns minutos antes de apresentar.

## Rotas

| Rota | O que é |
|---|---|
| `/` | Página inicial: criar o espaço de uma empresa |
| `/t/<slug>/painel` | Painel do cliente: resultados ao vivo + QR code |
| `/t/<slug>` | Página de votação (celular) |
| `GET /api/status` | Quantos clientes a mesma instância atende |
| `POST /api/espacos` | Cria um cliente (inquilino) |
| `GET /api/espacos/<slug>` | Dados de um cliente |
| `POST /api/espacos/<slug>/votos` | Registra um voto |

Os dados ficam na memória do servidor: ao reiniciar, voltam só os dois clientes de exemplo. Num SaaS real, eles iriam para um banco de dados gerenciado.

`public/qrcode.js` é a biblioteca qrcode-generator de Kazuhiko Arase (licença MIT).
