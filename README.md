# Loja Multimarcas - Pagamentos Mercado Pago

Este projeto está configurado para:

- Receber pagamentos online com Checkout Pro do Mercado Pago (cartão/boleto/PIX via página oficial do MP).
- Gerar PIX no PDV (caixa) com QR Code e Copia e Cola em tempo real.

## Arquitetura de Segurança

- O token secreto do Mercado Pago fica somente no backend ([loja-backend/server.js](loja-backend/server.js)).
- O frontend chama apenas endpoints do backend.
- A API usa:
  - CORS por lista de origens permitidas
  - `helmet` para headers de segurança
  - `express-rate-limit` para limitar abuso
  - validação de payload e valores de pagamento
  - chave de idempotência por requisição

## 1. Configurar Variáveis de Ambiente

## Login de Clientes com Google

- O frontend agora exibe o botão Continuar com Google no modal de cliente.
- Para o recurso funcionar, habilite o provedor Google em Authentication > Sign-in method no painel do Firebase do projeto.
- Garanta também que o domínio local/produção usado pelo site esteja autorizado em Authentication > Settings > Authorized domains.

## Acesso Administrativo

- O painel admin não usa mais credenciais hardcoded no código.
- O login admin agora valida o usuário no Firebase Authentication e só libera acesso para e-mails listados em VITE_ADMIN_EMAILS.
- Defina VITE_ADMIN_EMAILS com uma lista separada por vírgula, ponto e vírgula ou quebra de linha.

Exemplo:

```env
VITE_ADMIN_EMAILS=admin@empresa.com,financeiro@empresa.com
```

### Frontend

1. Crie `.env` na raiz com base em [.env.example](.env.example).
2. Defina no mínimo:

```env
VITE_BACKEND_URL=http://localhost:3000
```

Opcional para produção, caso queira fornecer a Public Key sem depender do painel admin:

```env
VITE_MERCADO_PAGO_PUBLIC_KEY=APP_USR-...
```

Em produção, se o frontend estiver publicado separado do backend (ex.: Firebase Hosting para o site e Render/Railway para a API), `VITE_BACKEND_URL` deve apontar para a URL pública do backend. Isso é necessário para:

- pagamentos (`/api/pix` e `/api/checkout/preference`)
- proxy de imagens externas bloqueadas por hotlink, como `photo.yupoo.com`

Exemplo:

```env
VITE_BACKEND_URL=https://seu-backend.exemplo.com
```

### Backend

1. Crie `loja-backend/.env` com base em [loja-backend/.env.example](loja-backend/.env.example).
2. Defina no mínimo:

```env
PORT=3000
MP_ACCESS_TOKEN=TEST-OU-APP_USR-...
FRONTEND_PUBLIC_URL=http://localhost:5173
FRONTEND_URLS=http://localhost:5173
```

## 2. Instalar Dependências

Na raiz do projeto:

```bash
npm install
```

No backend:

```bash
cd loja-backend
npm install
```

## 3. Subir a Aplicação

Terminal 1 (backend):

```bash
cd loja-backend
npm run dev
```

Terminal 2 (frontend):

```bash
npm run dev
```

## 4. Endpoints de Pagamento

- `POST /api/pix`: cria cobrança PIX e retorna QR Code + Copia e Cola.
- `POST /api/checkout/preference`: cria preferência do Checkout Pro para pagamentos online.
- `GET /api/health`: valida se backend está online e se token MP está configurado.

## 4.1 WhatsApp Automático

O projeto agora possui uma base de configuração no painel admin para conectar o WhatsApp da loja e preparar automações como:

- carrinho abandonado após 24h
- lead que demonstrou interesse e não comprou
- confirmação após a compra
- atualização de status do pedido
- campanhas de recompra futura

O desenho adotado segue o mesmo princípio do fluxo de pagamentos e e-mails:

- o frontend só salva configuração operacional no Firestore
- o token do WhatsApp fica apenas no backend
- o backend expõe endpoints seguros para health-check e envio de teste

Endpoints adicionados:

- `GET /api/whatsapp/health`: informa se o backend está apto a falar com Z-API, BotBot ou WhatsApp Cloud API.
- `POST /api/whatsapp/send-test`: envia uma mensagem de teste para validar a integração.

Variáveis de ambiente do backend:

```env
# Z-API (opcional)
ZAPI_INSTANCE_ID=
ZAPI_TOKEN=
ZAPI_CLIENT_TOKEN=

# BotBot oficial (opcional)
BOTBOT_API_BASE_URL=https://botbot.chat
BOTBOT_APP_KEY=
BOTBOT_AUTH_KEY=

# Fallback custom webhook (opcional)
WHATSAPP_CUSTOM_WEBHOOK_URL=
WHATSAPP_CUSTOM_WEBHOOK_AUTH_HEADER_NAME=Authorization
WHATSAPP_CUSTOM_WEBHOOK_AUTH_HEADER_VALUE=

# WhatsApp Cloud API (opcional)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_API_VERSION=v23.0
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
```

Observação: quando o provider estiver como `custom_webhook` e `BOTBOT_APP_KEY` + `BOTBOT_AUTH_KEY` estiverem configurados, o backend envia diretamente para o endpoint oficial do BotBot (`POST /api/v2/sendText`).

Limite atual da implementação:

- o worker já está implementado no backend e pode disparar automaticamente:
  - carrinho abandonado
  - lead de interesse sem compra
  - mensagem após criação do pedido
  - mudança de status do pedido
  - recompra futura (após X dias)

Para ativar o worker no backend, configure em `loja-backend/.env`:

```env
WHATSAPP_WORKER_ENABLED=true
WHATSAPP_WORKER_INTERVAL_MS=60000
WHATSAPP_WORKER_LOOKBACK_DAYS=21
WHATSAPP_WORKER_APP_ID=minha-loja-oficial
```

Além disso, configure credenciais do Firebase Admin SDK no backend (uma das opções):

```env
# Opção A: JSON da service account em linha única
FIREBASE_SERVICE_ACCOUNT_JSON={...}

# Opção B: credencial padrão do ambiente (GCP/Render com secret mount)
FIREBASE_PROJECT_ID=seu-projeto-firebase
```

Endpoints administrativos do worker:

- `GET /api/whatsapp/worker/status`
- `POST /api/whatsapp/worker/run`

Você pode proteger esses endpoints com:

```env
WHATSAPP_WORKER_ADMIN_TOKEN=seu-token-admin
```

e enviar no header:

`x-worker-token: seu-token-admin`

## 5. Fluxos no App

- Checkout online:
  - PIX: gera QR Code imediatamente no app.
  - Cartão/Boleto: redireciona para checkout oficial do Mercado Pago.

- PDV:
  - Ao selecionar PIX, gera QR Code real do Mercado Pago para pagamento no caixa.

## Observações Importantes

- Nunca coloque `MP_ACCESS_TOKEN` no frontend.
- Use token `TEST-...` em homologação e `APP_USR-...` em produção.
- O endpoint `GET /api/health` agora retorna `mpMode` para confirmar se a API está em `sandbox` ou `production`.
- Para receber confirmação automática de status, configure `MP_WEBHOOK_URL` no backend e um endpoint de webhook.
- Se o frontend estiver no Firebase Hosting, a regra atual reescreve tudo para `index.html`. Isso significa que `/api/*` não funciona no mesmo domínio sem uma configuração adicional de proxy/rewrite para o backend.

## 6. Checklist de Produção

1. No arquivo local [loja-backend/.env.example](loja-backend/.env.example), use como base para configurar `MP_ACCESS_TOKEN=APP_USR-...` no seu `loja-backend/.env`.
2. No arquivo local [.env.example](.env.example), use como base para configurar `VITE_BACKEND_URL` com a URL pública da API.
3. Se for usar componentes/client SDK do Mercado Pago, configure `VITE_MERCADO_PAGO_PUBLIC_KEY=APP_USR-...` no `.env` do frontend ou salve a Public Key pelo painel administrativo.
4. Suba o backend e valide `GET /api/health`; o campo `mpMode` precisa vir como `production`.
