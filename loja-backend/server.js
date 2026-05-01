require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("node:crypto");
const { MercadoPagoConfig, Payment, Preference } = require("mercadopago");
const {
  initializeApp: initializeAdminApp,
  cert,
  applicationDefault,
  getApps: getAdminApps,
} = require("firebase-admin/app");
const { getAuth: getAdminAuth } = require("firebase-admin/auth");
const {
  getFirestore: getAdminFirestore,
  FieldValue,
  Timestamp,
} = require("firebase-admin/firestore");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const frontendUrls = (process.env.FRONTEND_URLS || "http://localhost:5173")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const mercadoPagoAccessToken = String(process.env.MP_ACCESS_TOKEN || "").trim();
const whatsappAccessToken = String(
  process.env.WHATSAPP_ACCESS_TOKEN || "",
).trim();
const whatsappApiVersion = String(
  process.env.WHATSAPP_API_VERSION || "v23.0",
).trim();
const whatsappDefaultPhoneNumberId = String(
  process.env.WHATSAPP_PHONE_NUMBER_ID || "",
).trim();
const whatsappBusinessAccountId = String(
  process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
).trim();
const zapiInstanceId = String(process.env.ZAPI_INSTANCE_ID || "").trim();
const zapiToken = String(process.env.ZAPI_TOKEN || "").trim();
const zapiClientToken = String(process.env.ZAPI_CLIENT_TOKEN || "").trim();
const customWebhookUrl = String(
  process.env.WHATSAPP_CUSTOM_WEBHOOK_URL || "",
).trim();
const customWebhookAuthHeaderName = String(
  process.env.WHATSAPP_CUSTOM_WEBHOOK_AUTH_HEADER_NAME || "Authorization",
).trim();
const customWebhookAuthHeaderValue = String(
  process.env.WHATSAPP_CUSTOM_WEBHOOK_AUTH_HEADER_VALUE || "",
).trim();
const botbotApiBaseUrl = String(
  process.env.BOTBOT_API_BASE_URL || "https://botbot.chat",
)
  .trim()
  .replace(/\/$/, "");
const botbotAppKey = String(process.env.BOTBOT_APP_KEY || "").trim();
const botbotAuthKey = String(process.env.BOTBOT_AUTH_KEY || "").trim();
const whatsappTemplateDebug =
  String(process.env.WHATSAPP_TEMPLATE_DEBUG || "").trim() === "1";
const whatsappProviderEnv = String(process.env.WHATSAPP_PROVIDER || "")
  .trim()
  .toLowerCase();
const workerEnabled = ["1", "true", "yes", "on"].includes(
  String(process.env.WHATSAPP_WORKER_ENABLED || "false")
    .trim()
    .toLowerCase(),
);
const workerIntervalMs = Math.min(
  60 * 60 * 1000,
  Math.max(15 * 1000, Number(process.env.WHATSAPP_WORKER_INTERVAL_MS) || 60000),
);
const workerLookbackDays = Math.min(
  90,
  Math.max(1, Number(process.env.WHATSAPP_WORKER_LOOKBACK_DAYS) || 21),
);
const workerAppId = String(
  process.env.WHATSAPP_WORKER_APP_ID || "minha-loja-oficial",
).trim();
const workerAdminToken = String(
  process.env.WHATSAPP_WORKER_ADMIN_TOKEN || "",
).trim();
const firebaseServiceAccountJson = String(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "",
).trim();
const firebaseProjectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();

const PASSWORD_RESET_PHONE_WINDOW_MS = 15 * 60 * 1000;
const PASSWORD_RESET_PHONE_MAX_ATTEMPTS = 3;
const passwordResetPhoneAttempts = new Map();

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

const normalizeWhatsAppRecipient = (value, defaultCountryCode = "55") => {
  const digits = String(value || "").replace(/\D/g, "");
  const countryCode = String(defaultCountryCode || "55").replace(/\D/g, "");

  if (!digits) return null;

  if (digits.length >= 12 && digits.length <= 15) {
    return digits;
  }

  if ((digits.length === 10 || digits.length === 11) && countryCode) {
    return `${countryCode}${digits}`;
  }

  return null;
};

const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "");

const normalizePhoneDigitsForLookup = (value) => {
  let digits = normalizePhoneDigits(value);
  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }
  if (digits.length > 11) {
    digits = digits.slice(-11);
  }
  return digits;
};

const formatBrazilianPhone = (digits) => {
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  return digits;
};

const buildPhoneLookupCandidates = (rawPhone) => {
  const localDigits = normalizePhoneDigitsForLookup(rawPhone);
  if (localDigits.length < 10) return [];

  const candidates = new Set([
    localDigits,
    formatBrazilianPhone(localDigits),
    `55${localDigits}`,
    `+55${localDigits}`,
  ]);

  if (localDigits.length === 11 && localDigits[2] === "9") {
    const withoutNine = `${localDigits.slice(0, 2)}${localDigits.slice(3)}`;
    candidates.add(withoutNine);
    candidates.add(formatBrazilianPhone(withoutNine));
    candidates.add(`55${withoutNine}`);
    candidates.add(`+55${withoutNine}`);
  }

  return [...candidates].filter(Boolean).slice(0, 10);
};

const registerPhoneResetAttempt = (phoneDigits) => {
  const now = Date.now();
  const key = String(phoneDigits || "").trim();
  if (!key) return { blocked: false };

  const previous = passwordResetPhoneAttempts.get(key) || [];
  const active = previous.filter(
    (ts) => Number(ts) > now - PASSWORD_RESET_PHONE_WINDOW_MS,
  );

  if (active.length >= PASSWORD_RESET_PHONE_MAX_ATTEMPTS) {
    passwordResetPhoneAttempts.set(key, active);
    return { blocked: true };
  }

  active.push(now);
  passwordResetPhoneAttempts.set(key, active);
  return { blocked: false };
};

const normalizeWhatsAppText = (value) => {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.slice(0, 4096);
};

const normalizeImageUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (!["https:", "http:"].includes(parsed.protocol)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
};

const waitMs = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });

const isWhatsAppConfigured = () => Boolean(botbotAppKey && botbotAuthKey);

const isZApiConfigured = () => Boolean(zapiInstanceId && zapiToken);
const isBotBotConfigured = () => Boolean(botbotAppKey && botbotAuthKey);
const isCustomWebhookConfigured = () => Boolean(customWebhookUrl);
const isCloudApiConfigured = () =>
  Boolean(whatsappAccessToken && whatsappDefaultPhoneNumberId);

const normalizeProviderName = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (["botbot", "manual_only"].includes(normalized)) {
    return normalized;
  }

  return "";
};

const resolvePreferredProvider = (value) => {
  const explicitProvider = normalizeProviderName(value);
  if (explicitProvider) return explicitProvider;

  const envProvider = normalizeProviderName(whatsappProviderEnv);
  if (envProvider) return envProvider;

  return "botbot";
};

const sendZApiTextMessage = async ({ to, text, defaultCountryCode }) => {
  if (!zapiInstanceId || !zapiToken) {
    throw new Error(
      "ZAPI_INSTANCE_ID e ZAPI_TOKEN não configurados no .env do backend.",
    );
  }

  const recipient = normalizeWhatsAppRecipient(to, defaultCountryCode);
  if (!recipient) {
    throw new Error(
      "Número de destino inválido. Use DDI + DDD + número, por exemplo 5511999999999.",
    );
  }

  const bodyText = normalizeWhatsAppText(text);
  if (!bodyText) {
    throw new Error("Mensagem vazia. Informe um texto para o disparo.");
  }

  const url = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
  const headers = { "Content-Type": "application/json" };
  if (zapiClientToken) headers["Client-Token"] = zapiClientToken;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone: recipient, message: bodyText }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage =
      payload?.error ||
      payload?.message ||
      "Falha ao enviar mensagem via Z-API.";
    throw new Error(providerMessage);
  }

  return payload;
};

const sendWhatsAppTextMessage = async ({
  to,
  text,
  phoneNumberId,
  defaultCountryCode,
}) => {
  if (!whatsappAccessToken) {
    throw new Error(
      "WHATSAPP_ACCESS_TOKEN não configurado no backend. Defina a credencial no .env do servidor.",
    );
  }

  const resolvedPhoneNumberId = String(
    phoneNumberId || whatsappDefaultPhoneNumberId,
  ).trim();
  if (!resolvedPhoneNumberId) {
    throw new Error(
      "WHATSAPP_PHONE_NUMBER_ID não configurado. Informe o ID no backend ou no payload.",
    );
  }

  const recipient = normalizeWhatsAppRecipient(to, defaultCountryCode);
  if (!recipient) {
    throw new Error(
      "Número de destino inválido. Use DDI + DDD + número, por exemplo 5511999999999.",
    );
  }

  const bodyText = normalizeWhatsAppText(text);
  if (!bodyText) {
    throw new Error("Mensagem vazia. Informe um texto para o disparo.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${whatsappApiVersion}/${resolvedPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${whatsappAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: {
          preview_url: false,
          body: bodyText,
        },
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage =
      payload?.error?.message ||
      payload?.error?.error_user_msg ||
      "Falha ao enviar mensagem no WhatsApp Cloud API.";
    throw new Error(providerMessage);
  }

  return payload;
};

const sendCustomWebhookMessage = async ({ to, text, defaultCountryCode }) => {
  if (!customWebhookUrl) {
    throw new Error("WHATSAPP_CUSTOM_WEBHOOK_URL não configurado no backend.");
  }

  const recipient = normalizeWhatsAppRecipient(to, defaultCountryCode);
  if (!recipient) {
    throw new Error(
      "Número de destino inválido. Use DDI + DDD + número, por exemplo 5511999999999.",
    );
  }

  const bodyText = normalizeWhatsAppText(text);
  if (!bodyText) {
    throw new Error("Mensagem vazia. Informe um texto para o disparo.");
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (customWebhookAuthHeaderName && customWebhookAuthHeaderValue) {
    headers[customWebhookAuthHeaderName] = customWebhookAuthHeaderValue;
  }

  const response = await fetch(customWebhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      provider: "custom_webhook",
      integration: botbotAppKey || botbotAuthKey ? "botbot" : "generic",
      to: recipient,
      phone: recipient,
      text: bodyText,
      message: bodyText,
      defaultCountryCode: String(defaultCountryCode || "55").trim(),
      botbot: {
        appKey: botbotAppKey || null,
        authKey: botbotAuthKey || null,
      },
      metadata: {
        source: "jn-ecomerce",
        sentAt: new Date().toISOString(),
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage =
      payload?.error ||
      payload?.message ||
      "Falha ao enviar mensagem via custom webhook.";
    throw new Error(providerMessage);
  }

  return payload;
};

const sendBotBotTextMessage = async ({
  to,
  text,
  defaultCountryCode,
  appKey,
  authKey,
  baseUrl,
}) => {
  const resolvedAppKey = String(appKey || botbotAppKey || "").trim();
  const resolvedAuthKey = String(authKey || botbotAuthKey || "").trim();
  const resolvedBaseUrl = String(
    baseUrl || botbotApiBaseUrl || "https://botbot.chat",
  )
    .trim()
    .replace(/\/$/, "");

  if (!resolvedAppKey || !resolvedAuthKey) {
    throw new Error(
      "BOTBOT_APP_KEY e BOTBOT_AUTH_KEY não configurados no backend.",
    );
  }

  const recipient = normalizeWhatsAppRecipient(to, defaultCountryCode);
  if (!recipient) {
    throw new Error(
      "Número de destino inválido. Use DDI + DDD + número, por exemplo 5511999999999.",
    );
  }

  const bodyText = normalizeWhatsAppText(text);
  if (!bodyText) {
    throw new Error("Mensagem vazia. Informe um texto para o disparo.");
  }

  const url = `${resolvedBaseUrl}/api/v2/sendText`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      appKey: resolvedAppKey,
      authKey: resolvedAuthKey,
    },
    body: JSON.stringify({
      to: recipient,
      message: bodyText,
      typingDelay: 1,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage =
      payload?.error ||
      payload?.message ||
      "Falha ao enviar mensagem via BotBot API.";
    throw new Error(providerMessage);
  }

  return payload;
};

const sendBotBotImageMessage = async ({
  to,
  text,
  imageUrl,
  defaultCountryCode,
  appKey,
  authKey,
  baseUrl,
}) => {
  const resolvedAppKey = String(appKey || botbotAppKey || "").trim();
  const resolvedAuthKey = String(authKey || botbotAuthKey || "").trim();
  const resolvedBaseUrl = String(
    baseUrl || botbotApiBaseUrl || "https://botbot.chat",
  )
    .trim()
    .replace(/\/$/, "");

  if (!resolvedAppKey || !resolvedAuthKey) {
    throw new Error(
      "BOTBOT_APP_KEY e BOTBOT_AUTH_KEY não configurados no backend.",
    );
  }

  const recipient = normalizeWhatsAppRecipient(to, defaultCountryCode);
  if (!recipient) {
    throw new Error(
      "Número de destino inválido. Use DDI + DDD + número, por exemplo 5511999999999.",
    );
  }

  const resolvedImageUrl = normalizeImageUrl(imageUrl);
  if (!resolvedImageUrl) {
    throw new Error("URL de imagem inválida para envio no WhatsApp.");
  }

  const caption = normalizeWhatsAppText(text || "Imagem da campanha");

  const url = `${resolvedBaseUrl}/api/v2/sendImage`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      appKey: resolvedAppKey,
      authKey: resolvedAuthKey,
    },
    body: JSON.stringify({
      to: recipient,
      image: resolvedImageUrl,
      imageUrl: resolvedImageUrl,
      caption,
      typingDelay: 1,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage =
      payload?.error ||
      payload?.message ||
      "Falha ao enviar imagem via BotBot API.";
    throw new Error(providerMessage);
  }

  return payload;
};

const sendBotBotMessageWithOptionalImage = async ({
  to,
  text,
  imageUrl,
  defaultCountryCode,
  appKey,
  authKey,
  baseUrl,
}) => {
  const resolvedImageUrl = normalizeImageUrl(imageUrl);
  if (!resolvedImageUrl) {
    return sendBotBotTextMessage({
      to,
      text,
      defaultCountryCode,
      appKey,
      authKey,
      baseUrl,
    });
  }

  try {
    return await sendBotBotImageMessage({
      to,
      text,
      imageUrl: resolvedImageUrl,
      defaultCountryCode,
      appKey,
      authKey,
      baseUrl,
    });
  } catch {
    const fallbackText = `${String(text || "").trim()}\n\nImagem: ${resolvedImageUrl}`;
    return sendBotBotTextMessage({
      to,
      text: fallbackText,
      defaultCountryCode,
      appKey,
      authKey,
      baseUrl,
    });
  }
};

const getAdminApp = () => {
  if (!getAdminApps().length) {
    if (firebaseServiceAccountJson) {
      const credentials = JSON.parse(firebaseServiceAccountJson);
      initializeAdminApp({ credential: cert(credentials) });
    } else {
      initializeAdminApp({
        credential: applicationDefault(),
        ...(firebaseProjectId ? { projectId: firebaseProjectId } : {}),
      });
    }
  }

  return getAdminApps()[0];
};

const getFirebaseAdminDb = () => {
  try {
    getAdminApp();
    return getAdminFirestore();
  } catch (error) {
    console.error(
      "Erro ao inicializar Firebase Admin:",
      error?.message || error,
    );
    return null;
  }
};

const getFirebaseAdminAuth = () => {
  try {
    const adminApp = getAdminApp();
    return getAdminAuth(adminApp);
  } catch (error) {
    console.error(
      "Erro ao inicializar Firebase Admin Auth:",
      error?.message || error,
    );
    return null;
  }
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const extractFirstName = (name) => {
  const full = String(name || "").trim();
  if (!full) return "cliente";
  return full.split(/\s+/)[0] || "cliente";
};

const resolveCustomerPhone = (data) => {
  const fromAddress = String(data?.address?.recebedorTelefone || "").trim();
  const fromCustomer = String(data?.customerPhone || "").trim();
  return fromAddress || fromCustomer;
};

const hasWhatsAppConsent = (data) => {
  const explicitConsentFields = [
    data?.customerWhatsappConsent,
    data?.whatsappConsent,
    data?.marketingConsent,
  ];
  if (explicitConsentFields.includes(false)) return false;
  return true;
};

const applyTemplate = (template, context, couponTag) => {
  let output = String(template || "").trim();
  const replacements = {
    "{{firstName}}": String(context.firstName || "cliente"),
    "{{storeName}}": String(context.storeName || "loja"),
    "{{orderNumber}}": String(context.orderNumber || ""),
    "{{status}}": String(context.status || ""),
    "{{couponCode}}": String(context.couponCode || ""),
  };

  if (couponTag && couponTag !== "{{couponCode}}") {
    replacements[couponTag] = String(context.couponCode || "");
  }

  Object.entries(replacements).forEach(([key, value]) => {
    output = output.split(key).join(value);
  });

  return output.replace(/\s{2,}/g, " ").trim();
};

const getWorkerSettingsRef = (db) =>
  db
    .collection("artifacts")
    .doc(workerAppId)
    .collection("public")
    .doc("data")
    .collection("settings")
    .doc("config");

const getAppSettingsRef = (db, targetAppId) =>
  db
    .collection("artifacts")
    .doc(String(targetAppId || workerAppId).trim() || workerAppId)
    .collection("public")
    .doc("data")
    .collection("settings")
    .doc("config");

const normalizeWorkerConfig = (rawSettings) => {
  const automation = rawSettings?.whatsappAutomation || {};

  const normalizeDelay = (value, fallback, min, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  };

  return {
    enabled: Boolean(automation.enabled),
    provider: resolvePreferredProvider(automation.provider),
    defaultCountryCode: String(automation.defaultCountryCode || "55").trim(),
    sendOnlyWithCustomerConsent:
      automation.sendOnlyWithCustomerConsent === undefined
        ? true
        : Boolean(automation.sendOnlyWithCustomerConsent),
    couponTag: String(automation.couponTag || "{{couponCode}}"),
    storeName: String(rawSettings?.storeName || "loja").trim() || "loja",
    abandonedCart: {
      enabled:
        automation?.abandonedCart?.enabled === undefined
          ? true
          : Boolean(automation.abandonedCart.enabled),
      delayHours: normalizeDelay(
        automation?.abandonedCart?.delayHours,
        24,
        1,
        240,
      ),
      template: String(
        automation?.abandonedCart?.template ||
          "Oi {{firstName}}, vi que você deixou produtos no carrinho da {{storeName}}.",
      ).trim(),
    },
    interestedLead: {
      enabled: Boolean(automation?.interestedLead?.enabled),
      delayHours: normalizeDelay(
        automation?.interestedLead?.delayHours,
        6,
        1,
        240,
      ),
      template: String(
        automation?.interestedLead?.template ||
          "Oi {{firstName}}, vi seu interesse em produtos da {{storeName}}.",
      ).trim(),
    },
    orderCreated: {
      enabled:
        automation?.orderCreated?.enabled === undefined
          ? true
          : Boolean(automation.orderCreated.enabled),
      template: String(
        automation?.orderCreated?.template ||
          "Oi {{firstName}}, recebemos seu pedido {{orderNumber}}.",
      ).trim(),
    },
    orderStatusChanged: {
      enabled:
        automation?.orderStatusChanged?.enabled === undefined
          ? true
          : Boolean(automation.orderStatusChanged.enabled),
      template: String(
        automation?.orderStatusChanged?.template ||
          "Oi {{firstName}}, seu pedido {{orderNumber}} foi atualizado para {{status}}.",
      ).trim(),
    },
    postPurchaseFollowUp: {
      enabled: Boolean(automation?.postPurchaseFollowUp?.enabled),
      delayDays: normalizeDelay(
        automation?.postPurchaseFollowUp?.delayDays,
        7,
        1,
        60,
      ),
      template: String(
        automation?.postPurchaseFollowUp?.template ||
          "Oi {{firstName}}, como foi seu pedido {{orderNumber}}?",
      ).trim(),
    },
  };
};

const pickCouponCodeByAppId = async (db, targetAppId) => {
  const resolvedAppId =
    String(targetAppId || workerAppId).trim() || workerAppId;

  try {
    const couponsSnap = await db
      .collection("artifacts")
      .doc(resolvedAppId)
      .collection("public")
      .doc("data")
      .collection("coupons")
      .limit(100)
      .get();

    const now = Date.now();
    const validCoupons = couponsSnap.docs
      .map((docSnap) => docSnap.data() || {})
      .filter((coupon) => {
        if (coupon.active === false) return false;
        if (!coupon.code) return false;
        const expiryValue = coupon.expiresAt || coupon.expiryDate;
        if (!expiryValue) return true;
        const expiryMs = toMillis(expiryValue);
        return !expiryMs || expiryMs >= now;
      })
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

    return String(validCoupons[0]?.code || "").trim();
  } catch {
    return "";
  }
};

const pickCouponCode = async (db) => pickCouponCodeByAppId(db, workerAppId);

const getCouponsByAppId = async (db, targetAppId) => {
  const resolvedAppId =
    String(targetAppId || workerAppId).trim() || workerAppId;

  try {
    const couponsSnap = await db
      .collection("artifacts")
      .doc(resolvedAppId)
      .collection("public")
      .doc("data")
      .collection("coupons")
      .limit(250)
      .get();

    return couponsSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
  } catch {
    return [];
  }
};

const findCouponByCode = (coupons, code) => {
  const normalizedCode = String(code || "")
    .trim()
    .toUpperCase();
  if (!normalizedCode) return null;

  return (Array.isArray(coupons) ? coupons : []).find(
    (coupon) =>
      String(coupon?.code || "")
        .trim()
        .toUpperCase() === normalizedCode,
  );
};

const formatCouponOfferMessage = (coupon) => {
  const code = String(coupon?.code || "")
    .trim()
    .toUpperCase();
  const type = String(coupon?.type || "percent")
    .trim()
    .toLowerCase();
  const value = Number(coupon?.value || 0);
  const firstPurchaseOnly = coupon?.firstPurchaseOnly === true;
  const restrictedProductIds = Array.isArray(coupon?.restrictedProductIds)
    ? coupon.restrictedProductIds
    : [];
  const hasRestrictedProducts = restrictedProductIds.length > 0;

  const normalizedValue = Number.isFinite(value) && value > 0 ? value : 0;

  let benefit = "desconto especial";
  if (type === "free_shipping") {
    return `${code} e tenha frete grátis.`;
  }

  if (type === "percent" || type === "percentage") {
    benefit = `${normalizedValue}% OFF`;
  } else if (type === "shipping_percent") {
    benefit = `${normalizedValue}% OFF no frete`;
  } else if (type === "shipping_fixed") {
    benefit = `R$ ${normalizedValue.toFixed(2)} OFF no frete`;
  } else {
    benefit = `R$ ${normalizedValue.toFixed(2)} OFF`;
  }

  let scope = ".";
  if (firstPurchaseOnly) {
    scope = " na primeira compra.";
  } else if (hasRestrictedProducts) {
    scope = " em produtos selecionados.";
  }

  return `${code} e tenha ${benefit}${scope}`;
};

const extractTemplateTokens = (template) => {
  const input = String(template || "");
  const found = [];
  let cursor = 0;

  while (cursor < input.length) {
    const open = input.indexOf("{{", cursor);
    if (open === -1) break;

    const close = input.indexOf("}}", open + 2);
    if (close === -1) break;

    const rawToken = input.slice(open + 2, close).trim();
    if (rawToken) found.push(rawToken);

    cursor = close + 2;
  }

  return [...new Set(found)];
};

const getCouponCodeTemplateTokens = (template) => {
  const knownTokens = new Set([
    "firstname",
    "storename",
    "ordernumber",
    "status",
    "couponcode",
  ]);
  const found = new Set();

  for (const token of extractTemplateTokens(template)) {
    const rawToken = String(token || "").trim();
    const normalizedToken = rawToken.toLowerCase();
    if (!knownTokens.has(normalizedToken)) {
      found.add(rawToken);
    }
  }

  return [...found];
};

const getTemplateTokens = (template) => extractTemplateTokens(template);

const ensureNoUnresolvedTemplateTokens = (text) => {
  const unresolved = getTemplateTokens(text);
  if (!unresolved.length) {
    const raw = String(text || "");
    if (raw.includes("{{") || raw.includes("}}")) {
      throw new Error(
        "A mensagem ainda contém placeholders malformados ({{ ou }}).",
      );
    }
    return;
  }

  throw new Error(
    `Ainda existem placeholders sem substituição na mensagem: ${unresolved
      .map((token) => `{{${token}}}`)
      .join(", ")}.`,
  );
};

const escapeRegExp = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceNamedCouponTemplateTokens = ({ text, coupons, tokens }) => {
  let output = String(text || "");
  const now = Date.now();

  for (const token of tokens) {
    const tokenCode = String(token || "")
      .trim()
      .toUpperCase();
    const coupon = findCouponByCode(coupons, tokenCode);

    if (!coupon) {
      throw new Error(
        `Cupom ${tokenCode} não encontrado para substituir {{${tokenCode}}}.`,
      );
    }

    if (coupon.active === false) {
      throw new Error(
        `Cupom ${tokenCode} está inativo e não pode ser usado na mensagem.`,
      );
    }

    const expiresMs = toMillis(coupon.expiresAt || coupon.expiryDate);
    if (expiresMs > 0 && expiresMs < now) {
      throw new Error(
        `Cupom ${tokenCode} está expirado e não pode ser usado na mensagem.`,
      );
    }

    const usageLimit = Number(coupon.usageLimit || 0);
    const usageCount = Number(coupon.usageCount || 0);
    if (usageLimit > 0 && usageCount >= usageLimit) {
      throw new Error(
        `Cupom ${tokenCode} está esgotado e não pode ser usado na mensagem.`,
      );
    }

    const placeholderRegex = new RegExp(
      `\\{\\{\\s*${escapeRegExp(token)}\\s*\\}\\}`,
      "gi",
    );
    output = output.replace(placeholderRegex, formatCouponOfferMessage(coupon));
  }

  return output;
};

const containsTemplateToken = (template, token) =>
  String(template || "").includes(`{{${token}}}`);

const resolveCustomerFirstNameByPhone = async ({ db, targetAppId, phone }) => {
  const candidates = buildPhoneLookupCandidates(phone);
  if (!candidates.length) return "";

  const customerSnap = await db
    .collection("artifacts")
    .doc(String(targetAppId || workerAppId).trim() || workerAppId)
    .collection("public")
    .doc("data")
    .collection("customers")
    .where("phone", "in", candidates)
    .limit(1)
    .get();

  if (customerSnap.empty) return "";

  const customerData = customerSnap.docs[0].data() || {};
  const fullName = String(customerData.name || "").trim();
  return extractFirstName(fullName);
};

const resolveStoreNameByAppId = async (db, targetAppId) => {
  try {
    const settingsSnap = await getAppSettingsRef(db, targetAppId).get();
    if (!settingsSnap.exists) return "loja";
    const settings = settingsSnap.data() || {};
    return String(settings.storeName || "loja").trim() || "loja";
  } catch {
    return "loja";
  }
};

const sendAutomatedMessage = async ({ config, to, text }) => {
  const provider = resolvePreferredProvider(config.provider);

  if (provider === "manual_only") {
    throw new Error(
      "Provider em modo manual_only. Nenhum envio automático será feito.",
    );
  }

  const result = await sendWhatsAppTextMessage({
    to,
    text,
    defaultCountryCode: config.defaultCountryCode,
  });

  return {
    provider: "botbot",
    messageId:
      result?.data?.messageId || result?.messageId || result?.id || null,
  };
};

let workerIntervalHandle = null;
let workerIsRunning = false;
let workerLastRunAt = null;
let workerLastError = null;
let workerStats = {
  scanned: 0,
  sent: 0,
  failed: 0,
};

const runWhatsAppWorkerTick = async ({ source = "interval" } = {}) => {
  if (!workerEnabled) {
    return { ok: false, skipped: true, reason: "worker_disabled" };
  }

  if (workerIsRunning) {
    return { ok: false, skipped: true, reason: "already_running" };
  }

  const db = getFirebaseAdminDb();
  if (!db) {
    return { ok: false, skipped: true, reason: "firebase_admin_unavailable" };
  }

  workerIsRunning = true;
  const start = Date.now();
  const now = Date.now();
  const lookbackLimit = now - workerLookbackDays * 24 * 60 * 60 * 1000;

  const localStats = {
    scanned: 0,
    sent: 0,
    failed: 0,
  };

  try {
    const settingsSnap = await getWorkerSettingsRef(db).get();
    const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
    const config = normalizeWorkerConfig(settings);

    if (!config.enabled) {
      workerLastRunAt = new Date().toISOString();
      workerLastError = null;
      workerStats = localStats;
      return { ok: true, source, skipped: true, reason: "automation_disabled" };
    }

    const couponCode = await pickCouponCode(db);
    let couponsCache = null;

    const getCouponsCache = async () => {
      if (couponsCache) return couponsCache;
      couponsCache = await getCouponsByAppId(db, workerAppId);
      return couponsCache;
    };

    const resolveNamedCouponTokensInText = async (text) => {
      const tokens = getCouponCodeTemplateTokens(text);
      if (!tokens.length) {
        ensureNoUnresolvedTemplateTokens(text);
        return text;
      }
      const coupons = await getCouponsCache();
      const replaced = replaceNamedCouponTemplateTokens({
        text,
        coupons,
        tokens,
      });
      ensureNoUnresolvedTemplateTokens(replaced);
      return replaced;
    };

    const saveSuccess = async (docRef, key, extra = {}) => {
      await docRef.set(
        {
          whatsappWorker: {
            [key]: {
              sentAt: FieldValue.serverTimestamp(),
              ...extra,
            },
          },
        },
        { merge: true },
      );
    };

    const saveFailure = async (docRef, key, errorMessage, extra = {}) => {
      await docRef.set(
        {
          whatsappWorker: {
            [key]: {
              lastAttemptAt: FieldValue.serverTimestamp(),
              lastError: String(errorMessage || "erro desconhecido").slice(
                0,
                300,
              ),
              ...extra,
            },
          },
        },
        { merge: true },
      );
    };

    if (config.abandonedCart.enabled) {
      const cartsSnap = await db
        .collection("artifacts")
        .doc(workerAppId)
        .collection("public")
        .doc("data")
        .collection("abandoned_carts")
        .limit(250)
        .get();

      for (const cartDoc of cartsSnap.docs) {
        const data = cartDoc.data() || {};
        localStats.scanned += 1;
        const baseTime = Math.max(
          toMillis(data.updatedAt),
          toMillis(data.createdAt),
        );
        if (!baseTime || baseTime < lookbackLimit) continue;

        const alreadySent = Boolean(
          data?.whatsappWorker?.abandonedCart?.sentAt,
        );
        if (alreadySent) continue;

        const delayMs = config.abandonedCart.delayHours * 60 * 60 * 1000;
        if (now - baseTime < delayMs) continue;

        if (config.sendOnlyWithCustomerConsent && !hasWhatsAppConsent(data))
          continue;

        const phone = resolveCustomerPhone(data);
        const text = await resolveNamedCouponTokensInText(
          applyTemplate(
            config.abandonedCart.template,
            {
              firstName: extractFirstName(data.customerName),
              storeName: config.storeName,
              couponCode,
            },
            config.couponTag,
          ),
        );

        try {
          const sent = await sendAutomatedMessage({ config, to: phone, text });
          await saveSuccess(cartDoc.ref, "abandonedCart", {
            provider: sent.provider,
            messageId: sent.messageId || null,
          });
          localStats.sent += 1;
        } catch (error) {
          await saveFailure(
            cartDoc.ref,
            "abandonedCart",
            error?.message || error,
          );
          localStats.failed += 1;
        }
      }
    }

    if (config.interestedLead.enabled) {
      const leadsSnap = await db
        .collection("artifacts")
        .doc(workerAppId)
        .collection("public")
        .doc("data")
        .collection("product_interest_leads")
        .limit(250)
        .get();

      for (const leadDoc of leadsSnap.docs) {
        const data = leadDoc.data() || {};
        localStats.scanned += 1;
        const baseTime = Math.max(
          toMillis(data.lastClickedAt),
          toMillis(data.createdAt),
        );
        if (!baseTime || baseTime < lookbackLimit) continue;

        const alreadySent = Boolean(
          data?.whatsappWorker?.interestedLead?.sentAt,
        );
        if (alreadySent) continue;

        const delayMs = config.interestedLead.delayHours * 60 * 60 * 1000;
        if (now - baseTime < delayMs) continue;

        if (config.sendOnlyWithCustomerConsent && !hasWhatsAppConsent(data))
          continue;

        const phone = resolveCustomerPhone(data);
        const text = await resolveNamedCouponTokensInText(
          applyTemplate(
            config.interestedLead.template,
            {
              firstName: extractFirstName(data.customerName),
              storeName: config.storeName,
              couponCode,
            },
            config.couponTag,
          ),
        );

        try {
          const sent = await sendAutomatedMessage({ config, to: phone, text });
          await saveSuccess(leadDoc.ref, "interestedLead", {
            provider: sent.provider,
            messageId: sent.messageId || null,
          });
          localStats.sent += 1;
        } catch (error) {
          await saveFailure(
            leadDoc.ref,
            "interestedLead",
            error?.message || error,
          );
          localStats.failed += 1;
        }
      }
    }

    const ordersSnap = await db
      .collection("artifacts")
      .doc(workerAppId)
      .collection("public")
      .doc("data")
      .collection("orders")
      .limit(350)
      .get();

    for (const orderDoc of ordersSnap.docs) {
      const data = orderDoc.data() || {};
      localStats.scanned += 1;
      const createdAtMs = toMillis(data.createdAt);
      if (!createdAtMs || createdAtMs < lookbackLimit) continue;

      const phone = resolveCustomerPhone(data);
      if (!phone) continue;
      if (config.sendOnlyWithCustomerConsent && !hasWhatsAppConsent(data))
        continue;

      if (
        config.orderCreated.enabled &&
        !data?.whatsappWorker?.orderCreated?.sentAt
      ) {
        const text = await resolveNamedCouponTokensInText(
          applyTemplate(
            config.orderCreated.template,
            {
              firstName: extractFirstName(data.customerName),
              storeName: config.storeName,
              orderNumber: data.orderNumber || orderDoc.id,
              status: data.status || "pendente_pagamento",
              couponCode,
            },
            config.couponTag,
          ),
        );

        try {
          const sent = await sendAutomatedMessage({ config, to: phone, text });
          await saveSuccess(orderDoc.ref, "orderCreated", {
            provider: sent.provider,
            messageId: sent.messageId || null,
          });
          localStats.sent += 1;
        } catch (error) {
          await saveFailure(
            orderDoc.ref,
            "orderCreated",
            error?.message || error,
          );
          localStats.failed += 1;
        }
      }

      if (config.orderStatusChanged.enabled) {
        const currentStatus = String(data.status || "").trim();
        const previousStatus = String(
          data?.whatsappWorker?.orderStatusChanged?.lastStatus || "",
        ).trim();

        if (currentStatus && currentStatus !== previousStatus) {
          const text = await resolveNamedCouponTokensInText(
            applyTemplate(
              config.orderStatusChanged.template,
              {
                firstName: extractFirstName(data.customerName),
                storeName: config.storeName,
                orderNumber: data.orderNumber || orderDoc.id,
                status: currentStatus,
                couponCode,
              },
              config.couponTag,
            ),
          );

          try {
            const sent = await sendAutomatedMessage({
              config,
              to: phone,
              text,
            });
            await saveSuccess(orderDoc.ref, "orderStatusChanged", {
              provider: sent.provider,
              messageId: sent.messageId || null,
              lastStatus: currentStatus,
            });
            localStats.sent += 1;
          } catch (error) {
            await saveFailure(
              orderDoc.ref,
              "orderStatusChanged",
              error?.message || error,
              { lastStatus: currentStatus },
            );
            localStats.failed += 1;
          }
        }
      }

      if (config.postPurchaseFollowUp.enabled) {
        const followUpSent = Boolean(
          data?.whatsappWorker?.postPurchaseFollowUp?.sentAt,
        );
        if (followUpSent) continue;

        const status = String(data.status || "")
          .trim()
          .toLowerCase();
        const allowedStatus = [
          "pago",
          "enviado",
          "entregue",
          "concluido",
          "aguardando_retirada",
        ].includes(status);
        if (!allowedStatus) continue;

        const base = Math.max(createdAtMs, toMillis(data.paymentApprovedAt));
        const delayMs =
          config.postPurchaseFollowUp.delayDays * 24 * 60 * 60 * 1000;
        if (!base || now - base < delayMs) continue;

        const text = await resolveNamedCouponTokensInText(
          applyTemplate(
            config.postPurchaseFollowUp.template,
            {
              firstName: extractFirstName(data.customerName),
              storeName: config.storeName,
              orderNumber: data.orderNumber || orderDoc.id,
              status,
              couponCode,
            },
            config.couponTag,
          ),
        );

        try {
          const sent = await sendAutomatedMessage({ config, to: phone, text });
          await saveSuccess(orderDoc.ref, "postPurchaseFollowUp", {
            provider: sent.provider,
            messageId: sent.messageId || null,
          });
          localStats.sent += 1;
        } catch (error) {
          await saveFailure(
            orderDoc.ref,
            "postPurchaseFollowUp",
            error?.message || error,
          );
          localStats.failed += 1;
        }
      }
    }

    workerLastRunAt = new Date().toISOString();
    workerLastError = null;
    workerStats = localStats;

    return {
      ok: true,
      source,
      durationMs: Date.now() - start,
      ...localStats,
    };
  } catch (error) {
    workerLastRunAt = new Date().toISOString();
    workerLastError = error?.message || String(error);
    workerStats = localStats;
    return {
      ok: false,
      source,
      durationMs: Date.now() - start,
      ...localStats,
      error: workerLastError,
    };
  } finally {
    workerIsRunning = false;
  }
};

const startWhatsAppWorker = () => {
  if (!workerEnabled) return;
  if (workerIntervalHandle) return;

  workerIntervalHandle = setInterval(() => {
    runWhatsAppWorkerTick({ source: "interval" }).then((result) => {
      if (!result?.ok && !result?.skipped) {
        console.error("Falha no tick do WhatsApp worker:", result?.error);
      }
    });
  }, workerIntervalMs);

  runWhatsAppWorkerTick({ source: "startup" }).then((result) => {
    if (result?.ok) {
      console.log(
        `WhatsApp worker inicializado. scanned=${result.scanned} sent=${result.sent} failed=${result.failed}`,
      );
    } else if (!result?.skipped) {
      console.error("Falha no bootstrap do WhatsApp worker:", result?.error);
    }
  });

  console.log(
    `WhatsApp worker ativo (intervalo: ${workerIntervalMs}ms, appId: ${workerAppId})`,
  );
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

const isFinalMpStatus = (status) => {
  const normalized = String(status || "").toLowerCase();
  return [
    "approved",
    "rejected",
    "cancelled",
    "refunded",
    "charged_back",
  ].includes(normalized);
};

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mpConfigured: hasMpToken,
    mpMode,
    whatsappConfigured: isWhatsAppConfigured(),
  });
});

app.get("/api/whatsapp/health", (req, res) => {
  const preferredProvider = "botbot";

  res.json({
    ok: true,
    configured: isWhatsAppConfigured(),
    botbotConfigured: isBotBotConfigured(),
    provider: preferredProvider,
    providerFromEnv: normalizeProviderName(whatsappProviderEnv) || null,
    botbotApiBaseUrl,
    botbotAppKeyConfigured: Boolean(botbotAppKey),
    botbotAuthKeyConfigured: Boolean(botbotAuthKey),
    loginUrl: "https://botbot.chat/",
  });
});

app.get("/api/whatsapp/worker/status", (req, res) => {
  const adminAuthorized =
    !workerAdminToken ||
    req.headers["x-worker-token"] === workerAdminToken ||
    req.query?.token === workerAdminToken;

  if (!adminAuthorized) {
    return res
      .status(401)
      .json({ error: "Não autorizado para status do worker." });
  }

  return res.json({
    ok: true,
    enabled: workerEnabled,
    running: workerIsRunning,
    intervalMs: workerIntervalMs,
    lookbackDays: workerLookbackDays,
    appId: workerAppId,
    lastRunAt: workerLastRunAt,
    lastError: workerLastError,
    stats: workerStats,
  });
});

app.post("/api/whatsapp/worker/run", async (req, res) => {
  const adminAuthorized =
    !workerAdminToken ||
    req.headers["x-worker-token"] === workerAdminToken ||
    req.query?.token === workerAdminToken;

  if (!adminAuthorized) {
    return res
      .status(401)
      .json({ error: "Não autorizado para executar o worker." });
  }

  const result = await runWhatsAppWorkerTick({ source: "manual" });
  if (!result.ok && !result.skipped) {
    return res.status(500).json(result);
  }

  return res.json(result);
});

app.post("/api/whatsapp/send-test", async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        error: "Payload inválido para envio de teste do WhatsApp.",
      });
    }

    const rawTemplate = String(req.body?.text || "").trim();
    if (!rawTemplate) {
      return res.status(400).json({
        error: "Informe uma mensagem para o envio de teste.",
      });
    }

    const resolvedAppId =
      String(req.body?.appId || workerAppId).trim() || workerAppId;
    const db = getFirebaseAdminDb();
    const requiresFirstName = containsTemplateToken(rawTemplate, "firstName");
    const requiresCouponCode = containsTemplateToken(rawTemplate, "couponCode");
    const couponCodeTokens = getCouponCodeTemplateTokens(rawTemplate);

    if (whatsappTemplateDebug) {
      console.log("[whatsapp-template-debug] rawTemplate:", rawTemplate);
      console.log(
        "[whatsapp-template-debug] couponCodeTokens:",
        couponCodeTokens,
      );
    }

    let firstName = "cliente";
    if (requiresFirstName) {
      if (!db) {
        return res.status(503).json({
          error:
            "Firebase Admin indisponível para resolver {{firstName}}. Configure FIREBASE_SERVICE_ACCOUNT_JSON.",
        });
      }

      firstName = await resolveCustomerFirstNameByPhone({
        db,
        targetAppId: resolvedAppId,
        phone: req.body?.to,
      });

      if (!firstName) {
        return res.status(400).json({
          error:
            "Nenhum cliente encontrado no banco para o número informado. Não foi possível substituir {{firstName}}.",
        });
      }
    }

    let couponCode = "";
    if (requiresCouponCode) {
      if (!db) {
        return res.status(503).json({
          error:
            "Firebase Admin indisponível para resolver {{couponCode}}. Configure FIREBASE_SERVICE_ACCOUNT_JSON.",
        });
      }

      couponCode = await pickCouponCodeByAppId(db, resolvedAppId);
      if (!couponCode) {
        return res.status(400).json({
          error:
            "Nenhum cupom ativo encontrado para substituir {{couponCode}}.",
        });
      }
    }

    const storeName = db
      ? await resolveStoreNameByAppId(db, resolvedAppId)
      : "loja";

    const resolvedText = applyTemplate(
      rawTemplate,
      {
        firstName,
        storeName,
        couponCode,
      },
      "{{couponCode}}",
    );

    let finalText = resolvedText;

    if (couponCodeTokens.length > 0) {
      if (!db) {
        return res.status(503).json({
          error:
            "Firebase Admin indisponível para resolver cupons por código. Configure FIREBASE_SERVICE_ACCOUNT_JSON.",
        });
      }

      const coupons = await getCouponsByAppId(db, resolvedAppId);
      try {
        finalText = replaceNamedCouponTemplateTokens({
          text: finalText,
          coupons,
          tokens: couponCodeTokens,
        });
      } catch (error) {
        return res.status(400).json({
          error:
            error?.message ||
            "Não foi possível substituir os cupons no template.",
        });
      }
    }

    try {
      ensureNoUnresolvedTemplateTokens(finalText);
    } catch (error) {
      return res.status(400).json({
        error:
          error?.message ||
          "Ainda existem placeholders sem substituição na mensagem.",
      });
    }

    if (whatsappTemplateDebug) {
      console.log("[whatsapp-template-debug] finalText:", finalText);
    }

    const result = await sendBotBotTextMessage({
      to: req.body?.to,
      text: finalText,
      defaultCountryCode: req.body?.defaultCountryCode,
      appKey: req.body?.botbotAppKey,
      authKey: req.body?.botbotAuthKey,
      baseUrl: req.body?.botbotApiBaseUrl,
    });

    return res.json({
      ok: true,
      provider: "botbot",
      resolvedText: finalText,
      messageId:
        result?.data?.messageId || result?.messageId || result?.id || null,
    });
  } catch (error) {
    console.error(
      "Erro no envio de teste do WhatsApp:",
      error?.message || error,
    );
    return res.status(502).json({
      error: error?.message || "Não foi possível enviar a mensagem de teste.",
    });
  }
});

app.post("/api/whatsapp/bulk-send", async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res
        .status(400)
        .json({ error: "Payload inválido para envio em massa." });
    }

    const rawTemplate = String(req.body?.text || "").trim();
    if (!rawTemplate) {
      return res
        .status(400)
        .json({ error: "Informe uma mensagem para o envio em massa." });
    }

    const inputContacts = Array.isArray(req.body?.contacts)
      ? req.body.contacts
      : [];
    if (!inputContacts.length) {
      return res
        .status(400)
        .json({ error: "Nenhum contato informado para envio." });
    }

    const mode = String(req.body?.mode || "bulk")
      .trim()
      .toLowerCase();

    const resolvedAppId =
      String(req.body?.appId || workerAppId).trim() || workerAppId;
    const db = getFirebaseAdminDb();
    const storeName = db
      ? await resolveStoreNameByAppId(db, resolvedAppId)
      : "loja";

    const rawDelayBetweenMs = Number(req.body?.delayBetweenMs);
    let delayBetweenMs = Number.isFinite(rawDelayBetweenMs)
      ? rawDelayBetweenMs
      : mode === "group"
        ? 30000
        : 0;
    delayBetweenMs = Math.min(Math.max(0, Math.round(delayBetweenMs)), 120000);

    const uniqueContacts = [];
    const dedupe = new Set();

    for (const item of inputContacts.slice(0, 1000)) {
      const phone = String(item?.phone || "").replace(/\D/g, "");
      if (!phone) continue;
      const dedupeKey = phone;
      if (dedupe.has(dedupeKey)) continue;
      dedupe.add(dedupeKey);
      uniqueContacts.push({
        id: String(item?.id || "").trim(),
        name: String(item?.name || "Cliente").trim() || "Cliente",
        phone,
      });
    }

    if (!uniqueContacts.length) {
      return res
        .status(400)
        .json({ error: "Nenhum contato válido encontrado para envio." });
    }

    const imageUrl = normalizeImageUrl(req.body?.imageUrl);
    let couponsCache = null;

    const replaceNamedCouponsIfNeeded = (text) => {
      const couponCodeTokens = getCouponCodeTemplateTokens(text);
      if (!couponCodeTokens.length) {
        ensureNoUnresolvedTemplateTokens(text);
        return text;
      }

      if (!db) {
        throw new Error(
          "Firebase Admin indisponível para resolver cupons no envio em massa.",
        );
      }

      if (!couponsCache) {
        throw new Error("COUPONS_CACHE_NOT_READY");
      }

      const replacedText = replaceNamedCouponTemplateTokens({
        text,
        coupons: couponsCache,
        tokens: couponCodeTokens,
      });
      ensureNoUnresolvedTemplateTokens(replacedText);
      return replacedText;
    };

    if (db) {
      couponsCache = await getCouponsByAppId(db, resolvedAppId);
    }

    const results = [];
    let sentCount = 0;
    let failedCount = 0;

    for (let index = 0; index < uniqueContacts.length; index += 1) {
      const contact = uniqueContacts[index];

      try {
        const textWithBasicTokens = applyTemplate(
          rawTemplate,
          {
            firstName: extractFirstName(contact.name),
            storeName,
            orderNumber: "",
            status: "",
            couponCode: "",
          },
          "{{couponCode}}",
        );

        let finalText;
        try {
          finalText = replaceNamedCouponsIfNeeded(textWithBasicTokens);
        } catch (tokenError) {
          if (tokenError?.message === "COUPONS_CACHE_NOT_READY") {
            return res.status(503).json({
              error:
                "Firebase Admin indisponível para resolver cupons no envio em massa.",
            });
          }
          throw tokenError;
        }

        const providerResult = await sendBotBotMessageWithOptionalImage({
          to: contact.phone,
          text: finalText,
          imageUrl,
          defaultCountryCode: req.body?.defaultCountryCode,
          appKey: req.body?.botbotAppKey,
          authKey: req.body?.botbotAuthKey,
          baseUrl: req.body?.botbotApiBaseUrl,
        });

        sentCount += 1;
        results.push({
          ok: true,
          contactId: contact.id || null,
          contactName: contact.name,
          phone: contact.phone,
          messageId:
            providerResult?.data?.messageId ||
            providerResult?.messageId ||
            providerResult?.id ||
            null,
        });
      } catch (error) {
        failedCount += 1;
        results.push({
          ok: false,
          contactId: contact.id || null,
          contactName: contact.name,
          phone: contact.phone,
          error: String(error?.message || "Falha no envio para o contato."),
        });
      }

      const hasNextContact = index < uniqueContacts.length - 1;
      if (hasNextContact && delayBetweenMs > 0) {
        await waitMs(delayBetweenMs);
      }
    }

    return res.json({
      ok: true,
      mode,
      totalContacts: uniqueContacts.length,
      sentCount,
      failedCount,
      delayBetweenMs,
      results,
    });
  } catch (error) {
    console.error(
      "Erro no envio em massa do WhatsApp:",
      error?.message || error,
    );
    return res.status(502).json({
      error: error?.message || "Não foi possível concluir o envio em massa.",
    });
  }
});

app.post("/api/auth/password-reset-phone", async (req, res) => {
  const genericSuccessMessage =
    "Se houver conta vinculada a este telefone, enviaremos as instrucoes de redefinicao via WhatsApp.";

  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "Payload invalido." });
    }

    const rawPhone = String(req.body?.phone || "").trim();
    const phoneCandidates = buildPhoneLookupCandidates(rawPhone);
    const normalizedLookupPhone = normalizePhoneDigitsForLookup(rawPhone);
    const resolvedAppId =
      String(req.body?.appId || workerAppId).trim() || workerAppId;

    if (phoneCandidates.length === 0 || normalizedLookupPhone.length < 10) {
      return res.status(400).json({
        error: "Informe um telefone valido com DDD.",
      });
    }

    const attemptStatus = registerPhoneResetAttempt(normalizedLookupPhone);
    if (attemptStatus.blocked) {
      return res.status(429).json({
        error:
          "Voce fez muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
      });
    }

    const db = getFirebaseAdminDb();
    const adminAuth = getFirebaseAdminAuth();

    if (!db || !adminAuth) {
      return res.status(503).json({
        error:
          "Servico de recuperacao por telefone indisponivel no momento. Tente recuperar por e-mail.",
      });
    }

    if (!isWhatsAppConfigured()) {
      return res.status(503).json({
        error:
          "WhatsApp nao configurado no servidor. Use a recuperacao por e-mail.",
      });
    }

    let matchedUid = "";
    let matchedEmail = "";

    const customersRef = db
      .collection("artifacts")
      .doc(resolvedAppId)
      .collection("public")
      .doc("data")
      .collection("customers");

    const customerSnap = await customersRef
      .where("phone", "in", phoneCandidates)
      .limit(1)
      .get();

    if (!customerSnap.empty) {
      const firstDoc = customerSnap.docs[0];
      matchedUid = firstDoc.id;
      matchedEmail = String(firstDoc.data()?.email || "")
        .trim()
        .toLowerCase();
    }

    if (!matchedUid || !isValidEmail(matchedEmail)) {
      const profileSnap = await db
        .collectionGroup("profile")
        .where("phone", "in", phoneCandidates)
        .limit(15)
        .get();

      if (!profileSnap.empty) {
        const matchedProfileDoc = profileSnap.docs.find((docSnap) => {
          const path = String(docSnap.ref.path || "");
          return path.startsWith(`artifacts/${resolvedAppId}/users/`);
        });

        if (matchedProfileDoc) {
          const pathParts = String(matchedProfileDoc.ref.path || "").split("/");
          const usersIndex = pathParts.indexOf("users");
          if (usersIndex >= 0 && pathParts[usersIndex + 1]) {
            matchedUid = pathParts[usersIndex + 1];
          }

          matchedEmail = String(matchedProfileDoc.data()?.email || "")
            .trim()
            .toLowerCase();
        }
      }
    }

    if (!matchedUid || !isValidEmail(matchedEmail)) {
      return res.json({ ok: true, message: genericSuccessMessage });
    }

    const resetLink = await adminAuth.generatePasswordResetLink(matchedEmail, {
      url: `${buildFrontendBaseUrl()}/`,
      handleCodeInApp: false,
    });

    const settingsSnap = await getAppSettingsRef(db, resolvedAppId).get();
    const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
    const automationConfig = normalizeWorkerConfig(settings);
    const defaultCountryCode = String(
      automationConfig.defaultCountryCode || "55",
    ).trim();

    const message = [
      "Pedido de recuperacao de senha recebido.",
      "Use este link seguro para redefinir sua senha:",
      resetLink,
      "Se voce nao solicitou esta acao, ignore esta mensagem.",
    ].join("\n\n");

    await sendAutomatedMessage({
      config: {
        provider: automationConfig.provider,
        defaultCountryCode,
      },
      to: normalizedLookupPhone,
      text: message,
    });

    return res.json({ ok: true, message: genericSuccessMessage });
  } catch (error) {
    console.error(
      "Erro ao processar recuperacao de senha por telefone:",
      error?.message || error,
    );

    return res.status(502).json({
      error:
        "Nao foi possivel enviar a recuperacao por telefone agora. Tente novamente ou use a recuperacao por e-mail.",
    });
  }
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

app.get(
  "/api/payment-status",
  ensureMercadoPagoConfigured,
  async (req, res) => {
    try {
      const paymentIdRaw = String(req.query?.paymentId || "").trim();
      const paymentId = Number(paymentIdRaw);

      if (!paymentIdRaw || !Number.isFinite(paymentId) || paymentId <= 0) {
        return res.status(400).json({
          error: "Informe um paymentId válido para consultar o status.",
        });
      }

      const payment = await paymentClient.get({ id: paymentId });
      const status = String(payment?.status || "").toLowerCase();

      if (!status) {
        return res.status(502).json({
          error: "Pagamento retornou sem status no provedor.",
        });
      }

      return res.json({
        paymentId: payment?.id || paymentId,
        status,
        statusDetail: payment?.status_detail || null,
        approved: status === "approved",
        isFinal: isFinalMpStatus(status),
        externalReference: payment?.external_reference || null,
        dateApproved: payment?.date_approved || null,
      });
    } catch (error) {
      const gatewayError = extractGatewayError(error);
      console.error(
        "Erro ao consultar status do pagamento:",
        gatewayError.message,
      );
      return res.status(502).json({
        error: "Erro ao consultar status do pagamento no provedor.",
        providerMessage: gatewayError.message,
      });
    }
  },
);

app.listen(PORT, () => {
  console.log(
    `Servidor de pagamentos rodando na porta ${PORT} com Mercado Pago em modo ${mpMode}`,
  );
  startWhatsAppWorker();
});
