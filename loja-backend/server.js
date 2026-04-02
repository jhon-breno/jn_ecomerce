require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("node:crypto");
const { MercadoPagoConfig, Payment, Preference } = require("mercadopago");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const frontendUrls = (process.env.FRONTEND_URLS || "http://localhost:5173")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || frontendUrls.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origem não permitida pelo CORS"));
    },
  }),
);
app.use(express.json({ limit: "200kb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 90,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

const hasMpToken = Boolean(process.env.MP_ACCESS_TOKEN);
const client = hasMpToken
  ? new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN,
      options: { timeout: 5000 },
    })
  : null;

const paymentClient = client ? new Payment(client) : null;
const preferenceClient = client ? new Preference(client) : null;

const clampAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  if (amount <= 0 || amount > 50000) return null;
  return Math.round(amount * 100) / 100;
};

const normalizeDescription = (value, fallback) => {
  const base = String(value || fallback || "Pedido").trim();
  return base.slice(0, 120);
};

const normalizePayer = (payer = {}) => {
  const email = String(payer.email || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    return null;
  }

  return {
    email,
    first_name: String(payer.first_name || "Cliente")
      .trim()
      .slice(0, 60),
  };
};

const ensureMercadoPagoConfigured = (req, res, next) => {
  if (!hasMpToken || !paymentClient || !preferenceClient) {
    return res.status(503).json({
      error:
        "Mercado Pago não configurado no servidor. Defina MP_ACCESS_TOKEN no .env do backend.",
    });
  }
  return next();
};

app.get("/api/health", (req, res) => {
  res.json({ ok: true, mpConfigured: hasMpToken });
});

app.post("/api/pix", ensureMercadoPagoConfigured, async (req, res) => {
  try {
    const amount = clampAmount(req.body?.transaction_amount);
    const payer = normalizePayer(req.body?.payer);

    if (!amount || !payer) {
      return res.status(400).json({
        error: "Dados inválidos para gerar PIX.",
      });
    }

    const result = await paymentClient.create({
      body: {
        transaction_amount: amount,
        description: normalizeDescription(
          req.body?.description,
          "Pagamento via PIX",
        ),
        payment_method_id: "pix",
        payer,
        external_reference:
          String(req.body?.external_reference || "")
            .trim()
            .slice(0, 64) || `pix-${Date.now()}`,
        notification_url: process.env.MP_WEBHOOK_URL || undefined,
      },
      requestOptions: {
        idempotencyKey:
          req.headers["x-idempotency-key"]?.toString() || crypto.randomUUID(),
      },
    });

    const txData = result.point_of_interaction?.transaction_data || {};

    return res.json({
      id: result.id,
      status: result.status,
      date_of_expiration: result.date_of_expiration,
      qr_code_base64: txData.qr_code_base64,
      qr_code: txData.qr_code,
      ticket_url: txData.ticket_url || null,
    });
  } catch (error) {
    console.error("Erro ao gerar PIX Mercado Pago:", error?.message || error);
    return res.status(500).json({ error: "Erro ao gerar pagamento PIX" });
  }
});

app.post(
  "/api/checkout/preference",
  ensureMercadoPagoConfigured,
  async (req, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      const sanitizedItems = items
        .map((item) => ({
          title: String(item.title || item.name || "Item")
            .trim()
            .slice(0, 80),
          quantity: Math.max(1, Number(item.quantity || item.qty || 1)),
          unit_price: clampAmount(item.unit_price || item.price || 0),
          currency_id: "BRL",
        }))
        .filter((item) => item.unit_price);

      if (!sanitizedItems.length) {
        return res
          .status(400)
          .json({ error: "Nenhum item válido para checkout." });
      }

      const payer = normalizePayer(req.body?.payer || {});
      const externalReference =
        String(req.body?.external_reference || "")
          .trim()
          .slice(0, 64) || `checkout-${Date.now()}`;

      const frontendBaseUrl =
        process.env.FRONTEND_PUBLIC_URL || "http://localhost:5173";

      const response = await preferenceClient.create({
        body: {
          items: sanitizedItems,
          payer: payer || undefined,
          external_reference: externalReference,
          back_urls: {
            success: `${frontendBaseUrl}/#/checkout/sucesso`,
            failure: `${frontendBaseUrl}/#/checkout/falha`,
            pending: `${frontendBaseUrl}/#/checkout/pendente`,
          },
          auto_return: "approved",
          notification_url: process.env.MP_WEBHOOK_URL || undefined,
        },
        requestOptions: {
          idempotencyKey:
            req.headers["x-idempotency-key"]?.toString() || crypto.randomUUID(),
        },
      });

      return res.json({
        preferenceId: response.id,
        checkoutUrl: response.init_point,
        sandboxCheckoutUrl: response.sandbox_init_point,
      });
    } catch (error) {
      console.error(
        "Erro ao criar preferência de checkout:",
        error?.message || error,
      );
      return res.status(500).json({ error: "Erro ao criar checkout online" });
    }
  },
);

app.listen(PORT, () => {
  console.log(`Servidor de pagamentos rodando na porta ${PORT}`);
});
