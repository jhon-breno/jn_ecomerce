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

### Frontend

1. Crie `.env` na raiz com base em [.env.example](.env.example).
2. Defina no mínimo:

```env
VITE_BACKEND_URL=http://localhost:3000
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

## 5. Fluxos no App

- Checkout online:
  - PIX: gera QR Code imediatamente no app.
  - Cartão/Boleto: redireciona para checkout oficial do Mercado Pago.

- PDV:
  - Ao selecionar PIX, gera QR Code real do Mercado Pago para pagamento no caixa.

## Observações Importantes

- Nunca coloque `MP_ACCESS_TOKEN` no frontend.
- Use token `TEST-...` em homologação e `APP_USR-...` em produção.
- Para receber confirmação automática de status, configure `MP_WEBHOOK_URL` no backend e um endpoint de webhook.
- Se o frontend estiver no Firebase Hosting, a regra atual reescreve tudo para `index.html`. Isso significa que `/api/*` não funciona no mesmo domínio sem uma configuração adicional de proxy/rewrite para o backend.
