# Agentes IA – Toca da Onça

Painel de agentes de IA multi-especialização pronto para deploy no **Vercel**.

---

## Deploy no Vercel

### 1. Importar o repositório

1. Acesse [vercel.com/new](https://vercel.com/new) e importe este repositório.
2. Selecione o **Framework Preset** como **Other** (sem framework).
3. Mantenha as configurações padrão de build (nenhum comando de build necessário).

### 2. Configurar variáveis de ambiente

Vá em **Project → Settings → Environment Variables** e adicione:

| Variável              | Obrigatório | Descrição                                                                                        |
|-----------------------|-------------|--------------------------------------------------------------------------------------------------|
| `GEMINI_API_KEY`      | ✅ Sim       | Chave da API do Google Gemini. Obtenha em [ai.google.dev](https://ai.google.dev).                |
| `SERPAPI_KEY`         | ⚠️ Opcional | Chave SerpAPI para buscas reais. Sem ela, `/api/search` retorna erro `503`.                      |
| `TELEGRAM_BOT_TOKEN`  | ⚠️ Opcional | Token do bot Telegram para notificações.                                                         |
| `TELEGRAM_CHAT_ID`    | ⚠️ Opcional | ID do chat Telegram para receber notificações. Necessário junto com `TELEGRAM_BOT_TOKEN`.        |

> **Atenção:** Nunca coloque chaves de API diretamente no código ou no `localStorage` em produção.
> Todas as chaves devem ser configuradas como variáveis de ambiente no servidor.

### 3. Fazer o deploy

Clique em **Deploy**. O Vercel irá:
- Servir `index.html` estático na rota `/`
- Expor as Vercel Functions em `/api/*`

---

## Endpoints disponíveis

| Método | Rota                    | Descrição                                                      |
|--------|-------------------------|----------------------------------------------------------------|
| GET    | `/api/health`           | Retorna `{ status: "ok", timestamp }`.                        |
| POST   | `/api/gemini`           | Proxy seguro para a API do Google Gemini.                     |
| GET/POST | `/api/search`         | Proxy de busca web (requer `SERPAPI_KEY`).                    |
| POST   | `/api/login/start`      | Placeholder de autenticação (retorna 503 até ser configurado).|
| POST   | `/api/notify/telegram`  | Envia mensagem via Telegram Bot (requer variáveis acima).     |

### `/api/gemini` – corpo da requisição

Formato simplificado:
```json
{
  "prompt": "Sua pergunta aqui",
  "system": "Instrução de sistema opcional",
  "model": "gemini-1.5-flash"
}
```

Formato nativo do Gemini:
```json
{
  "contents": [{ "parts": [{ "text": "Sua pergunta" }] }],
  "model": "gemini-1.5-flash"
}
```

### `/api/search` – corpo da requisição (POST)
```json
{ "q": "termo de busca" }
```
Ou via GET: `/api/search?q=termo+de+busca`

### `/api/notify/telegram` – corpo da requisição
```json
{ "message": "Texto da notificação (máx. 4096 caracteres)" }
```

---

## Limites de proteção

| Endpoint         | Limite de tamanho | Rate limit (por IP)   |
|------------------|-------------------|-----------------------|
| `/api/gemini`    | 32 KB             | 20 req/min            |
| `/api/search`    | 8 KB              | 30 req/min            |
| `/api/notify/telegram` | 4 KB        | 10 req/min            |

---

## ⚠️ Avisos de segurança

- **Nunca** insira sua `GEMINI_API_KEY` no `localStorage` ou em qualquer campo visível ao navegador em ambiente de produção.
- O painel possui modo `CONFIG.PRODUCTION = true` ativado por padrão. Nesse modo:
  - Chamadas diretas ao Gemini pelo navegador são **bloqueadas**.
  - Todas as requisições passam pelo proxy seguro `/api/gemini`.
- Em desenvolvimento local (`localhost`), o modo produção pode ser desativado para testes.
- Mantenha os tokens do Telegram e chaves SerpAPI também como variáveis de ambiente — nunca no código-fonte.

---

## Desenvolvimento local

```bash
npm install -g vercel
vercel dev
```

O Vercel Dev simulará as Vercel Functions localmente na porta 3000.

Crie um arquivo `.env.local` na raiz do projeto (nunca faça commit desse arquivo):
```
GEMINI_API_KEY=sua_chave_aqui
SERPAPI_KEY=sua_chave_aqui
TELEGRAM_BOT_TOKEN=seu_token_aqui
TELEGRAM_CHAT_ID=seu_chat_id_aqui
```
