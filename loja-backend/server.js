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
const mercadoPagoAccessToken = String(process.env.MP_ACCESS_TOKEN || "").trim();

const detectMercadoPagoMode = (token) => {
  if (!token) return "unconfigured";
  if (token.startsWith("APP_USR-")) return "production";
  if (token.startsWith("TEST-")) return "sandbox";
  return "unknown";
};

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

const mpMode = detectMercadoPagoMode(mercadoPagoAccessToken);
const hasMpToken = Boolean(mercadoPagoAccessToken);
const client = hasMpToken
  ? new MercadoPagoConfig({
      accessToken: mercadoPagoAccessToken,
      options: { timeout: 5000 },
    })
  : null;

const paymentClient = client ? new Payment(client) : null;
const preferenceClient = client ? new Preference(client) : null;

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const normalizeExternalReference = (value, fallbackPrefix) => {
  const raw = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9\-_.:]/g, "")
    .slice(0, 64);

  if (raw.length >= 3) return raw;
  return `${fallbackPrefix}-${Date.now()}`;
};

const normalizeIdempotencyKey = (value) => {
  const key = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9\-_.:]/g, "")
    .slice(0, 128);

  if (key.length < 8) return null;
  return key;
};

const buildRequestOptions = (req) => ({
  idempotencyKey:
    normalizeIdempotencyKey(req.headers["x-idempotency-key"]) ||
    crypto.randomUUID(),
});

const extractGatewayError = (error) => {
  const details = error?.cause || error?.response?.data || null;
  const message =
    details?.message ||
    details?.error ||
    error?.message ||
    "Falha no provedor de pagamentos.";

  return {
    message,
    details,
  };
};

const buildFrontendBaseUrl = () => {
  const raw = String(process.env.FRONTEND_PUBLIC_URL || "").trim();
  if (!raw) return "http://localhost:5173";

  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) {
      return "http://localhost:5173";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:5173";
  }
};

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
  if (!isValidEmail(email)) {
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
  res.json({ ok: true, mpConfigured: hasMpToken, mpMode });
});

app.get("/api/image-proxy", async (req, res) => {
  const rawUrl = String(req.query?.url || "").trim();

  if (!rawUrl) {
    return res.status(400).json({ error: "Informe a URL da imagem." });
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: "URL de imagem inválida." });
  }

  if (targetUrl.protocol !== "https:") {
    return res.status(400).json({ error: "Apenas imagens HTTPS são aceitas." });
  }

  if (targetUrl.hostname !== "photo.yupoo.com") {
    return res.status(403).json({ error: "Host de imagem não permitido." });
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        referer: "https://x.yupoo.com/",
        accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Falha ao buscar imagem remota (${upstream.status}).`,
      });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const cacheControl =
      upstream.headers.get("cache-control") || "public, max-age=86400";
    const arrayBuffer = await upstream.arrayBuffer();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", cacheControl);
    return res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error("Erro no proxy de imagem:", error?.message || error);
    return res
      .status(502)
      .json({ error: "Não foi possível carregar a imagem." });
  }
});

app.post("/api/pix", ensureMercadoPagoConfigured, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        error: "Payload inválido para geração de PIX.",
      });
    }

    const amount = clampAmount(req.body?.transaction_amount);
    const payer = normalizePayer(req.body?.payer);
    const description = normalizeDescription(
      req.body?.description,
      "Pagamento via PIX",
    );
    const externalReference = normalizeExternalReference(
      req.body?.external_reference,
      "pix",
    );

    if (!amount || !payer) {
      return res.status(400).json({
        error:
          "Dados inválidos para gerar PIX. Verifique valor da transação e e-mail do pagador.",
      });
    }

    const result = await paymentClient.create({
      body: {
        transaction_amount: amount,
        description,
        payment_method_id: "pix",
        payer,
        external_reference: externalReference,
        notification_url: process.env.MP_WEBHOOK_URL || undefined,
      },
      requestOptions: buildRequestOptions(req),
    });

    const txData = result.point_of_interaction?.transaction_data || {};

    if (!result?.id || !txData?.qr_code || !txData?.qr_code_base64) {
      return res.status(502).json({
        error:
          "PIX criado sem dados completos de QR Code. Tente novamente em instantes.",
      });
    }

    return res.json({
      id: result.id,
      status: result.status,
      date_of_expiration: result.date_of_expiration,
      qr_code_base64: txData.qr_code_base64,
      qr_code: txData.qr_code,
      ticket_url: txData.ticket_url || null,
    });
  } catch (error) {
    const gatewayError = extractGatewayError(error);
    console.error("Erro ao gerar PIX Mercado Pago:", gatewayError.message);
    return res.status(502).json({
      error: "Erro ao gerar pagamento PIX no provedor.",
      providerMessage: gatewayError.message,
    });
  }
});

app.post(
  "/api/checkout/preference",
  ensureMercadoPagoConfigured,
  async (req, res) => {
    try {
      if (
        !req.body ||
        typeof req.body !== "object" ||
        Array.isArray(req.body)
      ) {
        return res.status(400).json({
          error: "Payload inválido para criação de checkout.",
        });
      }

      const items = Array.isArray(req.body?.items) ? req.body.items : [];

      if (!items.length || items.length > 50) {
        return res.status(400).json({
          error: "Checkout deve conter entre 1 e 50 itens.",
        });
      }

      const sanitizedItems = [];
      let checkoutTotal = 0;

      for (let idx = 0; idx < items.length; idx += 1) {
        const item = items[idx] || {};
        const title = String(item.title || item.name || "")
          .trim()
          .slice(0, 80);
        const quantityRaw = Number(item.quantity || item.qty || 0);
        const quantity = Number.isInteger(quantityRaw) ? quantityRaw : null;
        const unitPrice = clampAmount(item.unit_price || item.price || 0);

        if (
          !title ||
          !quantity ||
          quantity < 1 ||
          quantity > 100 ||
          !unitPrice
        ) {
          return res.status(400).json({
            error: `Item inválido na posição ${idx + 1}.`,
          });
        }

        checkoutTotal += quantity * unitPrice;
        sanitizedItems.push({
          title,
          quantity,
          unit_price: unitPrice,
          currency_id: "BRL",
        });
      }

      if (
        !Number.isFinite(checkoutTotal) ||
        checkoutTotal <= 0 ||
        checkoutTotal > 50000
      ) {
        return res.status(400).json({
          error: "Valor total do checkout inválido.",
        });
      }

      if (!sanitizedItems.length) {
        return res
          .status(400)
          .json({ error: "Nenhum item válido para checkout." });
      }

      const payer = normalizePayer(req.body?.payer || {});
      if (req.body?.payer && !payer) {
        return res.status(400).json({
          error: "Dados do pagador inválidos para checkout.",
        });
      }

      const externalReference = normalizeExternalReference(
        req.body?.external_reference,
        "checkout",
      );

      const frontendBaseUrl = buildFrontendBaseUrl();

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
        requestOptions: buildRequestOptions(req),
      });

      if (
        !response?.id ||
        (!response?.init_point && !response?.sandbox_init_point)
      ) {
        return res.status(502).json({
          error: "Checkout criado sem URL de pagamento.",
        });
      }

      return res.json({
        preferenceId: response.id,
        checkoutUrl: response.init_point,
        sandboxCheckoutUrl: response.sandbox_init_point,
      });
    } catch (error) {
      const gatewayError = extractGatewayError(error);
      console.error(
        "Erro ao criar preferência de checkout:",
        gatewayError.message,
      );
      return res.status(502).json({
        error: "Erro ao criar checkout online no provedor.",
        providerMessage: gatewayError.message,
      });
    }
  },
);

app.listen(PORT, () => {
  console.log(
    `Servidor de pagamentos rodando na porta ${PORT} com Mercado Pago em modo ${mpMode}`,
  );
});
