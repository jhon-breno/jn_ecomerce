import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import DOMPurify from "dompurify";
import {
  ShoppingBag,
  ShoppingCart,
  Store,
  LayoutDashboard,
  Package,
  Tag,
  Plus,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  X,
  Smartphone,
  Monitor,
  DollarSign,
  Clock,
  Search,
  LogOut,
  User,
  MapPin,
  CreditCard,
  Printer,
  Settings,
  QrCode,
  Filter,
  ChevronLeft,
  ChevronRight,
  Truck,
  Map as MapIcon,
  MessageCircle,
  Edit,
  Eye,
  UserPlus,
  FileText,
  AlertTriangle,
  Upload,
  Download,
  ZoomIn,
  Maximize2,
} from "lucide-react";

// ATENÇÃO: Para o ambiente local, instale e importe o SDK do Mercado Pago aqui:
// npm install @mercadopago/sdk-react
// import { initMercadoPago, Payment } from "@mercadopago/sdk-react";

// --- Firebase Setup ---
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  setDoc,
  getDoc,
} from "firebase/firestore";

const BACKEND_URL = String(import.meta.env.VITE_BACKEND_URL || "")
  .trim()
  .replace(/\/$/, "");
const DEFAULT_MP_PUBLIC_KEY = String(
  import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY || "",
).trim();

const buildApiUrl = (path) =>
  BACKEND_URL ? `${BACKEND_URL}${path}` : String(path || "");

const shouldUseImageProxy = () => {
  return Boolean(BACKEND_URL);
};

const normalizeExternalImageUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (
    raw.startsWith("data:") ||
    raw.startsWith("blob:") ||
    raw.startsWith("/") ||
    raw.startsWith("./") ||
    raw.startsWith("../")
  ) {
    return raw;
  }

  if (/^https?:\/\/photo\.yupoo\.com\//i.test(raw)) {
    if (!shouldUseImageProxy()) {
      return raw;
    }

    return `${buildApiUrl("/api/image-proxy")}?url=${encodeURIComponent(raw)}`;
  }

  return raw;
};

const createIdempotencyKey = (scope) =>
  `${scope}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const ADMIN_EMAIL = "admin@jnfutshirt.com.br";
const ADMIN_PASSWORD = "Joao@2405";
const ADMIN_SESSION_KEY = "jn_admin_auth_v1";

// Configuração apontando para .env (Ambiente Local/Vite)

const appConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Fallback preventivo exclusivo para o ambiente de testes do Canvas
// const appConfig = typeof __firebase_config !== "undefined" ? JSON.parse(__firebase_config) : {};

const app = initializeApp(appConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "minha-loja-oficial"; // Este será o ID fixo da sua base de dados

// const app = initializeApp(appConfig);
// const auth = getAuth(app);
// const db = getFirestore(app);
// const appId = typeof __app_id !== "undefined" ? __app_id : "loja-virtual-app";

// --- Utilitários de Máscara ---
const maskCEP = (value) => {
  return value
    .replace(/\D/g, "")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(-\d{3})\d+?$/, "$1");
};

const maskPhone = (value) => {
  let v = value.replace(/\D/g, "");
  if (v.length <= 10) {
    return v.replace(/(\d{2})(\d{4})(\d)/, "($1) $2-$3");
  }
  return v.replace(/(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
};

const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "");

const formatContactPhone = (value) => {
  const digits = normalizePhoneDigits(value);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  return String(value || "").trim();
};

function InstagramBrandIcon({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="6"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

function FacebookBrandIcon({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M13.8 21V13.4H16.3L16.7 10.4H13.8V8.5C13.8 7.63 14.05 7.03 15.3 7.03H16.8V4.34C16.07 4.25 15.34 4.2 14.61 4.2C12.44 4.2 10.95 5.53 10.95 7.97V10.4H8.7V13.4H10.95V21H13.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

function YouTubeBrandIcon({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M10 9.7L15 12L10 14.3V9.7Z" fill="currentColor" />
    </svg>
  );
}

function TikTokBrandIcon({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M14 4V12.5C14 14.43 12.43 16 10.5 16C8.57 16 7 14.43 7 12.5C7 10.57 8.57 9 10.5 9C10.86 9 11.2 9.05 11.53 9.16V11.4C11.24 11.19 10.88 11.06 10.5 11.06C9.71 11.06 9.06 11.71 9.06 12.5C9.06 13.29 9.71 13.94 10.5 13.94C11.29 13.94 11.94 13.29 11.94 12.5V4H14ZM17.93 7.37C17.04 6.69 16.4 5.7 16.16 4.56H14.02C14.3 6.49 15.57 8.14 17.35 8.98C17.53 9.06 17.72 9.14 17.93 9.2V7.37Z"
        fill="currentColor"
      />
    </svg>
  );
}

const getRouteFromLocation = () => {
  const path = String(window.location.pathname || "").toLowerCase();
  const hash = String(window.location.hash || "")
    .replace(/^#/, "")
    .toLowerCase();

  if (path === "/admin") return "admin";
  if (hash === "/admin" || hash === "admin") return "admin";

  return "store";
};

const normalizePhoneList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeSocialLinks = (value) => {
  const links = value && typeof value === "object" ? value : {};
  return {
    whatsapp: String(links.whatsapp || "").trim(),
    instagram: String(links.instagram || "").trim(),
    facebook: String(links.facebook || "").trim(),
    youtube: String(links.youtube || "").trim(),
    tiktok: String(links.tiktok || "").trim(),
  };
};

const resolveSocialUrl = (platform, value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const cleaned = raw.replace(/^@/, "").replace(/^\/+/, "");
  switch (platform) {
    case "instagram":
      return `https://instagram.com/${cleaned}`;
    case "facebook":
      return `https://facebook.com/${cleaned}`;
    case "youtube":
      return `https://youtube.com/${cleaned}`;
    case "tiktok":
      return `https://tiktok.com/@${cleaned.replace(/^@/, "")}`;
    default:
      return `https://${cleaned}`;
  }
};

const sanitizePixText = (value, maxLength) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, maxLength);

const toPixTlv = (id, value) => {
  const val = String(value || "");
  return `${id}${String(val.length).padStart(2, "0")}${val}`;
};

const crc16Ccitt = (payload) => {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

const buildPixPayload = ({
  pixKey,
  amount,
  merchantName,
  merchantCity,
  txid,
}) => {
  const gui = toPixTlv("00", "BR.GOV.BCB.PIX");
  const key = toPixTlv("01", pixKey);
  const merchantAccount = toPixTlv("26", `${gui}${key}`);
  const merchant = sanitizePixText(merchantName || "LOJA", 25) || "LOJA";
  const city = sanitizePixText(merchantCity || "SAO PAULO", 15) || "SAO PAULO";
  const amountValue = Number(amount || 0).toFixed(2);
  const ref = sanitizePixText(txid || "PDV", 25) || "PDV";

  const payloadWithoutCrc = [
    toPixTlv("00", "01"),
    toPixTlv("01", "12"),
    merchantAccount,
    toPixTlv("52", "0000"),
    toPixTlv("53", "986"),
    toPixTlv("54", amountValue),
    toPixTlv("58", "BR"),
    toPixTlv("59", merchant),
    toPixTlv("60", city),
    toPixTlv("62", toPixTlv("05", ref)),
    "6304",
  ].join("");

  return `${payloadWithoutCrc}${crc16Ccitt(payloadWithoutCrc)}`;
};

const DEFAULT_PRODUCT_CATALOG = {
  sections: [],
  categories: [
    {
      name: "Camisetas",
      subcategories: ["Masculina", "Feminina", "Infantil"],
      subsubcategories: [],
      featured: true,
    },
    {
      name: "Calcas",
      subcategories: ["Jeans", "Sarja", "Moletom"],
      subsubcategories: [],
      featured: false,
    },
  ],
  variationTypes: [
    { name: "Tamanho", options: ["PP", "P", "M", "G", "GG"] },
    { name: "Cor", options: ["Preto", "Branco", "Azul"] },
  ],
};

const createCatalogSectionId = () =>
  `section_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeTextList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const estimateUtf8Bytes = (value) =>
  new TextEncoder().encode(String(value || "")).length;

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const sanitizeDescriptionHtml = (value) =>
  DOMPurify.sanitize(String(value || ""), {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "a",
      "img",
      "span",
      "div",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "caption",
      "colgroup",
      "col",
    ],
    ALLOWED_ATTR: [
      "href",
      "target",
      "rel",
      "src",
      "alt",
      "title",
      "colspan",
      "rowspan",
      "scope",
      "width",
      "height",
      "align",
      "valign",
    ],
  });

const toSafeDescriptionHtml = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "<p>Nenhuma descrição fornecida para este produto.</p>";
  }

  const hasHtml = /<[a-z][\s\S]*>/i.test(raw);
  const html = hasHtml
    ? raw
    : raw
        .split(/\n{2,}/)
        .map(
          (paragraph) =>
            `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
        )
        .join("");

  return sanitizeDescriptionHtml(html);
};

const stripInlineBase64Images = (html) =>
  String(html || "").replace(/<img[^>]+src=["']data:[^"']+["'][^>]*>/gi, "");

const buildSizeTableHtmlFromText = (value) => {
  const text = String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";

  const rowRegex =
    /((?:\d?\s*XL|[SPMLG])\s*\([^)]+\))\s*(\d{2,3}\s*cm)\s*(\d{2,3}\s*cm)/gi;
  const rows = [];
  let match = rowRegex.exec(text);
  while (match) {
    rows.push({
      size: String(match[1] || "")
        .replace(/\s+/g, " ")
        .trim(),
      chest: String(match[2] || "")
        .replace(/\s+/g, " ")
        .trim(),
      length: String(match[3] || "")
        .replace(/\s+/g, " ")
        .trim(),
    });
    match = rowRegex.exec(text);
  }

  if (rows.length === 0) return "";

  const body = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.size)}</td><td>${escapeHtml(row.chest)}</td><td>${escapeHtml(row.length)}</td></tr>`,
    )
    .join("");

  return `<table><thead><tr><th>Tamanho</th><th>Largura (Peito)</th><th>Comprimento (Altura)</th></tr></thead><tbody>${body}</tbody></table>`;
};

const getDescriptionPreviewText = (value, maxLength = 120) => {
  const text = String(value || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
};

const isInlineDataImage = (value) => /^data:image\//i.test(String(value || ""));

const recompressDataUrlImage = (dataUrl, maxWidth, quality) =>
  new Promise((resolve) => {
    if (!isInlineDataImage(dataUrl)) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const originalWidth = img.width || maxWidth;
      const originalHeight = img.height || maxWidth;
      const targetWidth = Math.min(maxWidth, originalWidth);
      const targetHeight = Math.max(
        1,
        Math.round(originalHeight * (targetWidth / originalWidth)),
      );

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

const optimizeProductImagesForPayload = async (
  productData,
  maxPayloadBytes = 900000,
) => {
  const profiles = [
    { maxWidth: 520, quality: 0.62 },
    { maxWidth: 460, quality: 0.55 },
    { maxWidth: 400, quality: 0.5 },
    { maxWidth: 340, quality: 0.44 },
  ];

  let bestData = productData;
  let bestBytes = estimateUtf8Bytes(JSON.stringify(productData));
  let currentImages = Array.isArray(productData.images)
    ? productData.images
    : [];

  for (const profile of profiles) {
    currentImages = await Promise.all(
      currentImages.map((img) =>
        recompressDataUrlImage(img, profile.maxWidth, profile.quality),
      ),
    );

    const candidate = {
      ...bestData,
      images: currentImages,
      image: currentImages[0] || "",
    };
    const candidateBytes = estimateUtf8Bytes(JSON.stringify(candidate));

    if (candidateBytes < bestBytes) {
      bestBytes = candidateBytes;
      bestData = candidate;
    }

    if (candidateBytes <= maxPayloadBytes) {
      return { data: candidate, bytes: candidateBytes, optimized: true };
    }
  }

  return {
    data: bestData,
    bytes: bestBytes,
    optimized: bestBytes < maxPayloadBytes,
  };
};

const getProductSubcategories = (product) => {
  const fromArray = Array.isArray(product?.subcategories)
    ? product.subcategories.map((item) => String(item || "").trim())
    : [];
  const legacy = String(product?.subcategory || "").trim();
  const merged = [...fromArray, legacy].filter(Boolean);
  return [...new Set(merged)];
};

const normalizeCatalog = (catalog) => {
  const base = catalog || {};
  const sections = Array.isArray(base.sections)
    ? base.sections
        .map((item) => ({
          id: String(item?.id || "").trim() || createCatalogSectionId(),
          name: String(item?.name || "").trim(),
        }))
        .filter((item) => item.name)
    : [];

  const categories = Array.isArray(base.categories)
    ? base.categories
        .map((item) => ({
          name: String(item?.name || "").trim(),
          featured: Boolean(item?.featured),
          subcategories: Array.isArray(item?.subcategories)
            ? item.subcategories
                .map((sub) => String(sub || "").trim())
                .filter(Boolean)
            : [],
          subsubcategories: Array.isArray(item?.subsubcategories)
            ? item.subsubcategories
                .map((sub) => String(sub || "").trim())
                .filter(Boolean)
            : [],
        }))
        .filter((item) => item.name)
    : [];

  const variationTypes = Array.isArray(base.variationTypes)
    ? base.variationTypes
        .map((item) => ({
          name: String(item?.name || "").trim(),
          options: Array.isArray(item?.options)
            ? item.options
                .map((opt) => String(opt || "").trim())
                .filter(Boolean)
            : [],
        }))
        .filter((item) => item.name)
    : [];

  return {
    sections,
    categories:
      categories.length > 0 ? categories : DEFAULT_PRODUCT_CATALOG.categories,
    variationTypes:
      variationTypes.length > 0
        ? variationTypes
        : DEFAULT_PRODUCT_CATALOG.variationTypes,
  };
};

const getProductVariationGroups = (product) => {
  if (
    product?.variationsByType &&
    typeof product.variationsByType === "object"
  ) {
    const groups = Object.entries(product.variationsByType)
      .map(([type, values]) => ({
        type,
        options: Array.isArray(values)
          ? values.map((opt) => String(opt || "").trim()).filter(Boolean)
          : [],
      }))
      .filter((group) => group.type && group.options.length > 0);

    const hasRealTypes = groups.some(
      (group) => group.type.toLowerCase() !== "opcao",
    );
    if (hasRealTypes) {
      return groups.filter((group) => group.type.toLowerCase() !== "opcao");
    }

    if (groups.length > 0) return groups;
  }

  const legacyVariations = normalizeTextList(product?.variations || "");
  if (legacyVariations.length === 0) return [];

  return [{ type: "Opcao", options: legacyVariations }];
};

const getDiscountMeta = (product) => {
  const salePrice = Number(product?.price || 0);
  const priceTag = Number(product?.priceTag || 0);

  if (!Number.isFinite(salePrice) || !Number.isFinite(priceTag)) {
    return { priceTag: 0, discountPct: 0 };
  }

  if (priceTag <= salePrice || salePrice <= 0) {
    return { priceTag: 0, discountPct: 0 };
  }

  const discountPct = Math.round(((priceTag - salePrice) / priceTag) * 100);
  return { priceTag, discountPct };
};

const formatCurrencyBRL = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function StoreProductCard({
  product,
  onOpenProduct,
  onAddToCart,
  isShelf = false,
}) {
  const { priceTag, discountPct } = getDiscountMeta(product);
  const hasVariations = getProductVariationGroups(product).length > 0;
  const descriptionPreview = getDescriptionPreviewText(
    product.description,
    110,
  );
  const coverImage = normalizeExternalImageUrl(
    product.images?.[0] || product.image,
  );

  return (
    <div
      onClick={() => onOpenProduct(product)}
      className={`bg-white ${isShelf ? "w-[165px] sm:w-[180px] md:w-[200px] shrink-0 snap-start" : "w-full"} rounded-[1.6rem] sm:rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-300/50 transition-all duration-500 group flex flex-col sm:hover:-translate-y-2 relative cursor-pointer`}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10"></div>

      <div
        className={`relative ${isShelf ? "aspect-[5/4]" : "aspect-[4/5] sm:aspect-[4/5]"} overflow-hidden bg-slate-50`}
      >
        {coverImage ? (
          <img
            src={coverImage}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-100/50">
            <ImageIcon size={48} className="drop-shadow-sm" />
          </div>
        )}

        {discountPct > 0 && (
          <span className="absolute top-3 right-3 bg-emerald-500 text-white text-[11px] font-black px-2.5 py-1.5 rounded-xl shadow-md z-20">
            -{discountPct}%
          </span>
        )}

        {Number(product.stock) <= 0 && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[4px] flex items-center justify-center z-20">
            <span className="bg-rose-500 text-white px-3 py-1.5 rounded-full font-black text-[11px] shadow-xl uppercase tracking-widest border-2 border-white/50">
              ESGOTADO
            </span>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4 md:p-5 flex flex-col flex-grow relative z-20 bg-white">
        <h3 className="font-bold text-[15px] sm:text-sm md:text-base text-slate-800 mb-2 line-clamp-2 leading-snug min-h-[2.5rem] group-hover:text-indigo-600 transition-colors">
          {product.name}
        </h3>
        {descriptionPreview && (
          <p className="text-[11px] sm:text-xs text-slate-500 mb-2 line-clamp-2 leading-relaxed min-h-[2rem]">
            {descriptionPreview}
          </p>
        )}

        <div className="mt-auto pt-3 border-t border-slate-100 space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col min-w-0">
              {priceTag > 0 ? (
                <span className="text-xs sm:text-sm text-rose-600 line-through font-black mb-1 line-clamp-1 tracking-wide">
                  {formatCurrencyBRL(priceTag)}
                </span>
              ) : null}
              <span className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 leading-none line-clamp-1">
                {formatCurrencyBRL(product.price)}
              </span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                if (hasVariations) {
                  onOpenProduct(product);
                } else {
                  onAddToCart(product);
                }
              }}
              disabled={Number(product.stock) <= 0}
              className="hidden md:flex bg-slate-900 group-hover:bg-gradient-to-r group-hover:from-indigo-500 group-hover:to-purple-500 disabled:bg-slate-100 disabled:text-slate-300 text-white w-11 h-11 rounded-full items-center justify-center shadow-md hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-300 hover:scale-110 disabled:hover:scale-100 active:scale-95 shrink-0"
            >
              <Plus strokeWidth={3} className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasVariations) {
                onOpenProduct(product);
              } else {
                onAddToCart(product);
              }
            }}
            disabled={Number(product.stock) <= 0}
            className="w-full md:hidden py-2.5 rounded-xl bg-slate-900 text-white font-black text-sm shadow-md active:scale-[0.99] disabled:bg-slate-100 disabled:text-slate-300"
          >
            {hasVariations ? "Ver opções" : "Comprar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Componente Global de Confirmação ---
function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmStyle = "bg-rose-600 hover:bg-rose-700",
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-slide-up border border-slate-100">
        <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 font-bold text-white rounded-xl shadow-md transition-all ${confirmStyle}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Application Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [abandonedCarts, setAbandonedCarts] = useState([]);
  const [storeSettings, setStoreSettings] = useState({
    storeName: "NovaLoja",
    storeTagline: "",
    logo: "",
    banners: [],
    footerDescription: "",
    contactPhones: [],
    socialLinks: {
      whatsapp: "",
      instagram: "",
      facebook: "",
      youtube: "",
      tiktok: "",
    },
    mpPublicKey: DEFAULT_MP_PUBLIC_KEY,
    pixKey: "",
    catalog: DEFAULT_PRODUCT_CATALOG,
    shipping: {
      pickupEnabled: true,
      correiosBaseRate: 25.0,
      localCities: [],
    },
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Inicializa o Mercado Pago Globalmente quando a chave estiver disponível (Apenas Localmente se descomentar os imports)
  /*
  useEffect(() => {
     if (storeSettings.mpPublicKey && typeof initMercadoPago !== 'undefined') {
       initMercadoPago(storeSettings.mpPublicKey, { locale: "pt-BR" });
     }
  }, [storeSettings.mpPublicKey]);
  */

  // Simples Hash Router
  const [currentRoute, setCurrentRoute] = useState(getRouteFromLocation());

  useEffect(() => {
    const syncRoute = () => setCurrentRoute(getRouteFromLocation());
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  const isAdminRoute = currentRoute === "admin";

  useEffect(() => {
    const savedSession = sessionStorage.getItem(ADMIN_SESSION_KEY);
    setIsAdminAuthenticated(savedSession === "ok");
  }, []);

  // --- Atualização Dinâmica do Título e Favicon ---
  useEffect(() => {
    const storeName = storeSettings.storeName || "NovaLoja";
    document.title = isAdminRoute
      ? `${storeName} - Setup`
      : `${storeName} - Loja`;

    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }

    const storeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`;
    const adminSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

    link.href = `data:image/svg+xml;utf8,${encodeURIComponent(isAdminRoute ? adminSvg : storeSvg)}`;
  }, [isAdminRoute, storeSettings.storeName]);

  // Auth Initialization
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        try {
          if (
            typeof __initial_auth_token !== "undefined" &&
            __initial_auth_token
          ) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error("Auth error:", error);
          setLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Data Fetching (Public Data)
  useEffect(() => {
    if (!user) return;

    const productsRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "products",
    );
    const unsubProducts = onSnapshot(
      productsRef,
      (snapshot) => {
        setProducts(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (err) => console.error(err),
    );

    const ordersRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "orders",
    );
    const unsubOrders = onSnapshot(
      ordersRef,
      (snapshot) => {
        const ords = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrders(
          ords.sort(
            (a, b) =>
              (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0),
          ),
        );
      },
      (err) => console.error(err),
    );

    const cartsRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "abandoned_carts",
    );
    const unsubCarts = onSnapshot(
      cartsRef,
      (snapshot) => {
        const carts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAbandonedCarts(
          carts.sort(
            (a, b) =>
              (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0),
          ),
        );
      },
      (err) => console.error(err),
    );

    const settingsRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "settings",
      "config",
    );
    const unsubSettings = onSnapshot(
      settingsRef,
      (docSnap) => {
        if (docSnap.exists())
          setStoreSettings((prev) => ({ ...prev, ...docSnap.data() }));
      },
      (err) => console.error(err),
    );

    return () => {
      unsubProducts();
      unsubOrders();
      unsubCarts();
      unsubSettings();
    };
  }, [user]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdminLogin = (email, password) => {
    const validEmail =
      String(email || "")
        .trim()
        .toLowerCase() === ADMIN_EMAIL;
    const validPassword = String(password || "") === ADMIN_PASSWORD;

    if (!validEmail || !validPassword) {
      showToast("Credenciais de administrador inválidas.", "error");
      return false;
    }

    sessionStorage.setItem(ADMIN_SESSION_KEY, "ok");
    setIsAdminAuthenticated(true);
    showToast("Acesso administrativo liberado.");
    return true;
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAdminAuthenticated(false);
    showToast("Sessão administrativa encerrada.");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-800">
      {/* Routing Logic */}
      {!isAdminRoute ? (
        <StoreFront
          products={products}
          user={user}
          showToast={showToast}
          storeSettings={storeSettings}
        />
      ) : !isAdminAuthenticated ? (
        <AdminAuthGate
          onLogin={handleAdminLogin}
          storeName={storeSettings.storeName}
          logo={storeSettings.logo}
        />
      ) : (
        <AdminDashboard
          products={products}
          orders={orders}
          abandonedCarts={abandonedCarts}
          showToast={showToast}
          storeSettings={storeSettings}
          onAdminLogout={handleAdminLogout}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-0 right-0 z-[200] flex justify-center px-4 pointer-events-none print:hidden">
          <div
            className={`pointer-events-auto w-full md:w-auto max-w-md p-4 md:px-6 md:py-4 rounded-2xl shadow-2xl text-white flex items-center gap-3 transition-all animate-slide-down ${
              toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={24} className="shrink-0" />
            ) : (
              <X size={24} className="shrink-0" />
            )}
            <span className="font-semibold text-sm md:text-base leading-tight break-words flex-1">
              {toast.message}
            </span>
          </div>
        </div>
      )}

      {/* Global & Print Styles */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes slide-down {
          from { transform: translateY(-150%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-down { animation: slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @keyframes whatsapp-float-pulse {
          0% { transform: translateY(0) scale(1); filter: drop-shadow(0 10px 16px rgba(16, 185, 129, 0.22)); }
          50% { transform: translateY(-3px) scale(1.035); filter: drop-shadow(0 16px 28px rgba(16, 185, 129, 0.35)); }
          100% { transform: translateY(0) scale(1); filter: drop-shadow(0 10px 16px rgba(16, 185, 129, 0.22)); }
        }
        
        @media print {
          @page { margin: 0; size: auto; }
          body { background: white; -webkit-print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:absolute { position: absolute !important; }
          .print\\:static { position: static !important; }
          .print\\:inset-0 { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }
          .print\\:bg-white { background-color: white !important; }
          .print\\:bg-transparent { background-color: transparent !important; }
          .print\\:w-\\[80mm\\] { width: 80mm !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:m-0 { margin: 0 !important; }
          .print\\:border-none { border: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          .print\\:backdrop-blur-none { backdrop-filter: none !important; }
        }
      `}</style>
    </div>
  );
}

function AdminAuthGate({ onLogin, storeName, logo }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <div className="min-h-[calc(100vh-36px)] bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 bg-slate-900 text-white text-center">
          {logo ? (
            <img
              src={logo}
              alt="Logo"
              className="h-12 w-auto mx-auto mb-3 object-contain"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-300 mx-auto mb-3 flex items-center justify-center">
              <Store size={24} />
            </div>
          )}
          <h2 className="text-xl font-black">Acesso Administrativo</h2>
          <p className="text-slate-300 text-sm mt-1">
            {storeName || "NovaLoja"} - área restrita
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
              E-mail admin
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="admin@empresa.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
              Senha
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition"
          >
            Entrar no Painel
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 1. ÁREA DO CLIENTE (STOREFRONT)
// ==========================================
function StoreFront({ products, user, showToast, storeSettings }) {
  const [cart, setCart] = useState([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [myOrders, setMyOrders] = useState([]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedSubcategory, setSelectedSubcategory] = useState("Todas");
  const [sortBy, setSortBy] = useState("relevancia");
  const [priceRange, setPriceRange] = useState("todos");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyWithVariations, setOnlyWithVariations] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeShowcaseSectionId, setActiveShowcaseSectionId] = useState("");
  const [productsPage, setProductsPage] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280,
  );
  const searchTerm = String(search || "").trim();
  const isSearchMode = searchTerm.length > 0;

  const isRealUser = user && !user.isAnonymous;
  const productCatalog = useMemo(
    () => normalizeCatalog(storeSettings?.catalog),
    [storeSettings?.catalog],
  );
  const socialLinks = useMemo(
    () => normalizeSocialLinks(storeSettings?.socialLinks),
    [storeSettings?.socialLinks],
  );
  const contactPhones = useMemo(
    () => normalizePhoneList(storeSettings?.contactPhones),
    [storeSettings?.contactPhones],
  );

  const whatsappDigits = normalizePhoneDigits(
    socialLinks.whatsapp || contactPhones[0] || "",
  );
  const whatsappHref = whatsappDigits
    ? `https://wa.me/55${whatsappDigits}?text=${encodeURIComponent(`Olá! Vim pela loja ${storeSettings?.storeName || ""} e quero atendimento.`)}`
    : "";

  const socialItems = [
    {
      label: "Instagram",
      href: resolveSocialUrl("instagram", socialLinks.instagram),
      icon: <InstagramBrandIcon size={14} />,
      short: "IG",
    },
    {
      label: "Facebook",
      href: resolveSocialUrl("facebook", socialLinks.facebook),
      icon: <FacebookBrandIcon size={14} />,
      short: "FB",
    },
    {
      label: "YouTube",
      href: resolveSocialUrl("youtube", socialLinks.youtube),
      icon: <YouTubeBrandIcon size={14} />,
      short: "YT",
    },
    {
      label: "TikTok",
      href: resolveSocialUrl("tiktok", socialLinks.tiktok),
      icon: <TikTokBrandIcon size={14} />,
      short: "TT",
    },
  ].filter((item) => item.href);
  const hasContactPhones = contactPhones.length > 0;
  const hasSocialLinks = socialItems.length > 0;
  const formattedContactPhones = contactPhones.map((phone) => ({
    raw: phone,
    label: formatContactPhone(phone),
  }));

  // Buscar perfil do utilizador
  useEffect(() => {
    if (user && !user.isAnonymous) {
      const unsub = onSnapshot(
        doc(db, "artifacts", appId, "users", user.uid, "profile", "info"),
        (docSnap) => {
          if (docSnap.exists()) setUserProfile(docSnap.data());
        },
      );
      return () => unsub();
    }
  }, [user]);

  // Buscar pedidos do cliente logado
  useEffect(() => {
    if (!isRealUser || !user?.uid) return;

    const ordersQuery = query(
      collection(db, "artifacts", appId, "public", "data", "orders"),
      where("customerId", "==", user.uid),
    );

    const unsub = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((orderDoc) => ({
          id: orderDoc.id,
          ...orderDoc.data(),
        }));
        setMyOrders(
          docs.sort(
            (a, b) =>
              (b.createdAt?.toMillis?.() || 0) -
              (a.createdAt?.toMillis?.() || 0),
          ),
        );
      },
      (error) => {
        console.error("Erro ao carregar pedidos do cliente:", error);
      },
    );

    return () => unsub();
  }, [isRealUser, user]);

  // Carregar carrinho salvo
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const fetchCart = async () => {
      try {
        const cartDoc = await getDoc(
          doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "abandoned_carts",
            user.uid,
          ),
        );
        if (isMounted) {
          if (cartDoc.exists()) {
            setCart(cartDoc.data().items || []);
          }
          setCartLoaded(true);
        }
      } catch (err) {
        console.error("Erro ao carregar carrinho salvo:", err);
        if (isMounted) setCartLoaded(true);
      }
    };
    fetchCart();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const cartTotal = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.qty,
    0,
  );

  // Sincronizar carrinho
  useEffect(() => {
    if (!user || !cartLoaded) return;
    const cartRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "abandoned_carts",
      user.uid,
    );
    if (cart.length > 0) {
      setDoc(
        cartRef,
        {
          customerId: user.uid,
          customerEmail: user.email || "Anônimo",
          customerName: userProfile
            ? `${userProfile.firstName} ${userProfile.lastName}`
            : "N/A",
          customerPhone: userProfile ? userProfile.phone : "N/A",
          items: cart,
          total: cartTotal,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ).catch(console.error);
    } else {
      deleteDoc(cartRef).catch(() => {});
    }
  }, [cart, user, cartLoaded, cartTotal, userProfile]);

  const categories = [
    "Todas",
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ];

  const subcategories = [
    "Todas",
    ...new Set(
      products
        .filter((p) =>
          selectedCategory === "Todas" ? true : p.category === selectedCategory,
        )
        .flatMap((p) => getProductSubcategories(p))
        .filter(Boolean),
    ),
  ];

  const effectiveSubcategory = subcategories.includes(selectedSubcategory)
    ? selectedSubcategory
    : "Todas";

  // Adiciona ao carrinho validando o estoque
  const addToCart = (product, qty = 1) => {
    const cartItemId = product.selectedVariation
      ? `${product.id}-${product.selectedVariation}`
      : product.id;

    const existingItem = cart.find(
      (item) => (item.cartItemId || item.id) === cartItemId,
    );
    const currentQtyInCart = existingItem ? existingItem.qty : 0;

    // Trava de Estoque para Web
    if (currentQtyInCart + qty > Number(product.stock)) {
      return showToast(
        `Temos apenas ${product.stock} unidade(s) em estoque!`,
        "error",
      );
    }

    setCart((prev) => {
      if (existingItem) {
        return prev.map((item) =>
          (item.cartItemId || item.id) === cartItemId
            ? { ...item, qty: item.qty + qty }
            : item,
        );
      }
      return [...prev, { ...product, cartItemId: cartItemId, qty }];
    });
    showToast(`${product.name} adicionado!`);
  };

  // Atualiza quantidade no Carrinho validando o estoque
  const updateQty = (cartItemId, delta) => {
    const itemToUpdate = cart.find(
      (i) => (i.cartItemId || i.id) === cartItemId,
    );

    if (itemToUpdate && itemToUpdate.qty + delta > Number(itemToUpdate.stock)) {
      return showToast(
        `Limite de ${itemToUpdate.stock} unidade(s) atingido!`,
        "error",
      );
    }

    setCart((prev) =>
      prev.map((item) =>
        (item.cartItemId || item.id) === cartItemId
          ? { ...item, qty: Math.max(1, item.qty + delta) }
          : item,
      ),
    );
  };

  const removeFromCart = (cartItemId) =>
    setCart((prev) =>
      prev.filter((item) => (item.cartItemId || item.id) !== cartItemId),
    );

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "Todas" || p.category === selectedCategory;
    const productSubcategories = getProductSubcategories(p);
    const matchesSubcategory =
      effectiveSubcategory === "Todas" ||
      productSubcategories.includes(effectiveSubcategory);
    const variationGroups = getProductVariationGroups(p);

    const matchesPriceRange =
      priceRange === "todos"
        ? true
        : priceRange === "ate_99"
          ? Number(p.price) <= 99
          : priceRange === "100_199"
            ? Number(p.price) >= 100 && Number(p.price) <= 199
            : priceRange === "200_399"
              ? Number(p.price) >= 200 && Number(p.price) <= 399
              : Number(p.price) >= 400;

    return (
      matchesSearch &&
      matchesCategory &&
      matchesSubcategory &&
      matchesPriceRange &&
      (!onlyInStock || Number(p.stock) > 0) &&
      (!onlyWithVariations || variationGroups.length > 0)
    );
  });

  const textSearchProducts = products.filter((p) =>
    String(p?.name || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === "menor_preco") return Number(a.price) - Number(b.price);
    if (sortBy === "maior_preco") return Number(b.price) - Number(a.price);
    if (sortBy === "nome_az") {
      return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
    }
    return 0;
  });

  const visibleProducts = isSearchMode ? textSearchProducts : sortedProducts;

  const productGridColumns =
    viewportWidth >= 1280
      ? 5
      : viewportWidth >= 1024
        ? 4
        : viewportWidth >= 768
          ? 3
          : 2;

  const productsPerPage = productGridColumns * 3;
  const totalProductPages = Math.max(
    1,
    Math.ceil(visibleProducts.length / productsPerPage),
  );

  const paginatedProducts = visibleProducts.slice(
    (productsPage - 1) * productsPerPage,
    productsPage * productsPerPage,
  );

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setProductsPage(1);
  }, [
    search,
    selectedCategory,
    effectiveSubcategory,
    sortBy,
    priceRange,
    onlyInStock,
    onlyWithVariations,
    productsPerPage,
  ]);

  useEffect(() => {
    if (productsPage > totalProductPages) {
      setProductsPage(totalProductPages);
    }
  }, [productsPage, totalProductPages]);

  const showcaseSections = (productCatalog.sections || [])
    .map((section) => ({
      ...section,
      products: products.filter((product) =>
        Array.isArray(product.showcaseSections)
          ? product.showcaseSections.includes(section.id)
          : false,
      ),
    }))
    .filter((section) => section.products.length > 0);

  useEffect(() => {
    if (!activeShowcaseSectionId) return;
    const exists = showcaseSections.some(
      (section) => section.id === activeShowcaseSectionId,
    );
    if (!exists) {
      setActiveShowcaseSectionId("");
    }
  }, [activeShowcaseSectionId, showcaseSections]);

  const startCheckout = () => {
    if (!isRealUser) {
      setIsCartOpen(false);
      setIsAuthModalOpen(true);
      showToast("Crie uma conta ou faça login para finalizar.", "success");
    } else {
      setIsCartOpen(false);
      setIsCheckoutOpen(true);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-36px)] bg-slate-50/50 print:hidden flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4 flex flex-col gap-4">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl p-1.5 bg-gradient-to-br from-amber-200 via-rose-100 to-sky-100 shadow-md shrink-0">
                <div className="w-full h-full rounded-xl bg-white flex items-center justify-center overflow-hidden">
                  {storeSettings.logo ? (
                    <img
                      src={storeSettings.logo}
                      alt="Logo da Loja"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <ShoppingBag size={24} className="text-slate-700" />
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 truncate leading-tight">
                  {storeSettings.storeName || "Aucela Multimarcas"}
                </h1>
                {storeSettings.storeTagline && (
                  <p className="text-xs md:text-sm text-slate-500 font-semibold truncate">
                    {storeSettings.storeTagline}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              {isRealUser ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-slate-700 hidden md:block">
                    Olá, {user.email ? user.email.split("@")[0] : "Usuário"}
                  </span>
                  <button
                    onClick={() => setIsAccountOpen(true)}
                    className="flex items-center gap-2 text-slate-700 hover:text-indigo-600 font-bold text-sm transition bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-full"
                    title="Minha Conta"
                  >
                    <FileText size={18} />
                    <span className="hidden sm:inline">Minha Conta</span>
                  </button>
                  <button
                    onClick={() => signOut(auth)}
                    className="text-slate-500 hover:text-rose-500 transition"
                    title="Sair"
                  >
                    <LogOut size={22} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-2 text-slate-700 hover:text-indigo-600 font-bold text-sm transition bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-full"
                >
                  <User size={18} />{" "}
                  <span className="hidden sm:inline">Entrar / Cadastrar</span>
                </button>
              )}

              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2.5 text-slate-700 hover:text-white hover:bg-gradient-to-r hover:from-indigo-600 hover:to-purple-600 hover:shadow-md transition-all duration-300 bg-slate-200 rounded-full hover:scale-105"
              >
                <ShoppingCart size={22} />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[11px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow-md border-2 border-white ring-2 ring-rose-500/20">
                    {cart.reduce((sum, item) => sum + item.qty, 0)}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 items-center">
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Buscar produtos, marcas e estilos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-100 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 border border-slate-200"
              />
            </div>
          </div>
        </div>
      </header>

      {!isSearchMode && (
        <>
          {/* Banners Carousel */}
          <BannerCarousel banners={storeSettings.banners} />

          {/* Hero Section */}
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white py-14 px-4 text-center border-b-[5px] border-amber-400 shadow-2xl">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-black mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-amber-100 drop-shadow-2xl">
                Seu Estilo, Sua Vitrine
              </h2>
              <p className="text-sm md:text-base text-slate-200 max-w-2xl mx-auto">
                Filtros rapidos, categorias inteligentes e colecoes em destaque
                para facilitar a compra no celular e no desktop.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Product Grid */}
      <main className="max-w-[1400px] mx-auto px-4 py-8 md:py-12 pb-20 md:pb-10 flex-1 w-full">
        {!isSearchMode && showcaseSections.length > 0 && (
          <div className="space-y-6 mb-10">
            {showcaseSections
              .filter((section) =>
                activeShowcaseSectionId
                  ? section.id === activeShowcaseSectionId
                  : true,
              )
              .map((section) => {
                const isExpanded = section.id === activeShowcaseSectionId;

                return (
                  <section
                    key={section.id}
                    className="bg-white border border-slate-200 rounded-3xl shadow-sm p-4 md:p-5"
                  >
                    <div className="flex items-end justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-lg md:text-xl font-black text-slate-800">
                          {section.name}
                        </h3>
                        <p className="text-xs md:text-sm text-slate-500 font-semibold">
                          {isExpanded
                            ? "Todos os produtos desta sessão"
                            : "Deslize para ver mais produtos desta sessão"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs md:text-sm font-black text-indigo-600 whitespace-nowrap">
                          {section.products.length} item(ns)
                        </span>
                        <button
                          onClick={() =>
                            setActiveShowcaseSectionId((prev) =>
                              prev === section.id ? "" : section.id,
                            )
                          }
                          className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs md:text-sm font-black transition"
                        >
                          {isExpanded ? "Voltar" : "Ver todos"}
                        </button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                        {section.products.map((product) => (
                          <StoreProductCard
                            key={`${section.id}-${product.id}`}
                            product={product}
                            onOpenProduct={setSelectedProduct}
                            onAddToCart={addToCart}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex gap-3 md:gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory pb-1">
                        {section.products.map((product) => (
                          <StoreProductCard
                            key={`${section.id}-${product.id}`}
                            product={product}
                            onOpenProduct={setSelectedProduct}
                            onAddToCart={addToCart}
                            isShelf
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
          </div>
        )}

        {!isSearchMode && (
          <div className="mb-8 bg-white border border-slate-200 rounded-3xl shadow-sm p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2">
                <Filter size={20} className="text-indigo-500" />
                Funil de Filtros
              </h3>
              <span className="text-xs md:text-sm text-slate-500 font-semibold bg-slate-100 px-3 py-1 rounded-full">
                {sortedProducts.length} produto(s) encontrado(s)
              </span>
            </div>

            <div className="space-y-4">
              {categories.length > 1 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Categoria
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setSelectedSubcategory("Todas");
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                          selectedCategory === cat
                            ? "bg-slate-900 text-white shadow-md"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {subcategories.length > 1 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Subcategoria
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {subcategories.map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setSelectedSubcategory(sub)}
                        className={`px-3.5 py-1.5 rounded-full text-xs md:text-sm font-bold transition-all ${
                          effectiveSubcategory === sub
                            ? "bg-amber-500 text-white shadow"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Ordenar por valor
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="relevancia">Mais relevantes</option>
                    <option value="menor_preco">Menor valor</option>
                    <option value="maior_preco">Maior valor</option>
                    <option value="nome_az">Nome A-Z</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Faixa de valor
                  </label>
                  <select
                    value={priceRange}
                    onChange={(e) => setPriceRange(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="todos">Todos os valores</option>
                    <option value="ate_99">Até R$ 99</option>
                    <option value="100_199">R$ 100 a R$ 199</option>
                    <option value="200_399">R$ 200 a R$ 399</option>
                    <option value="400_plus">Acima de R$ 400</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end gap-2">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={onlyInStock}
                      onChange={(e) => setOnlyInStock(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                    />
                    Somente em estoque
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={onlyWithVariations}
                      onChange={(e) => setOnlyWithVariations(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                    />
                    Com variações
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {visibleProducts.length === 0 ? (
          <div className="text-center py-24 bg-white/50 backdrop-blur rounded-3xl border border-slate-200/50 shadow-sm mt-8 max-w-2xl mx-auto">
            <Package
              size={64}
              className="mx-auto text-indigo-200 mb-6 drop-shadow-sm"
            />
            <h3 className="text-xl font-bold text-slate-600">
              Nenhum produto localizado.
            </h3>
            <p className="text-slate-400 mt-2">Tente buscar por outro termo.</p>
          </div>
        ) : (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-xl md:text-2xl font-black text-slate-900">
                  {isSearchMode
                    ? `Resultados para "${searchTerm}"`
                    : "Todos os produtos"}
                </h3>
                <p className="text-sm text-slate-500 font-semibold">
                  {isSearchMode
                    ? `${visibleProducts.length} produto(s) correspondente(s).`
                    : "Abaixo fica o catálogo completo com os filtros atuais."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5 md:gap-8">
              {paginatedProducts.map((product) => (
                <StoreProductCard
                  key={product.id}
                  product={product}
                  onOpenProduct={setSelectedProduct}
                  onAddToCart={addToCart}
                />
              ))}
            </div>

            {totalProductPages > 1 && (
              <div className="pt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() =>
                    setProductsPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={productsPage === 1}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  <ChevronLeft size={16} /> Anterior
                </button>

                <span className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-black">
                  {productsPage}
                </span>

                <span className="text-sm font-semibold text-slate-500">
                  de {totalProductPages}
                </span>

                <button
                  onClick={() =>
                    setProductsPage((prev) =>
                      Math.min(totalProductPages, prev + 1),
                    )
                  }
                  disabled={productsPage === totalProductPages}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Proxima <ChevronRight size={16} />
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="bg-slate-950 text-slate-200 border-t border-slate-800 mt-auto">
        <div className="max-w-[1400px] mx-auto px-4 py-10 md:py-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            <div className="space-y-4">
              <h3 className="text-2xl font-black text-white">
                {storeSettings.storeName || "Aucela Multimarcas"}
              </h3>

              {storeSettings.footerDescription && (
                <p className="text-sm text-slate-400 leading-relaxed max-w-md">
                  {storeSettings.footerDescription}
                </p>
              )}

              {(storeSettings.storeTagline || storeSettings.logo) && (
                <div className="flex items-center gap-2.5 text-slate-400">
                  {storeSettings.logo && (
                    <img
                      src={storeSettings.logo}
                      alt="Logo da Loja"
                      className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 border border-slate-700"
                    />
                  )}
                  {storeSettings.storeTagline && (
                    <p className="text-sm leading-relaxed">
                      {storeSettings.storeTagline}
                    </p>
                  )}
                </div>
              )}
            </div>

            {hasContactPhones && (
              <div className="space-y-3">
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-300">
                  Contato
                </h4>
                <div className="space-y-2">
                  {formattedContactPhones.map((phone) => (
                    <a
                      key={phone.raw}
                      href={`tel:${normalizePhoneDigits(phone.raw)}`}
                      className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition"
                    >
                      <Smartphone size={15} /> {phone.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {hasSocialLinks && (
              <div className="space-y-3">
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-300">
                  Redes Sociais
                </h4>
                <div className="flex flex-wrap gap-2">
                  {socialItems.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-900 border border-slate-700 hover:border-indigo-400 hover:text-white transition text-sm"
                    >
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-[10px] font-black">
                        {item.icon || item.short}
                      </span>
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 pt-5 border-t border-slate-800 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span>
              © {new Date().getFullYear()}{" "}
              {storeSettings.storeName || "JN Store"}
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-400/30 text-[11px] font-black text-emerald-200 uppercase tracking-wider">
                <CreditCard size={13} /> Pagamento Seguro
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-black text-slate-200 uppercase">
                <DollarSign size={12} /> Mercado Pago
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-black text-cyan-200 uppercase">
                <QrCode size={12} /> Pix
              </span>

              <span className="px-2.5 py-1 rounded-lg bg-[#1a1f71] border border-[#2f3ba8] text-[10px] font-black text-white uppercase tracking-wide">
                Visa
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-black text-white uppercase tracking-wide">
                <span className="relative w-5 h-3 inline-block">
                  <span className="absolute left-0 top-0 w-3 h-3 rounded-full bg-[#eb001b] opacity-95"></span>
                  <span className="absolute right-0 top-0 w-3 h-3 rounded-full bg-[#f79e1b] opacity-95"></span>
                </span>
                Mastercard
              </span>

              <span className="px-2.5 py-1 rounded-lg bg-[#0b2a6f] border border-[#1a3d8f] text-[10px] font-black text-white uppercase tracking-wide">
                Elo
              </span>
            </div>
          </div>
        </div>
      </footer>

      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="fixed right-4 bottom-4 md:right-6 md:bottom-6 z-50"
          style={{
            animation: "whatsapp-float-pulse 3.8s ease-in-out infinite",
          }}
          aria-label="Falar no WhatsApp"
        >
          <img
            src="/whatsapp.png"
            alt="WhatsApp"
            className="w-14 h-14 md:w-16 md:h-16 object-contain drop-shadow-[0_14px_24px_rgba(0,0,0,0.35)] hover:scale-105 transition-transform duration-300"
          />
        </a>
      )}

      {/* Modals */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          close={() => setSelectedProduct(null)}
          addToCart={addToCart}
        />
      )}
      {isCartOpen && (
        <CartModal
          cart={cart}
          updateQty={updateQty}
          removeFromCart={removeFromCart}
          cartTotal={cartTotal}
          close={() => setIsCartOpen(false)}
          startCheckout={startCheckout}
        />
      )}
      {isAuthModalOpen && (
        <AuthModal
          close={() => setIsAuthModalOpen(false)}
          showToast={showToast}
        />
      )}
      {isAccountOpen && isRealUser && (
        <CustomerAccountModal
          user={user}
          userProfile={userProfile}
          orders={myOrders}
          close={() => setIsAccountOpen(false)}
          showToast={showToast}
        />
      )}
      {isCheckoutOpen && (
        <CheckoutFlow
          cart={cart}
          cartTotal={cartTotal}
          user={user}
          storeSettings={storeSettings}
          close={() => setIsCheckoutOpen(false)}
          showToast={showToast}
          clearCart={() => setCart([])}
        />
      )}
    </div>
  );
}

function CustomerAccountModal({ user, userProfile, orders, close, showToast }) {
  const [isSaving, setIsSaving] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    setFormData({
      firstName: userProfile?.firstName || "",
      lastName: userProfile?.lastName || "",
      phone: userProfile?.phone || "",
      email: user?.email || userProfile?.email || "",
    });
  }, [userProfile, user]);

  const statusCatalog = {
    pendente_pagamento: {
      label: "Pendente de Pagamento",
      color: "bg-amber-100 text-amber-700",
    },
    pendente: { label: "Pendente", color: "bg-amber-100 text-amber-700" },
    separacao: {
      label: "Em Separação",
      color: "bg-sky-100 text-sky-700",
    },
    enviado: { label: "Enviado", color: "bg-indigo-100 text-indigo-700" },
    entregue: { label: "Entregue", color: "bg-emerald-100 text-emerald-700" },
    concluido: {
      label: "Concluído",
      color: "bg-emerald-100 text-emerald-700",
    },
    estornado: {
      label: "Estornado",
      color: "bg-rose-100 text-rose-700",
    },
    cancelado: { label: "Cancelado", color: "bg-slate-100 text-slate-700" },
  };

  const resolveOrderStatus = (order) => {
    if (order.status) return order.status;
    return order.type === "online" ? "pendente_pagamento" : "concluido";
  };

  const buildCheckoutItemsFromOrder = (order) => {
    const orderItems = Array.isArray(order?.items) ? order.items : [];
    const checkoutItems = orderItems
      .map((item) => ({
        title: String(item?.name || "Item")
          .trim()
          .slice(0, 80),
        quantity: Math.max(1, Number(item?.qty || 1)),
        unit_price: Math.max(0, Number(item?.price || 0)),
      }))
      .filter((item) => item.title && item.unit_price > 0);

    const shippingPrice = Number(order?.shipping?.price || 0);
    if (shippingPrice > 0) {
      checkoutItems.push({
        title: `Frete - ${String(order?.shipping?.name || "Entrega")
          .trim()
          .slice(0, 60)}`,
        quantity: 1,
        unit_price: shippingPrice,
      });
    }

    return checkoutItems;
  };

  const handleRetryPayment = async (order) => {
    if (!order?.id) return;

    const status = resolveOrderStatus(order);
    if (order.type !== "online" || status !== "pendente_pagamento") {
      return showToast(
        "Este pedido não está elegível para novo pagamento.",
        "error",
      );
    }

    const items = buildCheckoutItemsFromOrder(order);
    if (!items.length) {
      return showToast(
        "Não foi possível montar os itens do pagamento deste pedido.",
        "error",
      );
    }

    setProcessingOrderId(order.id);
    try {
      const externalReference = `retry-${order.id}-${Date.now()}`;
      const res = await fetch(buildApiUrl("/api/checkout/preference"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": createIdempotencyKey("retry-checkout"),
        },
        body: JSON.stringify({
          items,
          external_reference: externalReference,
          payer: {
            email: order.customerEmail || user?.email || "cliente@loja.com",
            first_name:
              order.customerName ||
              userProfile?.firstName ||
              user?.email?.split("@")[0] ||
              "Cliente",
          },
        }),
      });

      const data = await res.json();
      const checkoutUrl = data?.checkoutUrl || data?.sandboxCheckoutUrl;
      if (!res.ok || !checkoutUrl) {
        throw new Error(
          data?.error || data?.providerMessage || "Falha ao reabrir pagamento.",
        );
      }

      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "orders", order.id),
        {
          mpPreferenceId: data.preferenceId || null,
          mpExternalReference: externalReference,
          lastPaymentAttemptAt: serverTimestamp(),
          paymentRetryCount: Number(order.paymentRetryCount || 0) + 1,
          updatedAt: serverTimestamp(),
        },
      );

      showToast("Redirecionando para concluir o pagamento...");
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("Erro ao tentar novo pagamento:", error);
      showToast(error?.message || "Erro ao tentar novo pagamento", "error");
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleRequestCancellation = async (order) => {
    if (!order?.id) return;
    const status = resolveOrderStatus(order);

    if (!["pendente_pagamento", "pendente", "separacao"].includes(status)) {
      return showToast(
        "Este pedido não pode solicitar cancelamento nesta etapa.",
        "error",
      );
    }

    setCancelModalOrder(order);
    setCancelReasonDraft("");
    setCancelReasonError("");
  };

  const closeCancelModal = () => {
    if (
      cancelModalOrder?.id &&
      processingOrderId &&
      processingOrderId === cancelModalOrder.id
    ) {
      return;
    }

    setCancelModalOrder(null);
    setCancelReasonDraft("");
    setCancelReasonError("");
  };

  const submitCancellationRequest = async () => {
    if (!cancelModalOrder?.id) return;

    const trimmedReason = String(cancelReasonDraft || "").trim();
    if (trimmedReason.length < 10) {
      setCancelReasonError("Descreva melhor o motivo do cancelamento.");
      return;
    }

    setCancelReasonError("");
    setProcessingOrderId(cancelModalOrder.id);
    try {
      await updateDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "orders",
          cancelModalOrder.id,
        ),
        {
          cancellationRequest: {
            status: "requested",
            reason: trimmedReason,
            requestedAt: serverTimestamp(),
            requestedBy: user.uid,
            customerName:
              cancelModalOrder.customerName ||
              `${formData.firstName || ""} ${formData.lastName || ""}`.trim(),
            customerEmail: cancelModalOrder.customerEmail || user.email || "",
            customerPhone:
              cancelModalOrder.customerPhone ||
              formData.phone ||
              userProfile?.phone ||
              "",
          },
          updatedAt: serverTimestamp(),
        },
      );

      showToast("Solicitação de cancelamento enviada para o admin.");
      closeCancelModal();
    } catch (error) {
      console.error("Erro ao solicitar cancelamento:", error);
      showToast("Erro ao solicitar cancelamento", "error");
    } finally {
      setProcessingOrderId(null);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      return showToast("Nome e sobrenome são obrigatórios.", "error");
    }

    setIsSaving(true);
    try {
      await setDoc(
        doc(db, "artifacts", appId, "users", user.uid, "profile", "info"),
        {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          phone: maskPhone(formData.phone),
          email: formData.email || user.email || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await setDoc(
        doc(db, "artifacts", appId, "public", "data", "customers", user.uid),
        {
          name: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
          phone: maskPhone(formData.phone),
          email: formData.email || user.email || "",
          userId: user.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      showToast("Dados atualizados com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar perfil do cliente:", error);
      showToast("Erro ao atualizar seus dados.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto print:hidden">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden animate-slide-up border border-slate-100">
        <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-xl md:text-2xl font-black text-slate-800">
            Minha Conta
          </h2>
          <button
            onClick={close}
            className="p-2 rounded-full hover:bg-slate-200 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          <div className="p-5 md:p-6 border-b lg:border-b-0 lg:border-r border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4">Meus Dados</h3>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
                    Nome
                  </label>
                  <input
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        firstName: e.target.value,
                      }))
                    }
                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
                    Sobrenome
                  </label>
                  <input
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        lastName: e.target.value,
                      }))
                    }
                    className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
                  Telefone
                </label>
                <input
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      phone: maskPhone(e.target.value),
                    }))
                  }
                  maxLength={15}
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
                  E-mail
                </label>
                <input
                  value={formData.email}
                  disabled
                  className="w-full p-3 border border-slate-200 rounded-xl bg-slate-100 text-slate-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-bold transition"
              >
                {isSaving ? "Salvando..." : "Salvar Dados"}
              </button>
            </form>
          </div>

          <div className="p-5 md:p-6">
            <h3 className="font-bold text-slate-800 mb-4">Meus Pedidos</h3>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {orders.length === 0 && (
                <div className="border border-slate-200 rounded-xl p-4 text-sm text-slate-500 bg-slate-50">
                  Você ainda não possui pedidos registrados.
                </div>
              )}

              {orders.map((order) => {
                const statusCode = resolveOrderStatus(order);
                const statusMeta =
                  statusCatalog[statusCode] || statusCatalog.pendente;
                const isProcessingOrder = processingOrderId === order.id;
                const isCancellationPending =
                  order?.cancellationRequest?.status === "requested";
                const canRetryPayment =
                  order?.type === "online" &&
                  statusCode === "pendente_pagamento";
                const canRequestCancellation =
                  order?.type === "online" &&
                  ["pendente_pagamento", "pendente", "separacao"].includes(
                    statusCode,
                  ) &&
                  !isCancellationPending;

                return (
                  <div
                    key={order.id}
                    className="border border-slate-200 rounded-xl p-4 bg-white"
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-400">Pedido</p>
                        <p className="font-bold text-slate-800">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusMeta.color}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-slate-400">Data</p>
                        <p className="font-semibold text-slate-700">
                          {order.createdAt
                            ? new Date(
                                order.createdAt.toMillis(),
                              ).toLocaleString()
                            : "Recente"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Total</p>
                        <p className="font-semibold text-indigo-600">
                          R$ {Number(order.total || 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Pagamento</p>
                        <p className="font-semibold text-slate-700">
                          {order.paymentMethod || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Rastreio</p>
                        <p className="font-semibold text-slate-700 break-all">
                          {order.trackingCode || "Aguardando postagem"}
                        </p>
                      </div>
                    </div>

                    {(canRetryPayment ||
                      canRequestCancellation ||
                      isCancellationPending) && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                        {isCancellationPending && (
                          <div className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-800 p-2">
                            <strong>Cancelamento solicitado:</strong>{" "}
                            {order?.cancellationRequest?.reason ||
                              "Aguardando análise do admin."}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {canRetryPayment && (
                            <button
                              onClick={() => handleRetryPayment(order)}
                              disabled={isProcessingOrder}
                              className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:bg-slate-300"
                            >
                              {isProcessingOrder
                                ? "Processando..."
                                : "Pagar agora"}
                            </button>
                          )}

                          {canRequestCancellation && (
                            <button
                              onClick={() => handleRequestCancellation(order)}
                              disabled={isProcessingOrder}
                              className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              Solicitar cancelamento
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {cancelModalOrder && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-rose-100 bg-white shadow-2xl overflow-hidden animate-slide-up">
            <div className="px-6 py-5 bg-gradient-to-r from-rose-50 via-white to-orange-50 border-b border-rose-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-xl font-black text-slate-800">
                    Solicitar cancelamento
                  </h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Informe o motivo para enviarmos ao admin e agilizar o
                    contato sobre o pedido #
                    {cancelModalOrder.id.slice(0, 8).toUpperCase()}.
                  </p>
                </div>
                <button
                  onClick={closeCancelModal}
                  disabled={processingOrderId === cancelModalOrder.id}
                  className="p-2 rounded-full hover:bg-slate-100 transition disabled:opacity-50"
                  aria-label="Fechar modal de cancelamento"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                Motivo do cancelamento
              </label>
              <textarea
                rows={4}
                value={cancelReasonDraft}
                onChange={(e) => {
                  setCancelReasonDraft(e.target.value);
                  if (cancelReasonError) setCancelReasonError("");
                }}
                placeholder="Ex: Preciso alterar o endereço e forma de entrega."
                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-rose-300 outline-none resize-none"
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Mínimo de 10 caracteres.</span>
                <span className="text-slate-400">
                  {String(cancelReasonDraft || "").trim().length}/300
                </span>
              </div>

              {cancelReasonError && (
                <div className="text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700 p-2">
                  {cancelReasonError}
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={closeCancelModal}
                disabled={processingOrderId === cancelModalOrder.id}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                onClick={submitCancellationRequest}
                disabled={processingOrderId === cancelModalOrder.id}
                className="px-4 py-2.5 rounded-xl bg-rose-600 text-white font-black hover:bg-rose-700 disabled:bg-slate-300"
              >
                {processingOrderId === cancelModalOrder.id
                  ? "Enviando..."
                  : "Enviar solicitação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 1.0.4b Image Lightbox — mobile full-screen with pinch-to-zoom
function ImageLightbox({ images, currentIndex, onClose }) {
  const [activeIdx, setActiveIdx] = useState(currentIndex);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const pinchRef = useRef({ lastDist: null, startScale: 1 });
  const dragRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    lastTx: 0,
    lastTy: 0,
  });

  const src = normalizeExternalImageUrl(images[activeIdx]);

  const getTouchDist = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const handleTouchStart = useCallback(
    (e) => {
      if (e.touches.length === 2) {
        pinchRef.current.lastDist = getTouchDist(e.touches);
        pinchRef.current.startScale = scale;
      } else if (e.touches.length === 1 && scale > 1) {
        dragRef.current.dragging = true;
        dragRef.current.startX = e.touches[0].clientX - translate.x;
        dragRef.current.startY = e.touches[0].clientY - translate.y;
      }
    },
    [scale, translate],
  );

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinchRef.current.lastDist !== null) {
      const dist = getTouchDist(e.touches);
      const ratio = dist / pinchRef.current.lastDist;
      const newScale = Math.max(
        1,
        Math.min(5, pinchRef.current.startScale * ratio),
      );
      setScale(newScale);
      if (newScale <= 1) setTranslate({ x: 0, y: 0 });
    } else if (e.touches.length === 1 && dragRef.current.dragging) {
      setTranslate({
        x: e.touches[0].clientX - dragRef.current.startX,
        y: e.touches[0].clientY - dragRef.current.startY,
      });
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current.lastDist = null;
    dragRef.current.dragging = false;
  }, []);

  const lastTapRef = useRef(0);
  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (scale > 1) {
        resetZoom();
      } else {
        setScale(2.5);
      }
    }
    lastTapRef.current = now;
  }, [scale, resetZoom]);

  const goNext = useCallback(
    (e) => {
      e.stopPropagation();
      resetZoom();
      setActiveIdx((i) => (i + 1) % images.length);
    },
    [images.length, resetZoom],
  );

  const goPrev = useCallback(
    (e) => {
      e.stopPropagation();
      resetZoom();
      setActiveIdx((i) => (i - 1 + images.length) % images.length);
    },
    [images.length, resetZoom],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && images.length > 1) {
        resetZoom();
        setActiveIdx((i) => (i + 1) % images.length);
      }
      if (e.key === "ArrowLeft" && images.length > 1) {
        resetZoom();
        setActiveIdx((i) => (i - 1 + images.length) % images.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose, resetZoom]);

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/96 flex flex-col print:hidden"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {images.length > 1 && (
          <span className="text-white/60 text-sm font-medium">
            {activeIdx + 1} / {images.length}
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {scale > 1 && (
            <button
              onClick={resetZoom}
              className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-full transition-colors"
            >
              Resetar zoom
            </button>
          )}
          <button
            onClick={onClose}
            className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-full transition-colors"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden touch-none relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          e.stopPropagation();
          handleTap();
        }}
      >
        <img
          src={src}
          alt="Imagem ampliada"
          draggable={false}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
            transition:
              dragRef.current.dragging || pinchRef.current.lastDist
                ? "none"
                : "transform 0.25s ease",
            cursor: scale > 1 ? "grab" : "zoom-in",
            userSelect: "none",
          }}
        />

        {/* Prev / Next arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2.5 rounded-full transition-colors backdrop-blur-sm"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2.5 rounded-full transition-colors backdrop-blur-sm"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      {/* Bottom hint */}
      <div
        className="text-center text-white/40 text-xs pb-4 pt-2 shrink-0 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {scale > 1
          ? "Arraste para navegar · Toque duplo para sair do zoom"
          : "Pinça para ampliar · Toque duplo para zoom 2.5×"}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div
          className="flex gap-2 justify-center pb-5 px-4 shrink-0 overflow-x-auto hide-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => {
                resetZoom();
                setActiveIdx(i);
              }}
              className={`w-12 h-12 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${activeIdx === i ? "border-white" : "border-white/20 opacity-50 hover:opacity-80"}`}
            >
              <img
                src={normalizeExternalImageUrl(img)}
                className="w-full h-full object-cover"
                alt=""
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 1.0.4c Image Zoom Viewer — desktop magnifier + mobile lightbox trigger
function ImageZoomViewer({ images, currentIndex, alt }) {
  const [showLens, setShowLens] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });
  const [bgPos, setBgPos] = useState({ x: 50, y: 50 });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imgRef = useRef(null);

  const LENS = 220;
  const ZOOM = 4.5;
  const src = normalizeExternalImageUrl(images[currentIndex] || "");

  const handleMouseMove = useCallback((e) => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const x = Math.max(LENS / 2, Math.min(rawX, rect.width - LENS / 2));
    const y = Math.max(LENS / 2, Math.min(rawY, rect.height - LENS / 2));
    setLensPos({ x, y });
    setBgPos({
      x: (rawX / rect.width) * 100,
      y: (rawY / rect.height) * 100,
    });
  }, []);

  if (!src) return null;

  return (
    <>
      <div
        className="relative w-full h-full group"
        onMouseEnter={() => setShowLens(true)}
        onMouseLeave={() => setShowLens(false)}
        onMouseMove={handleMouseMove}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          className="w-full h-full object-cover absolute inset-0 select-none"
          style={{ cursor: showLens ? "crosshair" : "zoom-in" }}
        />

        {/* Desktop magnifier lens */}
        {showLens && (
          <div
            className="hidden md:block absolute pointer-events-none rounded-full border-[3px] border-white/90 z-30"
            style={{
              width: LENS,
              height: LENS,
              left: lensPos.x - LENS / 2,
              top: lensPos.y - LENS / 2,
              backgroundImage: `url(${src})`,
              backgroundSize: `${ZOOM * 100}%`,
              backgroundPosition: `${bgPos.x}% ${bgPos.y}%`,
              backgroundRepeat: "no-repeat",
              boxShadow:
                "0 0 0 1px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.35)",
            }}
          />
        )}

        {/* Desktop: click to open lightbox */}
        <button
          className="hidden md:flex absolute bottom-3 right-3 z-20 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors backdrop-blur-sm items-center gap-1.5 text-xs opacity-0 group-hover:opacity-100"
          onClick={() => setLightboxOpen(true)}
          title="Abrir galeria"
        >
          <Maximize2 size={14} />
          <span className="pr-0.5">Ampliar</span>
        </button>

        {/* Mobile: tap hint + trigger */}
        <button
          className="md:hidden absolute inset-0 w-full h-full bg-transparent"
          onClick={() => setLightboxOpen(true)}
          aria-label="Ver imagem ampliada"
        >
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/55 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-1.5 pointer-events-none whitespace-nowrap">
            <ZoomIn size={13} />
            Toque para ampliar
          </span>
        </button>
      </div>

      {lightboxOpen && (
        <ImageLightbox
          images={images}
          currentIndex={currentIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

// 1.0.5 Product Details Modal
function ProductModal({ product, close, addToCart }) {
  const variationGroups = getProductVariationGroups(product);
  const { priceTag, discountPct } = getDiscountMeta(product);
  const descriptionHtml = useMemo(
    () => toSafeDescriptionHtml(product.description),
    [product.description],
  );

  const images =
    product.images?.length > 0
      ? product.images
      : product.image
        ? [product.image]
        : [];

  const [selectedVariations, setSelectedVariations] = useState(() =>
    variationGroups.reduce((acc, group) => {
      acc[group.type] = group.options[0] || "";
      return acc;
    }, {}),
  );
  const [qty, setQty] = useState(1);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const selectedVariationLabel = variationGroups
    .map((group) => {
      const selected = selectedVariations[group.type] || "";
      return selected ? `${group.type}: ${selected}` : "";
    })
    .filter(Boolean)
    .join(" | ");

  const handleAdd = () => {
    const hasMissingSelection = variationGroups.some(
      (group) => !selectedVariations[group.type],
    );

    if (hasMissingSelection) return;

    addToCart(
      {
        ...product,
        selectedVariation: selectedVariationLabel,
        selectedVariationMap: selectedVariations,
        image: images[0] || "",
      },
      qty,
    );
    close();
  };

  const hasStock = Number(product.stock) > 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-2 pb-10 pt-10 sm:items-center sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto print:hidden">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[calc(100dvh-5rem)] sm:max-h-[96vh] overflow-hidden flex flex-col md:flex-row animate-slide-up relative">
        {/* Botão Fechar */}
        <button
          onClick={close}
          className="absolute top-4 right-4 z-20 bg-white/80 backdrop-blur-md p-2 rounded-full hover:bg-white transition-colors shadow-sm"
        >
          <X size={20} className="text-slate-600" />
        </button>

        {/* Imagem do Produto e Galeria */}
        <div className="w-full md:w-1/2 bg-slate-100 relative flex flex-col shrink-0 md:max-h-[96vh]">
          <div className="relative w-full aspect-[4/3] sm:aspect-square md:aspect-auto md:flex-1 bg-slate-50 min-h-[220px] md:min-h-0">
            {images.length > 0 ? (
              <ImageZoomViewer
                images={images}
                currentIndex={currentImgIndex}
                alt={product.name}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300 absolute inset-0">
                <ImageIcon size={64} />
              </div>
            )}
            {discountPct > 0 ? (
              <span className="absolute top-4 left-4 bg-emerald-500 text-white text-[15px] font-black px-4 py-2 rounded-2xl shadow-md z-20 pointer-events-none">
                -{discountPct}%
              </span>
            ) : product.category ? (
              <span className="absolute top-4 left-4 bg-white/90 backdrop-blur-md text-indigo-700 text-xs font-black px-3 py-1.5 rounded-xl border border-white shadow-sm uppercase tracking-wider z-10 pointer-events-none">
                {[product.category, product.subcategory, product.subsubcategory]
                  .filter(Boolean)
                  .join(" / ")}
              </span>
            ) : null}
          </div>

          {/* Miniaturas da Galeria */}
          {images.length > 1 && (
            <div className="flex gap-2 p-3 md:p-4 bg-white border-t border-slate-100 overflow-x-auto hide-scrollbar shrink-0">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImgIndex(idx)}
                  className={`w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${currentImgIndex === idx ? "border-indigo-600 shadow-md" : "border-transparent opacity-70 hover:opacity-100"}`}
                >
                  <img
                    src={normalizeExternalImageUrl(img)}
                    className="w-full h-full object-cover"
                    alt={`Thumb ${idx}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalhes do Produto */}
        <div className="w-full md:w-1/2 flex flex-col min-h-0">
          <div className="flex-grow overflow-y-auto px-4 pb-4 pt-5 sm:px-5 md:px-8 md:pt-8 md:pb-6">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 mb-2 leading-tight pr-12 md:pr-0">
              {product.name}
            </h2>
            {discountPct > 0 && (
              <div className="inline-flex items-center mb-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black uppercase tracking-wider">
                Desconto de {discountPct}%
              </div>
            )}
            {priceTag > 0 && (
              <div className="text-sm text-slate-400 line-through font-semibold mb-1">
                De {formatCurrencyBRL(priceTag)}
              </div>
            )}
            <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-4 md:mb-6">
              {formatCurrencyBRL(product.price)}
            </div>

            {/* Variedades (Tamanhos/Cores) */}
            {variationGroups.length > 0 && (
              <div className="mb-6">
                <span className="block text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">
                  Selecione as variações:
                </span>
                <div className="space-y-4">
                  {variationGroups.map((group) => (
                    <div key={group.type}>
                      <span className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                        {group.type}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {group.options.map((option) => (
                          <button
                            key={`${group.type}-${option}`}
                            onClick={() =>
                              setSelectedVariations((prev) => ({
                                ...prev,
                                [group.type]: option,
                              }))
                            }
                            className={`px-3.5 py-2 rounded-xl font-bold text-sm transition-all duration-200 border-2 ${
                              selectedVariations[group.type] === option
                                ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm"
                                : "border-slate-200 text-slate-600 hover:border-indigo-300"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quantidade */}
            <div className="mb-5 md:mb-8">
              <span className="block text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">
                Quantidade:
              </span>
              <div className="flex items-center gap-4 w-fit bg-slate-50 border border-slate-200 p-1.5 rounded-2xl">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm font-bold text-lg hover:text-indigo-600 transition-colors"
                >
                  -
                </button>
                <span className="w-8 text-center font-bold text-lg">{qty}</span>
                <button
                  onClick={() =>
                    setQty(Math.min(Number(product.stock), qty + 1))
                  }
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm font-bold text-lg hover:text-indigo-600 transition-colors"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-3 font-medium">
                Estoque disponível: {product.stock} unidades
              </p>
            </div>

            <div
              className="prose prose-sm text-slate-600 mb-6 md:mb-8 max-w-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:my-3 [&_a]:text-indigo-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_table]:my-3 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1.5"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          </div>

          <div className="px-4 py-3 md:px-8 md:py-5 border-t border-slate-100 bg-white/95 backdrop-blur-sm shrink-0">
            <div className="flex items-center justify-between gap-4 mb-3 md:hidden">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Total do item
                </p>
                <p className="text-xl font-black text-slate-900">
                  {formatCurrencyBRL(Number(product.price || 0) * qty)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Quantidade
                </p>
                <p className="text-lg font-black text-indigo-600">{qty}x</p>
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={!hasStock}
              className="w-full py-4 rounded-2xl font-bold text-lg text-white shadow-lg transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-500/30 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
            >
              <ShoppingBag size={22} />
              {hasStock ? "Adicionar ao Carrinho" : "Produto Esgotado"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 1.0 Banner Carousel Component
function BannerCarousel({ banners }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);

  const extractBannerUrl = (item) => {
    if (typeof item === "string") {
      return item;
    }

    if (item && typeof item === "object") {
      return (
        item.url ||
        item.src ||
        item.image ||
        item.imageUrl ||
        item.bannerUrl ||
        ""
      );
    }

    return "";
  };

  const normalizedBanners = useMemo(
    () =>
      (Array.isArray(banners) ? banners : [])
        .map((item) => String(extractBannerUrl(item) || "").trim())
        .map((item) => normalizeExternalImageUrl(item))
        .filter(Boolean),
    [banners],
  );
  const activeBanners = normalizedBanners;

  useEffect(() => {
    if (!activeBanners || activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % activeBanners.length);
    }, 5000); // Roda automaticamente a cada 5 segundos

    return () => clearInterval(interval);
  }, [activeBanners]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [activeBanners?.length]);

  useEffect(() => {
    if (currentIndex >= activeBanners.length && activeBanners.length > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, activeBanners]);

  const prevSlide = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? activeBanners.length - 1 : prevIndex - 1,
    );
  };

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % activeBanners.length);
  };

  const minSwipeDistance = 50;
  const onTouchStart = (e) => {
    setTouchEndX(null);
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const distance = touchStartX - touchEndX;

    if (distance > minSwipeDistance) {
      nextSlide();
    } else if (distance < -minSwipeDistance) {
      prevSlide();
    }
  };

  if (!normalizedBanners.length || !activeBanners.length) return null;

  const trackWidth = `${activeBanners.length * 100}%`;
  const slideWidth = `${100 / activeBanners.length}%`;
  const trackTransform = `translate3d(-${currentIndex * (100 / activeBanners.length)}%, 0, 0)`;

  return (
    <div
      className="w-full h-64 sm:h-72 md:h-80 lg:h-96 bg-slate-900 relative group overflow-hidden touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Slides (Container com Transição Animada) */}
      <div
        className="flex w-full h-full transition-transform duration-700 ease-in-out"
        style={{ width: trackWidth, transform: trackTransform }}
      >
        {activeBanners.map((banner, index) => (
          <div
            key={index}
            className="h-full relative shrink-0 overflow-hidden"
            style={{ width: slideWidth }}
          >
            <img
              src={banner}
              alt={`Banner ${index + 1}`}
              loading="eager"
              decoding="async"
              draggable={false}
              className="block w-full h-full object-cover select-none"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent sm:from-black/40"></div>
          </div>
        ))}
      </div>

      {/* Controles do Carrossel */}
      {activeBanners.length > 1 && (
        <>
          {/* Botão Voltar */}
          <button
            onClick={prevSlide}
            className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 md:p-3 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all backdrop-blur-md shadow-lg"
          >
            <ChevronLeft size={24} />
          </button>

          {/* Botão Avançar */}
          <button
            onClick={nextSlide}
            className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 md:p-3 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all backdrop-blur-md shadow-lg"
          >
            <ChevronRight size={24} />
          </button>

          {/* Bolinhas Indicadoras (Dots) */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
            {activeBanners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2.5 rounded-full transition-all duration-300 shadow-sm ${
                  idx === currentIndex
                    ? "w-8 bg-white"
                    : "w-2.5 bg-white/50 hover:bg-white/80"
                }`}
                aria-label={`Ir para banner ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// 1.1 Auth Modal
function AuthModal({ close, showToast }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Novos campos para cadastro
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const loggedInUser = userCredential.user;

        // Auto-migração: garante que clientes antigos aparecem no PDV
        try {
          const customerDocRef = doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "customers",
            loggedInUser.uid,
          );
          const customerSnap = await getDoc(customerDocRef);
          if (!customerSnap.exists()) {
            const profileSnap = await getDoc(
              doc(
                db,
                "artifacts",
                appId,
                "users",
                loggedInUser.uid,
                "profile",
                "info",
              ),
            );
            if (profileSnap.exists()) {
              const pData = profileSnap.data();
              await setDoc(customerDocRef, {
                name: `${pData.firstName} ${pData.lastName}`.trim(),
                phone: pData.phone || "",
                email: pData.email || email,
                document: "",
                userId: loggedInUser.uid,
                createdAt: serverTimestamp(),
              });
            }
          }
        } catch (e) {
          console.error("Falha na auto-migração de cliente", e);
        }

        showToast("Login realizado com sucesso!");
        close();
      } else {
        // Validação de senha
        if (password !== confirmPassword) {
          return showToast("As senhas não coincidem!", "error");
        }
        if (password.length < 6) {
          return showToast(
            "A senha deve ter pelo menos 6 caracteres.",
            "error",
          );
        }

        // Criar usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const newUser = userCredential.user;

        // Salvar dados adicionais no banco de dados (Firestore) - Privado
        await setDoc(
          doc(db, "artifacts", appId, "users", newUser.uid, "profile", "info"),
          {
            firstName,
            lastName,
            phone,
            email,
            createdAt: serverTimestamp(),
          },
        );

        // Sincronizar com a base pública de clientes para o PDV (Usando o UID para evitar duplicatas)
        await setDoc(
          doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "customers",
            newUser.uid,
          ),
          {
            name: `${firstName} ${lastName}`.trim(),
            phone: maskPhone(phone),
            email: email,
            document: "",
            userId: newUser.uid,
            createdAt: serverTimestamp(),
          },
        );

        showToast("Conta criada com sucesso!");
        close();
      }
    } catch (error) {
      // Traduzir alguns erros comuns do Firebase
      let msg = error.message;
      if (error.code === "auth/email-already-in-use")
        msg = "Este e-mail já está em uso.";
      if (error.code === "auth/invalid-credential")
        msg = "E-mail ou senha incorretos.";
      if (error.code === "auth/operation-not-allowed")
        msg =
          "O login por e-mail não está habilitado no Firebase (Ative no painel).";
      showToast(msg, "error");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto print:hidden">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-8 animate-slide-up">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">
            {isLogin ? "Entrar" : "Criar Conta"}
          </h2>
          <button
            onClick={close}
            className="p-1 hover:bg-slate-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isLogin ? (
            // Form de Login
            <>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">
                  E-mail
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">
                  Senha
                </label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="••••••••"
                />
              </div>
            </>
          ) : (
            // Form de Cadastro Completo
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">
                    Nome
                  </label>
                  <input
                    required
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="João"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">
                    Sobrenome
                  </label>
                  <input
                    required
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Silva"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">
                  Telefone
                </label>
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">
                  E-mail
                </label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="seu@email.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">
                    Senha
                  </label>
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Mínimo 6"
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700">
                    Confirmar Senha
                  </label>
                  <input
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Repita a senha"
                    minLength={6}
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 transition text-white font-bold py-3 rounded-xl mt-6 shadow-md"
          >
            {isLogin ? "Entrar" : "Cadastrar"}
          </button>
        </form>

        <div className="p-4 bg-slate-50 text-center text-sm rounded-b-2xl border-t">
          {isLogin ? "Não tem conta? " : "Já tem conta? "}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-indigo-600 font-bold hover:underline"
          >
            {isLogin ? "Crie uma agora" : "Faça login"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 1.2 Cart Modal
function CartModal({
  cart,
  updateQty,
  removeFromCart,
  cartTotal,
  close,
  startCheckout,
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end print:hidden">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={close}
      ></div>
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart size={24} /> Meu Carrinho
          </h2>
          <button
            onClick={close}
            className="p-2 hover:bg-slate-200 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <p className="text-center text-slate-400 py-10">Carrinho vazio.</p>
          ) : (
            cart.map((item) => (
              <div
                key={item.cartItemId || item.id}
                className="flex gap-4 items-center bg-white border rounded-xl p-3 shadow-sm"
              >
                <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                  {item.images?.[0] || item.image ? (
                    <img
                      src={normalizeExternalImageUrl(
                        item.images?.[0] || item.image,
                      )}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-full h-full p-4 text-slate-300" />
                  )}
                </div>
                <div className="flex-grow">
                  <h4 className="font-semibold text-sm line-clamp-1">
                    {item.name}
                  </h4>
                  {item.selectedVariation && (
                    <p className="text-xs text-slate-500 font-medium mb-1">
                      Opção: {item.selectedVariation}
                    </p>
                  )}
                  <p className="text-indigo-600 font-bold text-sm">
                    R$ {Number(item.price).toFixed(2)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => updateQty(item.cartItemId || item.id, -1)}
                      className="px-2 py-0.5 border rounded hover:bg-slate-100"
                    >
                      -
                    </button>
                    <span className="text-sm font-medium w-4 text-center">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.cartItemId || item.id, 1)}
                      className="px-2 py-0.5 border rounded hover:bg-slate-100"
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => removeFromCart(item.cartItemId || item.id)}
                  className="text-rose-500 p-2 hover:bg-rose-50 rounded"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="p-6 border-t bg-slate-50 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
          <div className="flex justify-between items-center mb-4 text-lg font-bold">
            <span>Total:</span>
            <span className="text-indigo-600 text-2xl">
              R$ {cartTotal.toFixed(2)}
            </span>
          </div>
          <button
            onClick={startCheckout}
            disabled={cart.length === 0}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 transition text-white font-bold rounded-xl disabled:bg-slate-300 shadow-md"
          >
            Continuar para o Checkout
          </button>
        </div>
      </div>
    </div>
  );
}

// 1.3 Checkout Flow
function CheckoutFlow({
  cart,
  cartTotal,
  user,
  storeSettings,
  close,
  showToast,
  clearCart,
}) {
  const [step, setStep] = useState(1);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [newAddress, setNewAddress] = useState({
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    recebedorNome: "",
    recebedorTelefone: "",
  });
  const [shippingOption, setShippingOption] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixData, setPixData] = useState(null); // Recebe dados reais do PIX

  // Fetch user addresses
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "artifacts", appId, "users", user.uid, "addresses"),
      (snap) => {
        const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAddresses(data);
        if (data.length > 0 && !selectedAddress) setSelectedAddress(data[0]);
      },
      (err) => console.error("Erro ao buscar endereços:", err),
    );
    return () => unsub();
  }, [user]);

  // Limpa o frete selecionado se o endereço mudar
  useEffect(() => {
    setShippingOption(null);
  }, [selectedAddress]);

  // Calcula as opções de frete baseadas no endereço e nas configurações
  const availableShipping = useMemo(() => {
    if (!selectedAddress) return [];
    const options = [];
    const config = storeSettings?.shipping || {};

    if (config.pickupEnabled !== false) {
      // Default is true if undefined
      options.push({
        id: "pickup",
        name: "Retirada na Loja",
        price: 0,
        time: "Disponível em 1 dia útil",
        icon: <Store size={20} />,
      });
    }

    if (selectedAddress.cidade && selectedAddress.estado) {
      const localCityMatch = config.localCities?.find(
        (c) =>
          c.name.toLowerCase() === selectedAddress.cidade.toLowerCase() &&
          c.state.toLowerCase() === selectedAddress.estado.toLowerCase(),
      );

      if (localCityMatch) {
        options.push({
          id: "local",
          name: "Entrega Expressa (Motoboy/App)",
          price: Number(localCityMatch.rate),
          time: "Entregue no mesmo dia",
          icon: <Truck size={20} />,
        });
      } else {
        // Correios simulado
        const base = Number(config.correiosBaseRate) || 25;
        options.push({
          id: "correios_pac",
          name: "Correios (PAC)",
          price: base,
          time: "5 a 10 dias úteis",
          icon: <Package size={20} />,
        });
        options.push({
          id: "correios_sedex",
          name: "Correios (Sedex)",
          price: base * 1.5,
          time: "2 a 4 dias úteis",
          icon: <Package size={20} />,
        });
      }
    }
    return options;
  }, [selectedAddress, storeSettings]);

  // Busca de CEP na API do ViaCEP
  const handleCepChange = async (e) => {
    const rawCep = e.target.value;
    const maskedCep = maskCEP(rawCep);
    setNewAddress((prev) => ({ ...prev, cep: maskedCep }));

    const cleanCep = maskedCep.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setNewAddress((prev) => ({
            ...prev,
            rua: data.logradouro || prev.rua,
            bairro: data.bairro || prev.bairro,
            cidade: data.localidade || prev.cidade,
            estado: data.uf || prev.estado,
          }));
          showToast("Endereço preenchido via CEP", "success");
        } else {
          showToast("CEP não localizado", "error");
        }
      } catch (err) {
        console.error("Erro ao buscar CEP", err);
      }
    }
  };

  const saveAddress = async (e) => {
    e.preventDefault();
    if (newAddress.cep.replace(/\D/g, "").length !== 8) {
      return showToast("Digite um CEP válido com 8 dígitos", "error");
    }
    if (newAddress.recebedorTelefone.replace(/\D/g, "").length < 10) {
      return showToast("Digite um telefone válido", "error");
    }

    try {
      const docRef = await addDoc(
        collection(db, "artifacts", appId, "users", user.uid, "addresses"),
        newAddress,
      );
      setSelectedAddress({ id: docRef.id, ...newAddress });
      setNewAddress({
        cep: "",
        rua: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
        recebedorNome: "",
        recebedorTelefone: "",
      });
      showToast("Endereço salvo com sucesso!");
    } catch (error) {
      showToast("Erro ao salvar endereço", "error");
    }
  };

  const finalTotal = cartTotal + (shippingOption?.price || 0);

  const finalizeOrder = async () => {
    if (!selectedAddress || !paymentMethod || !shippingOption)
      return showToast("Preencha todos os dados e frete", "error");

    setIsProcessing(true);

    try {
      // 1. Limpamos os dados antes de gravar (Evitar erro de elemento React do Icon)
      const cleanShipping = {
        id: shippingOption.id,
        name: shippingOption.name,
        price: shippingOption.price,
        time: shippingOption.time,
      };

      const cleanCart = cart.map((item) => ({
        id: item.id || null,
        cartItemId: item.cartItemId || null,
        name: item.name || "",
        price: item.price || 0,
        qty: item.qty || 1,
        selectedVariation: item.selectedVariation || null,
        image: item.images?.[0] || item.image || null,
        stock: item.stock || 0,
      }));

      const cleanAddress = {
        cep: selectedAddress.cep || "",
        rua: selectedAddress.rua || "",
        numero: selectedAddress.numero || "",
        complemento: selectedAddress.complemento || "",
        bairro: selectedAddress.bairro || "",
        cidade: selectedAddress.cidade || "",
        estado: selectedAddress.estado || "",
        recebedorNome: selectedAddress.recebedorNome || "",
        recebedorTelefone: selectedAddress.recebedorTelefone || "",
      };

      const customerName =
        cleanAddress.recebedorNome?.trim() ||
        user.displayName?.trim() ||
        user.email?.split("@")[0] ||
        "Cliente Online";
      const customerPhone = cleanAddress.recebedorTelefone?.trim() || "N/A";

      const order = {
        type: "online",
        customerId: user.uid,
        customerEmail: user.email || "N/A",
        customerName,
        customerPhone,
        items: cleanCart,
        subtotal: cartTotal,
        shipping: cleanShipping,
        total: finalTotal,
        address: cleanAddress,
        paymentMethod: paymentMethod,
        status: "pendente_pagamento",
        createdAt: serverTimestamp(),
      };

      const externalReference = `online-${user.uid}-${Date.now()}`;

      // 2. Processa pagamento real no backend seguro
      if (paymentMethod === "PIX") {
        const res = await fetch(buildApiUrl("/api/pix"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-idempotency-key": createIdempotencyKey("online-pix"),
          },
          body: JSON.stringify({
            transaction_amount: finalTotal,
            description: `Compra na loja ${storeSettings?.storeName || "Online"}`,
            external_reference: externalReference,
            payer: {
              email: user.email || "cliente@loja.com",
              first_name: cleanAddress.recebedorNome || "Cliente",
            },
          }),
        });

        const data = await res.json();
        if (!res.ok || !data?.qr_code_base64 || !data?.qr_code) {
          throw new Error(data?.error || "Falha ao gerar PIX no backend");
        }

        setPixData(data);
        order.mpPaymentId = data.id;
        order.mpExternalReference = externalReference;
      } else {
        const res = await fetch(buildApiUrl("/api/checkout/preference"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-idempotency-key": createIdempotencyKey("online-checkout"),
          },
          body: JSON.stringify({
            items: [
              ...cleanCart.map((item) => ({
                title: item.name,
                quantity: Number(item.qty),
                unit_price: Number(item.price),
              })),
              {
                title: `Frete - ${cleanShipping.name}`,
                quantity: 1,
                unit_price: Number(cleanShipping.price || 0),
              },
            ],
            external_reference: externalReference,
            payer: {
              email: user.email || "cliente@loja.com",
              first_name: cleanAddress.recebedorNome || "Cliente",
            },
          }),
        });

        const data = await res.json();
        const checkoutUrl = data?.checkoutUrl || data?.sandboxCheckoutUrl;
        if (!res.ok || !checkoutUrl) {
          throw new Error(data?.error || "Falha ao iniciar checkout online");
        }

        order.mpPreferenceId = data.preferenceId;
        order.mpExternalReference = externalReference;

        // Atualizar estoque
        for (const item of cleanCart) {
          if (item.id) {
            await updateDoc(
              doc(
                db,
                "artifacts",
                appId,
                "public",
                "data",
                "products",
                item.id,
              ),
              {
                stock: Math.max(0, Number(item.stock || 0) - Number(item.qty)),
              },
            );
          }
        }

        await addDoc(
          collection(db, "artifacts", appId, "public", "data", "orders"),
          order,
        );

        clearCart();
        showToast("Redirecionando para o checkout seguro do Mercado Pago...");
        window.location.href = checkoutUrl;
        return;
      }

      // 3. Gravar no banco de dados Firebase
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "orders"),
        order,
      );

      // Atualizar estoque
      for (const item of cleanCart) {
        if (item.id) {
          await updateDoc(
            doc(db, "artifacts", appId, "public", "data", "products", item.id),
            { stock: Math.max(0, Number(item.stock || 0) - Number(item.qty)) },
          );
        }
      }

      // 4. Limpar o carrinho e mostrar sucesso
      clearCart();
      setStep(4);
      showToast("Pedido gerado com sucesso!");
    } catch (error) {
      console.error("ERRO AO SALVAR PEDIDO:", error);
      showToast(error?.message || "Erro ao processar pedido", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm print:hidden">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-up border border-slate-100">
        {/* Cabeçalho do Modal (esconder no passo final de sucesso) */}
        {step < 4 && (
          <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl shrink-0">
            <h2 className="text-xl font-bold text-slate-800">
              Finalizar Compra
            </h2>
            <button
              onClick={close}
              className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Step Indicators */}
          {step < 4 && (
            <div className="flex gap-2 mb-8">
              <div
                className={`flex-1 h-2 rounded-full transition-colors ${step >= 1 ? "bg-indigo-600" : "bg-slate-200"}`}
              ></div>
              <div
                className={`flex-1 h-2 rounded-full transition-colors ${step >= 2 ? "bg-indigo-600" : "bg-slate-200"}`}
              ></div>
              <div
                className={`flex-1 h-2 rounded-full transition-colors ${step >= 3 ? "bg-indigo-600" : "bg-slate-200"}`}
              ></div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <MapPin size={20} /> Endereço de Entrega
              </h3>

              {addresses.length > 0 && (
                <div className="grid gap-3">
                  {addresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex items-start p-4 border rounded-xl cursor-pointer transition ${selectedAddress?.id === addr.id ? "border-indigo-500 bg-indigo-50 shadow-sm" : "hover:bg-slate-50"}`}
                    >
                      <input
                        type="radio"
                        name="address"
                        className="mt-1 mr-3"
                        checked={selectedAddress?.id === addr.id}
                        onChange={() => setSelectedAddress(addr)}
                      />
                      <div className="w-full">
                        <div className="flex justify-between items-start">
                          <p className="font-semibold text-slate-800">
                            {addr.recebedorNome || "Sem nome cadastrado"}
                          </p>
                          <span className="text-xs text-slate-400 bg-slate-200 px-2 py-1 rounded">
                            {addr.cidade}/{addr.estado}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          {addr.rua}, {addr.numero}{" "}
                          {addr.complemento && `- ${addr.complemento}`}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Bairro: {addr.bairro} | CEP: {addr.cep}
                        </p>
                        {addr.recebedorTelefone && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Contato: {addr.recebedorTelefone}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <form
                onSubmit={saveAddress}
                className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4"
              >
                <h4 className="font-semibold text-sm border-b border-slate-200 pb-2">
                  Adicionar Novo Endereço
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      CEP
                    </label>
                    <input
                      required
                      placeholder="00000-000"
                      value={newAddress.cep}
                      onChange={handleCepChange}
                      maxLength={9}
                      className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Cidade
                    </label>
                    <input
                      required
                      placeholder="Sua Cidade"
                      value={newAddress.cidade}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, cidade: e.target.value })
                      }
                      className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Estado (UF)
                    </label>
                    <input
                      required
                      placeholder="Ex: SP"
                      maxLength={2}
                      value={newAddress.estado}
                      onChange={(e) =>
                        setNewAddress({
                          ...newAddress,
                          estado: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Bairro
                    </label>
                    <input
                      required
                      placeholder="Seu Bairro"
                      value={newAddress.bairro}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, bairro: e.target.value })
                      }
                      className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Logradouro (Rua/Avenida)
                    </label>
                    <input
                      required
                      placeholder="Ex: Rua das Flores"
                      value={newAddress.rua}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, rua: e.target.value })
                      }
                      className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Número
                    </label>
                    <input
                      required
                      placeholder="Ex: 123 ou S/N"
                      value={newAddress.numero}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, numero: e.target.value })
                      }
                      className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Complemento (Opcional)
                    </label>
                    <input
                      placeholder="Apto, Bloco, Ponto de ref."
                      value={newAddress.complemento}
                      onChange={(e) =>
                        setNewAddress({
                          ...newAddress,
                          complemento: e.target.value,
                        })
                      }
                      className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                    />
                  </div>

                  <div className="sm:col-span-2 mt-2 border-t border-slate-200 pt-4">
                    <h5 className="font-semibold text-sm text-slate-700 mb-3">
                      Informações do Recebedor
                    </h5>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Nome e Sobrenome
                    </label>
                    <input
                      required
                      placeholder="Quem vai receber?"
                      value={newAddress.recebedorNome}
                      onChange={(e) =>
                        setNewAddress({
                          ...newAddress,
                          recebedorNome: e.target.value,
                        })
                      }
                      className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Telefone (Celular)
                    </label>
                    <input
                      required
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                      value={newAddress.recebedorTelefone}
                      onChange={(e) =>
                        setNewAddress({
                          ...newAddress,
                          recebedorTelefone: maskPhone(e.target.value),
                        })
                      }
                      className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="mt-4 px-6 py-3 w-full sm:w-auto bg-slate-800 hover:bg-slate-700 transition text-white rounded-xl text-sm font-bold shadow-md"
                >
                  Salvar e Usar este Endereço
                </button>
              </form>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Truck size={20} /> Frete e Entrega
              </h3>

              <div className="bg-slate-50 rounded-xl p-5 border space-y-3">
                <div className="text-sm text-slate-600 mb-4 bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                  <strong className="text-indigo-700 block mb-1">
                    Local de Entrega Selecionado:
                  </strong>
                  {selectedAddress?.rua}, {selectedAddress?.numero}{" "}
                  {selectedAddress?.complemento &&
                    `- ${selectedAddress?.complemento}`}{" "}
                  <br />
                  {selectedAddress?.bairro}, {selectedAddress?.cidade}/
                  {selectedAddress?.estado} - CEP: {selectedAddress?.cep}
                </div>

                <h4 className="font-bold text-sm text-slate-700 mb-2">
                  Selecione uma opção de frete:
                </h4>
                <div className="grid gap-3">
                  {availableShipping.map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-center p-4 border rounded-xl cursor-pointer transition ${shippingOption?.id === option.id ? "border-indigo-500 bg-indigo-50 shadow-sm" : "bg-white hover:bg-slate-50"}`}
                    >
                      <input
                        type="radio"
                        name="shipping"
                        className="mr-4 w-4 h-4 text-indigo-600"
                        checked={shippingOption?.id === option.id}
                        onChange={() => setShippingOption(option)}
                      />
                      <div className="text-slate-400 mr-3">{option.icon}</div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800">
                          {option.name}
                        </p>
                        <p className="text-xs text-slate-500">{option.time}</p>
                      </div>
                      <div className="font-black text-indigo-700">
                        {option.price === 0
                          ? "Grátis"
                          : `R$ ${option.price.toFixed(2)}`}
                      </div>
                    </label>
                  ))}
                  {availableShipping.length === 0 && (
                    <p className="text-sm text-rose-500">
                      Nenhuma opção de frete disponível para este endereço.
                    </p>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-bold flex items-center gap-2 mt-6">
                <Package size={20} /> Resumo do Pedido
              </h3>
              <div className="bg-slate-50 rounded-xl p-5 border space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.cartItemId || item.id}
                    className="flex justify-between text-sm items-center border-b pb-2 last:border-0 last:pb-0"
                  >
                    <span className="flex items-center gap-2">
                      <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs font-bold">
                        {item.qty}x
                      </span>
                      <div className="flex flex-col">
                        <span>{item.name}</span>
                        {item.selectedVariation && (
                          <span className="text-xs text-slate-500">
                            Opção: {item.selectedVariation}
                          </span>
                        )}
                      </div>
                    </span>
                    <span className="font-medium">
                      R$ {(item.price * item.qty).toFixed(2)}
                    </span>
                  </div>
                ))}

                <div className="border-t pt-4 mt-2 space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal dos Produtos</span>
                    <span>R$ {cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>
                      Frete (
                      {shippingOption ? shippingOption.name : "A selecionar"})
                    </span>
                    <span>
                      {shippingOption
                        ? shippingOption.price === 0
                          ? "Grátis"
                          : `R$ ${shippingOption.price.toFixed(2)}`
                        : "--"}
                    </span>
                  </div>
                  <div className="flex justify-between font-black text-xl pt-2">
                    <span>Total a Pagar</span>
                    <span className="text-indigo-600">
                      R$ {finalTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <CreditCard size={20} /> Método de Pagamento
              </h3>

              <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-indigo-50 p-4 md:p-5 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-800 uppercase tracking-wider">
                      Pagamento Seguro
                    </p>
                    <p className="text-sm text-slate-600">
                      Checkout com Mercado Pago: PIX e Cartão.
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-full bg-sky-600 text-white text-xs font-black uppercase tracking-wider">
                    Mercado Pago
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    "VISA",
                    "MASTERCARD",
                    "ELO",
                    "AMEX",
                    "HIPERCARD",
                    "PIX",
                  ].map((flag) => (
                    <span
                      key={flag}
                      className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-black text-slate-600"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  {
                    title: "PIX",
                    subtitle: "Aprovação rápida com QR Code e Copia e cola",
                  },
                  {
                    title: "Cartão de Crédito",
                    subtitle: "Parcelamento e processamento no Mercado Pago",
                  },
                ].map((method) => (
                  <div key={method} className="flex flex-col">
                    <label
                      className={`flex items-center p-4 border rounded-xl cursor-pointer transition ${paymentMethod === method.title ? "border-indigo-500 bg-indigo-50 shadow-sm ring-2 ring-indigo-200" : "hover:bg-slate-50"}`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        className="mr-3 w-4 h-4 text-indigo-600"
                        checked={paymentMethod === method.title}
                        onChange={() => setPaymentMethod(method.title)}
                      />
                      {method.title === "PIX" && (
                        <QrCode size={18} className="mr-2 text-teal-600" />
                      )}
                      {method.title === "Cartão de Crédito" && (
                        <CreditCard
                          size={18}
                          className="mr-2 text-indigo-600"
                        />
                      )}
                      <span className="flex flex-col">
                        <span className="font-semibold text-slate-700">
                          {method.title}
                        </span>
                        <span className="text-xs text-slate-500">
                          {method.subtitle}
                        </span>
                      </span>
                    </label>

                    {/* Formulário Visual para Cartão de Crédito */}
                    {paymentMethod === method.title &&
                      method.title === "Cartão de Crédito" && (
                        <div className="mt-3 space-y-3 p-4 bg-white rounded-xl border border-indigo-100 shadow-sm animate-slide-up">
                          <div className="text-xs font-bold text-indigo-600 mb-2 uppercase tracking-wider flex items-center gap-1">
                            <Monitor size={14} /> Checkout Seguro
                          </div>
                          <div className="text-sm text-slate-600 border border-indigo-100 rounded-lg p-3 bg-indigo-50/50">
                            Ao confirmar o pedido, você será redirecionado para
                            a página oficial do Mercado Pago para concluir o
                            pagamento com segurança.
                          </div>
                        </div>
                      )}
                  </div>
                ))}
              </div>

              {paymentMethod === "PIX" && (
                <div className="bg-teal-50 text-teal-800 p-4 rounded-xl border border-teal-200 text-sm flex items-center gap-3 mt-4 animate-slide-up">
                  <QrCode size={24} className="shrink-0" />
                  <p>
                    O QR Code e o código "Copia e Cola" serão gerados na próxima
                    tela. Você terá 15 minutos para pagar.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PASSO 4: Resultado do Pagamento (Sucesso) */}
          {step === 4 && (
            <div className="space-y-6 text-center py-8 animate-slide-up">
              <CheckCircle2
                size={64}
                className="mx-auto text-emerald-500 mb-4"
              />
              <h3 className="text-2xl font-bold text-slate-800">
                Pedido registrado!
              </h3>
              <p className="text-slate-600">
                Aguardando confirmação de pagamento.
              </p>

              {paymentMethod === "PIX" && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 mt-6 text-left w-full shadow-sm mx-auto max-w-sm">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center justify-center gap-2">
                    <QrCode className="text-teal-600" /> Pague com PIX
                  </h4>
                  <div className="flex flex-col items-center gap-6">
                    <div className="p-2 border-2 border-dashed border-teal-200 rounded-2xl bg-teal-50 relative">
                      <img
                        src={
                          pixData?.qr_code_base64?.startsWith("http")
                            ? pixData.qr_code_base64
                            : `data:image/jpeg;base64,${pixData?.qr_code_base64}`
                        }
                        className="w-48 h-48 rounded-xl bg-white object-contain"
                        alt="QR Code PIX"
                      />
                    </div>
                    <div className="w-full">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                        Código Copia e Cola
                      </label>
                      <div className="flex">
                        <input
                          readOnly
                          value={pixData?.qr_code || ""}
                          className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-l-lg text-xs font-mono outline-none text-slate-500 truncate"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(pixData?.qr_code);
                            showToast("Código PIX copiado com sucesso!");
                          }}
                          className="bg-teal-600 text-white px-4 font-bold rounded-r-lg hover:bg-teal-700 transition"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(paymentMethod === "Cartão de Crédito" ||
                paymentMethod === "credit_card" ||
                paymentMethod.toLowerCase().includes("cartão")) && (
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 mt-6 text-left w-full mx-auto max-w-sm shadow-sm">
                  <h4 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
                    <CreditCard /> Pagamento no Checkout Seguro
                  </h4>
                  <p className="text-sm text-emerald-700">
                    Seu cartão seria processado aqui e o pagamento confirmado
                    através do backend.
                  </p>
                </div>
              )}

              <button
                onClick={close}
                className="w-full max-w-sm mx-auto mt-8 py-4 bg-slate-800 text-white font-bold rounded-xl shadow-md hover:bg-slate-900 transition block"
              >
                Concluir e Voltar para a Loja
              </button>
            </div>
          )}
        </div>

        {/* Rodapé do Modal (esconder no passo final de sucesso) */}
        {step < 4 && (
          <div className="p-4 md:p-6 border-t bg-slate-50 flex justify-between rounded-b-2xl shrink-0">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                disabled={isProcessing}
                className="px-6 py-3 font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                Voltar
              </button>
            ) : (
              <div></div>
            )}

            <button
              onClick={() => {
                if (step === 1 && !selectedAddress)
                  return showToast("Selecione um endereço salvo", "error");
                if (step === 2 && !shippingOption)
                  return showToast("Selecione uma opção de frete", "error");
                if (step < 3) setStep(step + 1);
                else finalizeOrder();
              }}
              disabled={isProcessing}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2"
            >
              {isProcessing
                ? "Processando..."
                : step < 3
                  ? "Avançar"
                  : "Finalizar Pedido"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. ÁREA DE GESTÃO (ADMIN DASHBOARD)
// ==========================================
function AdminDashboard({
  products,
  orders,
  abandonedCarts,
  showToast,
  storeSettings,
  onAdminLogout,
}) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [ordersQuickFilter, setOrdersQuickFilter] = useState("all");

  const tabs = [
    { id: "dashboard", name: "Painel", icon: <LayoutDashboard size={20} /> },
    { id: "products", name: "Produtos", icon: <Package size={20} /> },
    { id: "pos", name: "PDV (Caixa)", icon: <Monitor size={20} /> },
    { id: "orders", name: "Vendas", icon: <Clock size={20} /> },
    { id: "carts", name: "Carrinhos Ativos", icon: <ShoppingCart size={20} /> },
    { id: "settings", name: "Configurações", icon: <Settings size={20} /> },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-36px)] print:bg-white print:h-auto">
      {/* Mobile Nav Header */}
      <div className="md:hidden bg-slate-800 text-white p-4 flex justify-between items-center sticky top-0 z-20 shadow-md print:hidden">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Store size={20} /> Gestão Loja
        </h2>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2"
        >
          <LayoutDashboard size={24} />
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`${isMobileMenuOpen ? "block" : "hidden"} md:block w-full md:w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex-shrink-0 flex flex-col z-10 sticky top-0 md:top-[36px] md:h-[calc(100vh-36px)] overflow-y-auto print:hidden shadow-2xl relative`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>
        <div className="p-6 hidden md:block border-b border-slate-800 relative z-10">
          <h2 className="font-black tracking-wide text-xl text-white flex items-center gap-3">
            <Store size={26} className="text-fuchsia-500 drop-shadow-md" />{" "}
            Gestão Pro
          </h2>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 relative z-10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === "orders") {
                  setOrdersQuickFilter("all");
                }
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${activeTab === tab.id ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 font-bold scale-[1.02]" : "hover:bg-slate-800 hover:text-white font-medium hover:scale-[1.02]"}`}
            >
              {tab.icon}
              <span className="font-medium flex-1 text-left">{tab.name}</span>
              {tab.id === "carts" && abandonedCarts.length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {abandonedCarts.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 relative z-10">
          <button
            onClick={onAdminLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white font-bold transition-all"
          >
            <LogOut size={18} /> Sair do Admin
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-slate-50 p-4 md:p-8 overflow-y-auto h-full print:p-0 print:bg-white print:overflow-visible relative">
        <div className={activeTab !== "dashboard" ? "print:hidden" : ""}>
          {activeTab === "dashboard" && (
            <AdminOverview
              products={products}
              orders={orders}
              abandonedCarts={abandonedCarts}
              onOpenLosses={() => {
                setActiveTab("orders");
                setOrdersQuickFilter("losses");
              }}
            />
          )}
        </div>
        <div className={activeTab !== "products" ? "print:hidden" : ""}>
          {activeTab === "products" && (
            <ProductManager
              products={products}
              showToast={showToast}
              storeSettings={storeSettings}
            />
          )}
        </div>
        <div className={activeTab !== "pos" ? "print:hidden" : ""}>
          {activeTab === "pos" && (
            <PointOfSale
              products={products}
              showToast={showToast}
              storeSettings={storeSettings}
            />
          )}
        </div>
        <div className={activeTab !== "orders" ? "print:hidden" : ""}>
          {activeTab === "orders" && (
            <OrdersList
              orders={orders}
              showToast={showToast}
              quickFilter={ordersQuickFilter}
            />
          )}
        </div>
        <div className={activeTab !== "carts" ? "print:hidden" : ""}>
          {activeTab === "carts" && (
            <AbandonedCartsList carts={abandonedCarts} showToast={showToast} />
          )}
        </div>
        <div className={activeTab !== "settings" ? "print:hidden" : ""}>
          {activeTab === "settings" && (
            <AdminSettings
              showToast={showToast}
              storeSettings={storeSettings}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function AdminOverview({ products, orders, abandonedCarts, onOpenLosses }) {
  const resolveOrderStatus = (order) => {
    if (order?.status) return order.status;
    return order?.type === "online" ? "pendente_pagamento" : "concluido";
  };

  const totalRevenue = orders
    .filter((order) => {
      const status = resolveOrderStatus(order);
      return status !== "estornado" && status !== "cancelado";
    })
    .reduce((sum, order) => sum + (Number(order.total) || 0), 0);

  const totalLosses = orders
    .filter((order) => {
      const status = resolveOrderStatus(order);
      return status === "estornado" || status === "cancelado";
    })
    .reduce((sum, order) => sum + (Number(order.total) || 0), 0);

  const totalOnline = orders.filter((o) => o.type === "online").length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-slate-800 tracking-tight">
        Visão Geral
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          title="Faturamento Total"
          value={`R$ ${totalRevenue.toFixed(2)}`}
          icon={<DollarSign size={24} />}
          color="bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30"
        />
        <StatCard
          title="Perdas (Estorno/Cancel.)"
          value={`R$ ${totalLosses.toFixed(2)}`}
          helperText="Clique para abrir vendas com perda"
          onClick={onOpenLosses}
          clickable
          icon={<AlertTriangle size={24} />}
          color="bg-gradient-to-br from-rose-500 to-orange-500 shadow-rose-500/30"
        />
        <StatCard
          title="Vendas Online"
          value={totalOnline}
          icon={<Smartphone size={24} />}
          color="bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/30"
        />
        <StatCard
          title="Carrinhos Ativos"
          value={abandonedCarts?.length || 0}
          icon={<ShoppingCart size={24} />}
          color="bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/30"
        />
        <StatCard
          title="Produtos"
          value={products.length}
          icon={<Package size={24} />}
          color="bg-gradient-to-br from-blue-400 to-indigo-500 shadow-blue-500/30"
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  helperText = "",
  onClick,
  clickable = false,
}) {
  const interactiveClass = clickable
    ? "cursor-pointer hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-indigo-300"
    : "";

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      className={`w-full text-left bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200/60 flex items-center gap-5 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-300 ${interactiveClass}`}
    >
      <div
        className={`w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-2xl flex items-center justify-center text-white shadow-lg ${color}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-slate-400 text-xs md:text-sm font-bold uppercase tracking-wider mb-1">
          {title}
        </p>
        <p className="text-2xl md:text-3xl font-black text-slate-800 bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 line-clamp-1">
          {value}
        </p>
        {helperText && (
          <p className="text-[11px] text-slate-400 font-semibold mt-1">
            {helperText}
          </p>
        )}
      </div>
    </button>
  );
}

function ProductManager({ products, showToast, storeSettings }) {
  const descriptionEditorRef = useRef(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkProductsPreview, setBulkProductsPreview] = useState([]);
  const [bulkErrors, setBulkErrors] = useState([]);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null); // Estado para o modal de confirmação
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    priceTag: "",
    category: "",
    subcategories: [],
    subcategory: "",
    subsubcategory: "",
    showcaseSections: [],
    description: "",
    stock: "",
    images: [],
    variations: "",
    variationsByType: {},
  });

  const productCatalog = useMemo(
    () => normalizeCatalog(storeSettings?.catalog),
    [storeSettings?.catalog],
  );

  const availableCategoriesFilter = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((product) => String(product?.category || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const query = String(productSearch || "")
      .trim()
      .toLowerCase();

    return products.filter((product) => {
      const category = String(product?.category || "").trim();
      const name = String(product?.name || "").toLowerCase();
      const subcategory = String(product?.subcategory || "").toLowerCase();
      const subsubcategory = String(
        product?.subsubcategory || "",
      ).toLowerCase();
      const stock = Number(product?.stock || 0);

      const matchesQuery =
        !query ||
        name.includes(query) ||
        category.toLowerCase().includes(query) ||
        subcategory.includes(query) ||
        subsubcategory.includes(query);

      const matchesCategory =
        categoryFilter === "all" || category === categoryFilter;

      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "available" && stock > 0) ||
        (stockFilter === "low" && stock > 0 && stock <= 5) ||
        (stockFilter === "out" && stock <= 0);

      return matchesQuery && matchesCategory && matchesStock;
    });
  }, [products, productSearch, categoryFilter, stockFilter]);

  const availableSubcategories = useMemo(() => {
    const selected = productCatalog.categories.find(
      (cat) => cat.name === formData.category,
    );
    return selected?.subcategories || [];
  }, [formData.category, productCatalog.categories]);

  const availableSubsubcategories = useMemo(() => {
    const selected = productCatalog.categories.find(
      (cat) => cat.name === formData.category,
    );
    return selected?.subsubcategories || [];
  }, [formData.category, productCatalog.categories]);

  const selectedSubcategories = Array.isArray(formData.subcategories)
    ? formData.subcategories
    : getProductSubcategories(formData);

  const syncEditorDescription = useCallback((html) => {
    if (descriptionEditorRef.current) {
      descriptionEditorRef.current.innerHTML = html;
    }
    setFormData((prev) => ({ ...prev, description: html }));
  }, []);

  const handleInsertSizeTableTemplate = () => {
    const templateHtml =
      "<table><thead><tr><th>Tamanho</th><th>Largura (Peito)</th><th>Comprimento (Altura)</th></tr></thead><tbody><tr><td>S (P)</td><td>50 cm</td><td>70 cm</td></tr><tr><td>M (M)</td><td>52 cm</td><td>72 cm</td></tr><tr><td>L (G)</td><td>54 cm</td><td>74 cm</td></tr><tr><td>XL (GG)</td><td>56 cm</td><td>76 cm</td></tr><tr><td>2XL (XG)</td><td>58 cm</td><td>78 cm</td></tr></tbody></table>";

    const currentHtml = String(descriptionEditorRef.current?.innerHTML || "");
    const nextHtml = currentHtml
      ? `${currentHtml}<br />${templateHtml}`
      : templateHtml;
    syncEditorDescription(nextHtml);
    showToast("Tabela de medidas inserida na descrição.");
  };

  useEffect(() => {
    if (!isAdding || !descriptionEditorRef.current) return;
    const html = String(formData.description || "");
    if (descriptionEditorRef.current.innerHTML !== html) {
      descriptionEditorRef.current.innerHTML = html;
    }
  }, [editingId, isAdding]);

  const toggleSubcategory = (subcategory) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.subcategories)
        ? prev.subcategories
        : getProductSubcategories(prev);

      const next = current.includes(subcategory)
        ? current.filter((item) => item !== subcategory)
        : [...current, subcategory];

      return {
        ...prev,
        subcategories: next,
        subcategory: next[0] || "",
      };
    });
  };

  const availableShowcaseSections = productCatalog.sections || [];

  const getInitialVariationMap = (product = {}) => {
    const groups = getProductVariationGroups(product);
    if (groups.length === 0) return {};

    return groups.reduce((acc, group) => {
      acc[group.type] = group.options.join(", ");
      return acc;
    }, {});
  };

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newImages = [];
    for (let file of files) {
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 600;
            let width = img.width,
              height = img.height;
            if (width > MAX_WIDTH) {
              height = height * (MAX_WIDTH / width);
              width = MAX_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            canvas.getContext("2d").drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
      newImages.push(base64);
    }

    setFormData((prev) => ({
      ...prev,
      images: [...(prev.images || []), ...newImages],
    }));
  };

  const removeImage = (index) => {
    setFormData((prev) => {
      const newImages = [...(prev.images || [])];
      newImages.splice(index, 1);
      return { ...prev, images: newImages };
    });
  };

  const moveImage = (index, direction) => {
    setFormData((prev) => {
      const imgs = [...(prev.images || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= imgs.length) return prev;

      [imgs[index], imgs[targetIndex]] = [imgs[targetIndex], imgs[index]];
      return { ...prev, images: imgs };
    });
  };

  const setPrimaryImage = (index) => {
    setFormData((prev) => {
      const imgs = [...(prev.images || [])];
      if (index < 0 || index >= imgs.length) return prev;
      const [selected] = imgs.splice(index, 1);
      imgs.unshift(selected);
      return { ...prev, images: imgs };
    });
  };

  const handleVariationTypeChange = (typeName, value) => {
    setFormData((prev) => ({
      ...prev,
      variationsByType: {
        ...(prev.variationsByType || {}),
        [typeName]: value,
      },
    }));
  };

  const handleToggleShowcaseSection = (sectionId) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.showcaseSections)
        ? prev.showcaseSections
        : [];

      return {
        ...prev,
        showcaseSections: current.includes(sectionId)
          ? current.filter((item) => item !== sectionId)
          : [...current, sectionId],
      };
    });
  };

  const parseCsvLine = (line, delimiter) => {
    const values = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"') {
        if (insideQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  };

  const decodeCsvText = async (file) => {
    try {
      if (typeof TextDecoder === "undefined" || !file.arrayBuffer) {
        return await file.text();
      }

      const buffer = await file.arrayBuffer();
      const encodings = ["utf-8", "windows-1252", "iso-8859-1", "latin1"];
      const candidates = encodings
        .map((encoding) => {
          try {
            const text = new TextDecoder(encoding, { fatal: false }).decode(
              buffer,
            );
            const badChars = (text.match(/�/g) || []).length;
            return { text, badChars };
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      if (candidates.length === 0) {
        return await file.text();
      }

      candidates.sort((a, b) => a.badChars - b.badChars);
      return candidates[0].text;
    } catch {
      return await file.text();
    }
  };

  const parseCsvText = (text) => {
    const lines = String(text || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return [];
    }

    const normalizeHeader = (header) => {
      const text = String(header || "").replace(/^\uFEFF/, "");
      let normalizedText = text;
      try {
        normalizedText = text.normalize("NFD");
      } catch {
        normalizedText = text;
      }

      return normalizedText
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/_/g, "")
        .replace(/\./g, "");
    };

    const headerAliasMap = {
      name: "name",
      nome: "name",
      produto: "name",
      price: "price",
      preco: "price",
      valor: "price",
      pricetag: "priceTag",
      precotarja: "priceTag",
      precoantigo: "priceTag",
      de: "priceTag",
      category: "category",
      categoria: "category",
      subcategory: "subcategory",
      subcategoria: "subcategory",
      subsubcategory: "subsubcategory",
      subsubcategoria: "subsubcategory",
      segmento: "subsubcategory",
      description: "description",
      descricao: "description",
      desc: "description",
      stock: "stock",
      estoque: "stock",
      images: "images",
      imagens: "images",
      image: "image",
      imagem: "image",
      image1: "image1",
      imagem1: "image1",
      image2: "image2",
      imagem2: "image2",
      image3: "image3",
      imagem3: "image3",
      image4: "image4",
      imagem4: "image4",
      image5: "image5",
      imagem5: "image5",
      showcasesections: "showcaseSections",
      showcase: "showcaseSections",
      sections: "showcaseSections",
      secoes: "showcaseSections",
      secao: "showcaseSections",
      sessaoshowcase: "showcaseSections",
      sessao: "showcaseSections",
      sessoes: "showcaseSections",
      sessoesdestaque: "showcaseSections",
      secaodestaque: "showcaseSections",
      vtrine: "showcaseSections",
      vitrine: "showcaseSections",
      variationsbytype: "variationsByType",
      variacoesportipo: "variationsByType",
      variacaopartipo: "variationsByType",
      variationsbytypejson: "variationsByTypeJson",
      variacoesportipojson: "variationsByTypeJson",
    };

    const delimiter = lines[0].includes(";") ? ";" : ",";
    const headers = parseCsvLine(lines[0], delimiter).map((h) => {
      const normalized = normalizeHeader(h);
      return headerAliasMap[normalized] || String(h || "").trim();
    });

    return lines.slice(1).map((line) => {
      const cols = parseCsvLine(line, delimiter);
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = cols[index] || "";
      });
      return obj;
    });
  };

  const parseVariationMapInput = (rawValue, allowedTypes) => {
    if (!rawValue) return {};

    const text = String(rawValue).trim();
    if (!text) return {};

    try {
      const parsedJson = JSON.parse(text);
      if (parsedJson && typeof parsedJson === "object") {
        return Object.fromEntries(
          Object.entries(parsedJson)
            .map(([type, values]) => [
              String(type || "").trim(),
              Array.isArray(values)
                ? values.map((v) => String(v || "").trim()).filter(Boolean)
                : [],
            ])
            .filter(
              ([type, values]) =>
                type && values.length > 0 && allowedTypes.has(type),
            ),
        );
      }
    } catch {
      // fallback para formato texto: Tamanho:PP|P|M;Cor:Preto|Branco
    }

    return Object.fromEntries(
      text
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const [type, optionsRaw = ""] = part.split(":");
          return [
            String(type || "").trim(),
            String(optionsRaw || "")
              .split("|")
              .map((opt) => opt.trim())
              .filter(Boolean),
          ];
        })
        .filter(
          ([type, options]) =>
            type && options.length > 0 && allowedTypes.has(type),
        ),
    );
  };

  const normalizeBulkRowsToProducts = (rows) => {
    const allowedTypes = new Set(
      (productCatalog.variationTypes || [])
        .map((item) => String(item?.name || "").trim())
        .filter(Boolean),
    );
    const availableSections = productCatalog.sections || [];
    const sectionIdByNormalizedName = new Map(
      availableSections.map((section) => [
        String(section.name || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim(),
        section.id,
      ]),
    );

    const productsResult = [];
    const errorsResult = [];

    const normalizeGoogleDriveImageUrl = (url) => {
      const raw = String(url || "").trim();
      if (!raw.includes("drive.google.com")) return raw;

      if (raw.includes("/drive/folders/")) {
        return raw;
      }

      const byPathMatch = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (byPathMatch?.[1]) {
        return `https://drive.google.com/thumbnail?id=${byPathMatch[1]}&sz=w1600`;
      }

      const byQueryMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (byQueryMatch?.[1]) {
        return `https://drive.google.com/thumbnail?id=${byQueryMatch[1]}&sz=w1600`;
      }

      const byUcMatch = raw.match(/\/uc\?(?:.*&)?id=([a-zA-Z0-9_-]+)/);
      if (byUcMatch?.[1]) {
        return `https://drive.google.com/thumbnail?id=${byUcMatch[1]}&sz=w1600`;
      }

      const byThumbnailMatch = raw.match(
        /\/thumbnail\?(?:.*&)?id=([a-zA-Z0-9_-]+)/,
      );
      if (byThumbnailMatch?.[1]) {
        return `https://drive.google.com/thumbnail?id=${byThumbnailMatch[1]}&sz=w1600`;
      }

      return raw;
    };

    const parseImageList = (value) => {
      return String(value || "")
        .replace(/[\n\r]+/g, "|")
        .split(/[|;,]/)
        .map((url) =>
          String(url || "")
            .trim()
            .replace(/^"|"$/g, ""),
        )
        .filter(Boolean)
        .map((url) => url.replace(/\\/g, "/"))
        .map((url) => normalizeGoogleDriveImageUrl(url));
    };

    const parseShowcaseSectionIds = (value) => {
      if (Array.isArray(value)) {
        return [
          ...new Set(
            value.map((item) => String(item || "").trim()).filter(Boolean),
          ),
        ];
      }

      const rawItems = String(value || "")
        .replace(/[\n\r]+/g, "|")
        .split(/[|;,]/)
        .map((item) => String(item || "").trim())
        .filter(Boolean);

      return [
        ...new Set(
          rawItems
            .map((item) => {
              const normalizedName = item
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .trim();

              return sectionIdByNormalizedName.get(normalizedName) || item;
            })
            .filter((item) =>
              availableSections.some(
                (section) => section.id === item || section.name === item,
              ),
            ),
        ),
      ];
    };

    const parseLocaleNumber = (value) => {
      if (typeof value === "number") return value;

      const raw = String(value || "")
        .trim()
        .replace(/R\$/gi, "")
        .replace(/\s/g, "");

      if (!raw) return NaN;

      let normalized = raw;
      const hasComma = normalized.includes(",");
      const hasDot = normalized.includes(".");

      if (hasComma && hasDot) {
        if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
          normalized = normalized.replace(/\./g, "").replace(",", ".");
        } else {
          normalized = normalized.replace(/,/g, "");
        }
      } else if (hasComma) {
        normalized = normalized.replace(",", ".");
      }

      return Number(normalized);
    };

    const parseBulkSubcategories = (value) =>
      String(value || "")
        .split(/[|,]/)
        .map((item) => String(item || "").trim())
        .filter(Boolean);

    rows.forEach((row, index) => {
      const lineNo = index + 2;
      const name = String(row.name || "").trim();
      const price = parseLocaleNumber(row.price);
      const stock = parseLocaleNumber(row.stock);
      const priceTagRaw = parseLocaleNumber(row.priceTag);
      const priceTag =
        Number.isFinite(priceTagRaw) && priceTagRaw > 0 ? priceTagRaw : null;

      if (!name) {
        errorsResult.push(`Linha ${lineNo}: nome é obrigatório.`);
        return;
      }

      if (!Number.isFinite(price) || price <= 0) {
        errorsResult.push(`Linha ${lineNo}: preço inválido.`);
        return;
      }

      if (!Number.isFinite(stock) || stock < 0) {
        errorsResult.push(`Linha ${lineNo}: estoque inválido.`);
        return;
      }

      const imagesFromList = parseImageList(row.images);

      const imagesFromCols = [
        row.image,
        row.image1,
        row.image2,
        row.image3,
        row.image4,
        row.image5,
      ].flatMap((url) => parseImageList(url));

      const images = [...new Set([...imagesFromList, ...imagesFromCols])];

      const hasDriveFolderLink = images.some((imgUrl) =>
        String(imgUrl).includes("drive.google.com/drive/folders/"),
      );

      if (hasDriveFolderLink) {
        errorsResult.push(
          `Linha ${lineNo}: link de pasta do Google Drive não é imagem direta. Use link de arquivo (file/d/ID).`,
        );
      }

      const variationsByType = parseVariationMapInput(
        row.variationsByType || row.variationsByTypeJson || "",
        allowedTypes,
      );
      const rawShowcaseSections = String(row.showcaseSections || "").trim();
      const showcaseSections = parseShowcaseSectionIds(rawShowcaseSections);
      const subcategories = parseBulkSubcategories(row.subcategory);
      const subsubcategory = String(row.subsubcategory || "").trim();

      const flattenedVariations = Object.values(variationsByType)
        .flat()
        .join(", ");

      productsResult.push({
        _sourceLineNo: lineNo,
        name,
        price,
        priceTag,
        category: String(row.category || "").trim(),
        subcategories,
        subcategory: subcategories[0] || "",
        subsubcategory,
        description: String(row.description || "").trim(),
        stock: Math.floor(stock),
        images,
        image: images[0] || "",
        showcaseSections,
        variationsByType,
        variations: flattenedVariations,
      });
    });

    return { productsResult, errorsResult };
  };

  const handleBulkFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const isJson = file.name.toLowerCase().endsWith(".json");
      const text = isJson ? await file.text() : await decodeCsvText(file);
      setBulkFileName(file.name);

      let rows = [];
      if (isJson) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [];
      } else {
        rows = parseCsvText(String(text || "").replace(/\u0000/g, ""));
      }

      const { productsResult, errorsResult } =
        normalizeBulkRowsToProducts(rows);
      setBulkProductsPreview(productsResult);
      setBulkErrors(errorsResult);

      if (productsResult.length === 0) {
        showToast("Nenhum produto válido encontrado no arquivo.", "error");
      }
    } catch (error) {
      setBulkProductsPreview([]);
      const reason = error?.message || "Não foi possível ler o arquivo.";
      setBulkErrors([`Falha ao ler arquivo: ${reason}`]);
      showToast(
        `Falha ao processar arquivo de cadastro massivo: ${reason}`,
        "error",
      );
    } finally {
      e.target.value = "";
    }
  };

  const executeBulkImport = async () => {
    if (bulkProductsPreview.length === 0 || isBulkImporting) return;

    setIsBulkImporting(true);
    let importedCount = 0;
    const importErrors = [];

    try {
      for (const productData of bulkProductsPreview) {
        try {
          const { _sourceLineNo, ...cleanData } = productData;
          const candidateBytes = estimateUtf8Bytes(JSON.stringify(cleanData));

          let finalData = cleanData;
          if (candidateBytes > 900000) {
            const optimized = await optimizeProductImagesForPayload(
              cleanData,
              900000,
            );
            finalData = optimized.data;
          }

          const finalBytes = estimateUtf8Bytes(JSON.stringify(finalData));
          if (finalBytes > 900000) {
            importErrors.push(
              `Linha ${_sourceLineNo || "?"}: produto excede limite de tamanho (${Math.round(finalBytes / 1024)}KB).`,
            );
            continue;
          }

          await addDoc(
            collection(db, "artifacts", appId, "public", "data", "products"),
            { ...finalData, createdAt: serverTimestamp() },
          );
          importedCount += 1;
        } catch (error) {
          const lineNo = productData?._sourceLineNo || "?";
          const reason = error?.message || error?.code || "erro desconhecido";
          importErrors.push(`Linha ${lineNo}: ${reason}`);
        }
      }

      if (importedCount > 0) {
        showToast(`${importedCount} produto(s) importado(s) com sucesso!`);
      }

      if (importErrors.length > 0) {
        setBulkErrors(importErrors.slice(0, 40));
        showToast(
          `Importacao parcial: ${importedCount} ok, ${importErrors.length} com erro.`,
          "error",
        );
        return;
      }

      setIsBulkModalOpen(false);
      setBulkProductsPreview([]);
      setBulkErrors([]);
      setBulkFileName("");
    } catch (error) {
      const reason = error?.message || error?.code || "erro desconhecido";
      showToast(`Erro ao importar produtos em massa: ${reason}`, "error");
    } finally {
      setIsBulkImporting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const rawDescription = descriptionEditorRef.current
        ? descriptionEditorRef.current.innerHTML
        : formData.description;
      const normalizedDescription = sanitizeDescriptionHtml(rawDescription);

      const allowedTypes = new Set(
        (productCatalog.variationTypes || [])
          .map((item) => String(item?.name || "").trim())
          .filter(Boolean),
      );

      const normalizedVariationMap = Object.fromEntries(
        Object.entries(formData.variationsByType || {})
          .map(([type, values]) => [type, normalizeTextList(values)])
          .filter(
            ([type, values]) =>
              type &&
              values.length > 0 &&
              allowedTypes.has(type) &&
              type.toLowerCase() !== "opcao",
          ),
      );

      const flattenedVariations = Object.values(normalizedVariationMap)
        .flat()
        .join(", ");

      const parsedPriceTag = Number(formData.priceTag);
      const normalizedPriceTag =
        Number.isFinite(parsedPriceTag) && parsedPriceTag > 0
          ? parsedPriceTag
          : null;

      const productData = {
        ...formData,
        description: normalizedDescription,
        price: Number(formData.price),
        priceTag: normalizedPriceTag,
        stock: Number(formData.stock),
        subcategories: selectedSubcategories,
        subcategory: selectedSubcategories[0] || "",
        subsubcategory: formData.subsubcategory || "",
        showcaseSections: Array.isArray(formData.showcaseSections)
          ? formData.showcaseSections
          : [],
        variationsByType: normalizedVariationMap,
        variations: flattenedVariations,
        image: formData.images?.[0] || "", // Mantém compatibilidade com dados antigos
      };

      let finalProductData = productData;
      let payloadBytes = estimateUtf8Bytes(JSON.stringify(finalProductData));
      const hasInlineBase64Image = /<img[^>]+src=["']data:/i.test(
        normalizedDescription,
      );

      // Quando a descrição tem imagem inline (base64), tentamos salvar removendo apenas essas imagens.
      if (payloadBytes > 900000 && hasInlineBase64Image) {
        const strippedDescription = sanitizeDescriptionHtml(
          stripInlineBase64Images(normalizedDescription),
        );
        const strippedPayload = {
          ...finalProductData,
          description: strippedDescription,
        };
        const strippedBytes = estimateUtf8Bytes(
          JSON.stringify(strippedPayload),
        );

        if (strippedBytes <= 900000) {
          finalProductData = strippedPayload;
          payloadBytes = strippedBytes;
          showToast(
            "Descricao salva sem imagens coladas (base64). Use URL para manter imagens no texto.",
            "error",
          );
        }
      }

      // Se o peso vier da galeria, tenta compressao progressiva automaticamente.
      if (payloadBytes > 900000) {
        const optimization = await optimizeProductImagesForPayload(
          finalProductData,
          900000,
        );

        if (optimization.bytes < payloadBytes) {
          finalProductData = optimization.data;
          payloadBytes = optimization.bytes;
          showToast(
            `Galeria comprimida automaticamente para ${Math.round(payloadBytes / 1024)}KB.`,
            "success",
          );
        }
      }

      const descriptionBytes = estimateUtf8Bytes(finalProductData.description);
      const galleryBytes = estimateUtf8Bytes(
        JSON.stringify(finalProductData.images || []),
      );

      if (payloadBytes > 900000) {
        return showToast(
          `Produto muito grande (${Math.round(payloadBytes / 1024)}KB). Descricao: ${Math.round(descriptionBytes / 1024)}KB, galeria: ${Math.round(galleryBytes / 1024)}KB. Reduza quantidade de imagens no produto.`,
          "error",
        );
      }

      if (editingId) {
        await updateDoc(
          doc(db, "artifacts", appId, "public", "data", "products", editingId),
          { ...finalProductData, updatedAt: serverTimestamp() },
        );
        showToast("Produto atualizado com sucesso!");
      } else {
        await addDoc(
          collection(db, "artifacts", appId, "public", "data", "products"),
          { ...finalProductData, createdAt: serverTimestamp() },
        );
        showToast("Produto salvo com sucesso!");
      }

      closeForm();
    } catch (error) {
      console.error("ERRO AO SALVAR PRODUTO", error);
      const debugMessage =
        error?.message || error?.code || "Falha desconhecida ao salvar";
      showToast(`Erro ao salvar: ${debugMessage}`, "error");
    }
  };

  const handleEdit = (product) => {
    setFormData({
      name: product.name || "",
      price: product.price || "",
      priceTag: product.priceTag || "",
      category: product.category || "",
      subcategories: getProductSubcategories(product),
      subcategory: String(product.subcategory || "").trim(),
      subsubcategory: product.subsubcategory || "",
      showcaseSections: Array.isArray(product.showcaseSections)
        ? product.showcaseSections
        : [],
      description: product.description || "",
      stock: product.stock || "",
      images: product.images || (product.image ? [product.image] : []),
      variations: product.variations || "",
      variationsByType: getInitialVariationMap(product),
    });
    setEditingId(product.id);
    setIsAdding(true);
  };

  const executeDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await deleteDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "products",
          productToDelete.id,
        ),
      );
      showToast("Produto excluído com sucesso!");
    } catch (error) {
      showToast("Erro ao excluir produto", "error");
    }
    setProductToDelete(null);
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: "",
      price: "",
      priceTag: "",
      category: "",
      subcategories: [],
      subcategory: "",
      subsubcategory: "",
      showcaseSections: [],
      description: "",
      stock: "",
      images: [],
      variations: "",
      variationsByType: {},
    });
  };

  if (isAdding) {
    return (
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between mb-6">
          <h2 className="text-xl font-bold">
            {editingId ? "Editar Produto" : "Novo Produto"}
          </h2>
          <button onClick={closeForm}>
            <X />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-bold text-slate-700">
              Imagens do Produto
            </label>
            {(formData.images || []).length > 1 && (
              <p className="text-xs text-slate-500">
                A primeira imagem e a capa do produto. Use as setas para
                ordenar.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {(formData.images || []).map((imgBase64, idx) => (
                <div
                  key={idx}
                  className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden border border-slate-200 shadow-sm group"
                >
                  <img
                    src={normalizeExternalImageUrl(imgBase64)}
                    alt={`Upload ${idx}`}
                    className="w-full h-full object-cover"
                  />

                  <div className="absolute bottom-1 left-1 flex items-center gap-1">
                    <span className="bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                      {idx + 1}
                    </span>
                    {idx === 0 && (
                      <span className="bg-emerald-600/90 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                        CAPA
                      </span>
                    )}
                  </div>

                  <div className="absolute top-1 left-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => moveImage(idx, -1)}
                      disabled={idx === 0}
                      className="bg-white/90 text-slate-700 disabled:text-slate-300 p-1 rounded-md shadow"
                      title="Mover para a esquerda"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveImage(idx, 1)}
                      disabled={idx === (formData.images || []).length - 1}
                      className="bg-white/90 text-slate-700 disabled:text-slate-300 p-1 rounded-md shadow"
                      title="Mover para a direita"
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrimaryImage(idx)}
                      disabled={idx === 0}
                      className="bg-indigo-600/90 text-white disabled:bg-indigo-300 p-1.5 rounded-md shadow text-[10px] font-bold"
                      title="Definir como capa"
                    >
                      Capa
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 bg-rose-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <label className="flex flex-col items-center justify-center w-24 h-24 sm:w-32 sm:h-32 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl cursor-pointer bg-slate-50 hover:bg-indigo-50 transition-colors text-slate-400 hover:text-indigo-500 shrink-0">
                <Plus size={24} className="mb-1" />
                <span className="text-[10px] font-medium px-2 text-center uppercase tracking-wider">
                  Add Imagem
                </span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              required
              placeholder="Nome do Produto"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="md:col-span-2 p-3 border rounded-lg outline-none focus:border-indigo-400"
            />

            <div className="flex flex-col">
              <select
                required
                value={formData.category}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category: e.target.value,
                    subcategories: [],
                    subcategory: "",
                    subsubcategory: "",
                  })
                }
                className="p-3 border rounded-lg outline-none focus:border-indigo-400 bg-white"
              >
                <option value="">Selecione a categoria</option>
                {productCatalog.categories.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col md:col-span-2">
              <label className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                Subcategorias (pode selecionar mais de uma)
              </label>
              {availableSubcategories.length > 0 ? (
                <div className="flex flex-wrap gap-2 p-2.5 border rounded-lg bg-white min-h-[48px]">
                  {availableSubcategories.map((subcategory) => {
                    const isActive =
                      selectedSubcategories.includes(subcategory);
                    return (
                      <button
                        key={subcategory}
                        type="button"
                        onClick={() => toggleSubcategory(subcategory)}
                        className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition ${
                          isActive
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-300"
                        }`}
                      >
                        {subcategory}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 border rounded-lg bg-slate-50 text-sm text-slate-500">
                  Sem subcategorias nessa categoria.
                </div>
              )}
            </div>

            <div className="flex flex-col">
              <select
                value={formData.subsubcategory}
                onChange={(e) =>
                  setFormData({ ...formData, subsubcategory: e.target.value })
                }
                className="p-3 border rounded-lg outline-none focus:border-indigo-400 bg-white"
                disabled={availableSubsubcategories.length === 0}
              >
                <option value="">
                  {availableSubsubcategories.length > 0
                    ? "Selecione o segmento"
                    : "Sem segmentos nessa categoria"}
                </option>
                {availableSubsubcategories.map((seg) => (
                  <option key={seg} value={seg}>
                    {seg}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <input
                required
                type="number"
                step="0.01"
                placeholder="Preço (R$)"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
                className="p-3 border rounded-lg outline-none focus:border-indigo-400"
              />
            </div>

            <div className="flex flex-col">
              <input
                type="number"
                step="0.01"
                placeholder="Preço Tarja / De (R$)"
                value={formData.priceTag}
                onChange={(e) =>
                  setFormData({ ...formData, priceTag: e.target.value })
                }
                className="p-3 border rounded-lg outline-none focus:border-indigo-400"
              />
            </div>

            <div className="flex flex-col">
              <input
                required
                type="number"
                placeholder="Qtd. em Estoque"
                value={formData.stock}
                onChange={(e) =>
                  setFormData({ ...formData, stock: e.target.value })
                }
                className="p-3 border rounded-lg outline-none focus:border-indigo-400"
              />
            </div>

            <div className="md:col-span-2 space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">
                  Sessões do Mostruário
                </h4>
                <span className="text-xs text-slate-500 font-semibold">
                  Marque onde este produto deve aparecer no início da loja
                </span>
              </div>

              {availableShowcaseSections.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhuma sessão cadastrada no admin. Crie em Configurações para
                  habilitar este vínculo.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {availableShowcaseSections.map((section) => (
                    <label
                      key={section.id}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={(formData.showcaseSections || []).includes(
                          section.id,
                        )}
                        onChange={() => handleToggleShowcaseSection(section.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                      />
                      {section.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2 space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">
                  Variações do Produto
                </h4>
                <span className="text-xs text-slate-500 font-semibold">
                  Definidas em Configurações do Admin
                </span>
              </div>

              {productCatalog.variationTypes.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhum tipo de variação configurado. Cadastre em Configurações
                  para habilitar Tamanho, Cor, etc.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {productCatalog.variationTypes.map((variationType) => (
                    <div
                      key={variationType.name}
                      className="flex flex-col gap-1"
                    >
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider">
                        {variationType.name}
                      </label>
                      <input
                        placeholder={`Ex: ${variationType.options.join(", ")}`}
                        value={
                          formData.variationsByType?.[variationType.name] || ""
                        }
                        onChange={(e) =>
                          handleVariationTypeChange(
                            variationType.name,
                            e.target.value,
                          )
                        }
                        className="p-3 border rounded-lg outline-none focus:border-indigo-400 bg-white"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <textarea
              placeholder="Descrição breve"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="hidden"
            />

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">
                Descrição rica (aceita HTML)
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleInsertSizeTableTemplate}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Inserir Tabela de Medidas
                </button>
              </div>
              <div
                ref={descriptionEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  const html = e.currentTarget?.innerHTML || "";
                  setFormData((prev) => ({
                    ...prev,
                    description: html,
                  }));
                }}
                className="min-h-[180px] md:min-h-[220px] p-3 border rounded-lg outline-none focus:border-indigo-400 bg-white"
                style={{ whiteSpace: "pre-wrap" }}
              />
              <p className="text-xs text-slate-500">
                Pode colar conteúdo formatado (texto com estilos e HTML). Se
                colar imagem inline (base64), o Firestore pode recusar por
                limite de tamanho do documento.
              </p>
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl mt-4 transition shadow-md"
          >
            {editingId ? "Atualizar Produto" : "Salvar Produto"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Produtos</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-700 transition text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
          >
            <Upload size={18} />
            <span className="hidden sm:inline">Cadastro Massivo</span>
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 hover:bg-indigo-700 transition text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
          >
            <Plus size={18} />{" "}
            <span className="hidden sm:inline">Novo Produto</span>
          </button>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Buscar por nome, categoria ou subcategoria"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="p-3 border border-slate-200 rounded-xl bg-white min-w-[190px]"
          >
            <option value="all">Todas as categorias</option>
            {availableCategoriesFilter.map((categoryName) => (
              <option key={categoryName} value={categoryName}>
                {categoryName}
              </option>
            ))}
          </select>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="p-3 border border-slate-200 rounded-xl bg-white min-w-[170px]"
          >
            <option value="all">Todos os estoques</option>
            <option value="available">Com estoque</option>
            <option value="low">Estoque baixo (1-5)</option>
            <option value="out">Sem estoque</option>
          </select>
        </div>
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="border-b">
              <th className="p-4">Produto</th>
              <th className="p-4">Categoria</th>
              <th className="p-4">Subcategoria</th>
              <th className="p-4">Preço</th>
              <th className="p-4">Estoque</th>
              <th className="p-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProducts.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-medium flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded overflow-hidden shrink-0">
                    {(p.images?.[0] || p.image) && (
                      <img
                        src={normalizeExternalImageUrl(
                          p.images?.[0] || p.image,
                        )}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <span className="line-clamp-1">{p.name}</span>
                </td>
                <td className="p-4">
                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-semibold">
                    {p.category || "N/A"}
                  </span>
                </td>
                <td className="p-4">
                  <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs font-semibold border border-amber-100">
                    {p.subcategory || "-"}
                  </span>
                </td>
                <td className="p-4 text-indigo-600 font-bold">
                  R$ {Number(p.price).toFixed(2)}
                </td>
                <td className="p-4">{p.stock}</td>
                <td className="p-4 text-right">
                  <div className="flex justify-end items-center gap-2">
                    <button
                      onClick={() => handleEdit(p)}
                      className="text-indigo-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded transition-colors"
                      title="Editar Produto"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => setProductToDelete(p)}
                      className="text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded transition-colors"
                      title="Excluir Produto"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan="6" className="p-8 text-center text-slate-400">
                  Nenhum produto encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!productToDelete}
        title="Excluir Produto do Catálogo"
        message={`Você está prestes a excluir "${productToDelete?.name || "este produto"}". Esta ação não poderá ser desfeita.`}
        onConfirm={executeDeleteProduct}
        onCancel={() => setProductToDelete(null)}
        confirmText="Excluir Produto"
        cancelText="Manter Produto"
        confirmStyle="bg-rose-600 hover:bg-rose-700"
      />

      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-800">
                  Cadastro Massivo de Produtos
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Importe arquivo CSV ou JSON para cadastrar vários produtos.
                </p>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 md:p-6 space-y-4 overflow-y-auto">
              <div className="flex flex-wrap items-center gap-3">
                <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg cursor-pointer text-sm font-bold inline-flex items-center gap-2">
                  <Upload size={16} />
                  <span className="whitespace-nowrap">Selecionar arquivo</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv,.json"
                    onChange={handleBulkFileChange}
                  />
                </label>
                <a
                  href="/modelo-cadastro-massivo.csv"
                  download
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-2"
                >
                  <Download size={16} />
                  Baixar Arquivo Aceito
                </a>
                {bulkFileName && (
                  <span className="text-sm text-slate-500 font-semibold">
                    Arquivo: {bulkFileName}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <p className="text-xs text-emerald-700 font-black uppercase tracking-wider">
                    Produtos Válidos
                  </p>
                  <p className="text-2xl font-black text-emerald-600">
                    {bulkProductsPreview.length}
                  </p>
                </div>
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                  <p className="text-xs text-rose-700 font-black uppercase tracking-wider">
                    Linhas com Erro
                  </p>
                  <p className="text-2xl font-black text-rose-600">
                    {bulkErrors.length}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-500 font-black uppercase tracking-wider">
                    Formatos Aceitos
                  </p>
                  <p className="text-sm font-bold text-slate-700 mt-1">
                    .csv e .json
                  </p>
                </div>
              </div>

              {bulkErrors.length > 0 && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3">
                  <p className="text-sm font-black text-rose-700 mb-2">
                    Erros encontrados
                  </p>
                  <ul className="text-xs text-rose-700 space-y-1 max-h-32 overflow-y-auto">
                    {bulkErrors.slice(0, 15).map((error, idx) => (
                      <li key={`${error}-${idx}`}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {bulkProductsPreview.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="text-left p-3">Nome</th>
                        <th className="text-left p-3">Categoria</th>
                        <th className="text-left p-3">Preço</th>
                        <th className="text-left p-3">Estoque</th>
                        <th className="text-left p-3">Imagens</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {bulkProductsPreview.slice(0, 10).map((item, idx) => (
                        <tr key={`${item.name}-${idx}`}>
                          <td className="p-3 font-semibold text-slate-700">
                            {item.name}
                          </td>
                          <td className="p-3 text-slate-600">
                            {item.category || "-"}
                          </td>
                          <td className="p-3 text-indigo-600 font-bold">
                            {formatCurrencyBRL(item.price)}
                          </td>
                          <td className="p-3 text-slate-700">{item.stock}</td>
                          <td className="p-3 text-slate-600">
                            {item.images?.length || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-5 md:p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
              >
                Fechar
              </button>
              <button
                onClick={executeBulkImport}
                disabled={bulkProductsPreview.length === 0 || isBulkImporting}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold"
              >
                {isBulkImporting
                  ? "Importando..."
                  : `Importar ${bulkProductsPreview.length} Produto(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PointOfSale({ products, showToast, storeSettings }) {
  const [currentSale, setCurrentSale] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro");
  const [lastReceipt, setLastReceipt] = useState(null);
  const [posPixData, setPosPixData] = useState(null); // Recebe dados reais do PIX no PDV

  // --- Lógica de Clientes POS ---
  const [customers, setCustomers] = useState([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    document: "",
  });

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "artifacts", appId, "public", "data", "customers"),
      (snap) => {
        setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
    );
    return () => unsub();
  }, []);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      c.phone?.includes(customerSearchTerm) ||
      c.document?.includes(customerSearchTerm),
  );

  const saveCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone)
      return showToast("Nome e telefone são obrigatórios", "error");
    try {
      const docRef = await addDoc(
        collection(db, "artifacts", appId, "public", "data", "customers"),
        {
          ...newCustomer,
          createdAt: serverTimestamp(),
        },
      );
      setSelectedCustomer({ id: docRef.id, ...newCustomer });
      setIsCustomerModalOpen(false);
      setNewCustomer({ name: "", document: "", phone: "" });
      setCustomerSearchTerm("");
      showToast("Cliente cadastrado com sucesso!");
    } catch (e) {
      showToast("Erro ao cadastrar cliente", "error");
    }
  };

  // --- Lógica de Venda ---
  const addToSale = (product) => {
    const existing = currentSale.find((item) => item.id === product.id);
    const currentQty = existing ? existing.qty : 0;

    // Trava de Estoque para PDV
    if (currentQty + 1 > Number(product.stock)) {
      return showToast(
        `Temos apenas ${product.stock} unidade(s) em estoque!`,
        "error",
      );
    }

    setCurrentSale((prev) => {
      if (existing)
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item,
        );
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updatePosQty = (id, delta) => {
    const itemToUpdate = currentSale.find((i) => i.id === id);

    if (itemToUpdate && itemToUpdate.qty + delta > Number(itemToUpdate.stock)) {
      return showToast(
        `Limite de ${itemToUpdate.stock} unidade(s) atingido!`,
        "error",
      );
    }

    setCurrentSale((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item,
      ),
    );
  };

  const totalSale = currentSale.reduce(
    (sum, item) => sum + Number(item.price) * item.qty,
    0,
  );

  const availableProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const finalizeSale = async () => {
    if (currentSale.length === 0) return;
    try {
      const cleanCart = currentSale.map((item) => ({
        id: item.id || null,
        name: item.name || "",
        price: item.price || 0,
        qty: item.qty || 1,
        stock: item.stock || 0,
      }));

      const order = {
        type: "presencial",
        items: cleanCart,
        total: totalSale,
        status: paymentMethod === "PIX" ? "pendente_pagamento" : "concluido",
        customerName: selectedCustomer?.name || "Cliente Balcão",
        customerDoc: selectedCustomer?.document || "",
        customerPhone: selectedCustomer?.phone || "",
        paymentMethod: paymentMethod,
        createdAt: serverTimestamp(),
        receiptId: Math.floor(100000 + Math.random() * 900000).toString(),
      };

      const externalReference = `pdv-${order.receiptId}-${Date.now()}`;

      // Se houver chave PIX na configuração, gera payload PIX direto no PDV.
      // Caso não haja, usa integração do backend com Mercado Pago.
      if (paymentMethod === "PIX") {
        const configuredPixKey = String(storeSettings?.pixKey || "").trim();

        if (configuredPixKey) {
          const pixPayload = buildPixPayload({
            pixKey: configuredPixKey,
            amount: totalSale,
            merchantName: storeSettings?.storeName || "LOJA",
            merchantCity: "SAO PAULO",
            txid: externalReference,
          });

          setPosPixData({
            id: `static-${externalReference}`,
            qr_code: pixPayload,
            qr_code_base64: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixPayload)}`,
            source: "pix_key",
          });
          order.pixType = "pix_key";
          order.mpExternalReference = externalReference;
        } else {
          const res = await fetch(buildApiUrl("/api/pix"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-idempotency-key": createIdempotencyKey("pdv-pix"),
            },
            body: JSON.stringify({
              transaction_amount: totalSale,
              description: "Compra Balcão - PDV",
              external_reference: externalReference,
              payer: {
                email: "caixa@loja.com",
                first_name: selectedCustomer?.name || "Cliente Balcão",
              },
            }),
          });

          const data = await res.json();
          if (!res.ok || !data?.qr_code_base64 || !data?.qr_code) {
            throw new Error(
              data?.error ||
                "Falha ao gerar PIX no PDV. Configure uma CHAVE PIX na tela de integrações.",
            );
          }

          setPosPixData(data);
          order.mpPaymentId = data.id;
          order.mpExternalReference = externalReference;
          order.pixType = "mercado_pago";
        }
      }

      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "orders"),
        order,
      );

      // Update stock
      for (const item of cleanCart) {
        if (item.id) {
          await updateDoc(
            doc(db, "artifacts", appId, "public", "data", "products", item.id),
            { stock: Math.max(0, Number(item.stock || 0) - Number(item.qty)) },
          );
        }
      }

      setLastReceipt(order);
      setCurrentSale([]);
      setSelectedCustomer(null);
      setCustomerSearchTerm("");
      showToast("Venda finalizada com sucesso!");
    } catch (error) {
      console.error(error);
      showToast(error?.message || "Erro ao finalizar venda", "error");
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] print:block print:h-auto print:gap-0">
      {/* Modal / Overlay de Recibo (Venda Concluída) */}
      {lastReceipt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm print:absolute print:inset-0 print:bg-transparent print:backdrop-blur-none print:items-start print:justify-start print:p-0">
          <div
            id="print-receipt-container"
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col print:rounded-none print:shadow-none print:border-none print:max-w-[80mm] print:w-[80mm] print:m-0"
          >
            <div className="p-6 bg-emerald-500 text-white text-center print:hidden">
              <CheckCircle2
                size={56}
                className="mx-auto mb-3 text-emerald-100"
              />
              <h2 className="text-2xl font-bold tracking-tight">
                Venda Concluída!
              </h2>
              <p className="text-emerald-100 text-sm mt-1">
                Recibo gerado com sucesso
              </p>
            </div>

            {/* Área que será impressa */}
            <div className="p-6 bg-white text-black font-mono text-[11px] leading-tight print:p-0">
              <div className="text-center font-bold text-base border-b-2 border-black border-dashed pb-3 mb-3 uppercase">
                {storeSettings?.storeName || "Loja"}
                <br />
                <span className="text-xs font-normal mt-1 block">
                  CUPOM NÃO FISCAL
                </span>
              </div>

              {lastReceipt.paymentMethod === "PIX" && posPixData && (
                <div className="mb-4 p-4 bg-teal-50 rounded-xl border border-teal-200 flex flex-col items-center print:hidden">
                  <h4 className="font-bold text-teal-800 mb-2">
                    Escaneie para Pagar
                  </h4>
                  <img
                    src={
                      posPixData.qr_code_base64?.startsWith("http")
                        ? posPixData.qr_code_base64
                        : `data:image/jpeg;base64,${posPixData.qr_code_base64}`
                    }
                    className="w-40 h-40 rounded-lg shadow-sm mb-2 object-contain"
                    alt="QR Code"
                  />
                  <div className="w-full flex gap-1">
                    <input
                      readOnly
                      value={posPixData.qr_code}
                      className="flex-1 text-[10px] p-2 rounded border border-teal-200 outline-none bg-white truncate"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(posPixData.qr_code);
                        showToast("PIX Copiado!");
                      }}
                      className="bg-teal-600 text-white px-3 text-xs font-bold rounded hover:bg-teal-700"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-4">
                Data: {new Date().toLocaleString()}
                <br />
                Recibo: #{lastReceipt.receiptId}
                <br />
                Cliente:{" "}
                <span className="font-bold">{lastReceipt.customerName}</span>
                <br />
                {lastReceipt.customerDoc && (
                  <>
                    CPF/CNPJ: {lastReceipt.customerDoc}
                    <br />
                  </>
                )}
              </div>
              <div className="border-b border-black border-dashed mb-3 pb-3 space-y-1.5">
                <div className="flex justify-between font-bold text-xs">
                  <span>QTD DESCRIÇÃO</span>
                  <span>TOTAL</span>
                </div>
                {lastReceipt.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="pr-2 truncate">
                      {i.qty}x {i.name}
                    </span>
                    <span>R$ {(i.qty * i.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-black text-sm mb-2">
                <span>VALOR TOTAL</span>
                <span>R$ {lastReceipt.total.toFixed(2)}</span>
              </div>
              <div className="mb-6">
                Forma Pagto: {lastReceipt.paymentMethod}
              </div>
              <div className="text-center italic border-t border-black border-dashed pt-3">
                Obrigado pela preferência e volte sempre!
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-md"
              >
                <Printer size={20} /> Imprimir
              </button>
              <button
                onClick={() => {
                  setLastReceipt(null);
                  setPosPixData(null);
                }}
                className="flex-1 bg-white border-2 border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-slate-700 py-3.5 rounded-xl font-bold transition"
              >
                Nova Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro de Cliente (POS) */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up border border-slate-100">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                <UserPlus size={20} /> Novo Cliente
              </h3>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="hover:bg-slate-200 p-1.5 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
                  Nome Completo *
                </label>
                <input
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, name: e.target.value })
                  }
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
                  Telefone (Celular) *
                </label>
                <input
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      phone: maskPhone(e.target.value),
                    })
                  }
                  maxLength={15}
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
                  CPF/CNPJ (Opcional)
                </label>
                <input
                  value={newCustomer.document}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, document: e.target.value })
                  }
                  className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={saveCustomer}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 transition shadow-md text-white rounded-xl font-bold mt-2"
              >
                Salvar e Selecionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid de Produtos */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden print:hidden">
        <div className="p-4 border-b border-slate-100 relative bg-slate-50/50">
          <Search
            className="absolute left-7 top-1/2 -translate-y-1/2 text-indigo-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Buscar produto pelo nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
          />
        </div>
        <div className="flex-1 p-4 md:p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
          {availableProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => addToSale(p)}
              disabled={Number(p.stock) <= 0}
              className="bg-white p-4 rounded-2xl border border-slate-100 text-left hover:border-indigo-400 hover:shadow-lg transition-all disabled:opacity-50 flex flex-col h-full group"
            >
              <div className="w-full aspect-[4/3] bg-slate-50 rounded-xl mb-3 overflow-hidden shrink-0">
                {p.images?.[0] || p.image ? (
                  <img
                    src={normalizeExternalImageUrl(p.images?.[0] || p.image)}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                ) : (
                  <ImageIcon className="w-full h-full p-4 text-slate-200" />
                )}
              </div>
              <div className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight flex-grow group-hover:text-indigo-600 transition-colors">
                {p.name}
              </div>
              <div className="flex justify-between items-end mt-3 border-t border-slate-50 pt-2 w-full">
                <div className="text-indigo-600 font-black text-sm">
                  R$ {Number(p.price).toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wider">
                  {p.stock} un
                </div>
              </div>
            </button>
          ))}
          {availableProducts.length === 0 && (
            <div className="col-span-full text-center py-10 text-slate-400">
              Nenhum produto encontrado.
            </div>
          )}
        </div>
      </div>

      {/* Barra Lateral do Caixa */}
      <div className="w-full lg:w-96 bg-white rounded-3xl shadow-sm border border-slate-200/60 flex flex-col shrink-0 relative print:hidden">
        <div className="p-5 bg-slate-900 text-white rounded-t-3xl font-bold flex justify-between items-center">
          <span className="flex items-center gap-2">
            <Monitor size={20} className="text-indigo-400" /> Caixa PDV
          </span>
          <span className="text-xs bg-slate-800 px-2 py-1 rounded-lg text-slate-300 font-medium">
            Fast Checkout
          </span>
        </div>

        {/* Seleção de Cliente */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-4">
          {!selectedCustomer ? (
            <div className="relative">
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
                Identificar Cliente
              </label>
              <input
                placeholder="Buscar por Nome, CPF ou Telefone..."
                value={customerSearchTerm}
                onChange={(e) => {
                  setCustomerSearchTerm(e.target.value);
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 bg-white focus:ring-2 focus:ring-indigo-50 transition-shadow text-sm"
              />

              {/* Dropdown de Resultados */}
              {showCustomerDropdown && customerSearchTerm.length > 0 && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowCustomerDropdown(false)}
                  ></div>
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerSearchTerm("");
                          setShowCustomerDropdown(false);
                        }}
                        className="w-full text-left p-3 border-b border-slate-50 hover:bg-indigo-50 transition flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-bold text-sm text-slate-800 group-hover:text-indigo-700">
                            {c.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {c.phone} {c.document ? `| ${c.document}` : ""}
                          </div>
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-slate-300 group-hover:text-indigo-400"
                        />
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <div className="p-4 text-center bg-slate-50/50">
                        <p className="text-sm text-slate-500 mb-3">
                          Cliente não encontrado.
                        </p>
                        <button
                          onClick={() => {
                            setIsCustomerModalOpen(true);
                            setShowCustomerDropdown(false);
                          }}
                          className="text-sm bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-bold hover:bg-indigo-200 w-full flex items-center justify-center gap-2"
                        >
                          <UserPlus size={16} /> Cadastrar Novo Cliente
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
                Cliente Vinculado
              </label>
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 p-3 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-200 text-indigo-700 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-indigo-900 leading-tight">
                      {selectedCustomer.name}
                    </p>
                    <p className="text-xs text-indigo-600 mt-0.5 font-medium">
                      {selectedCustomer.phone}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-rose-400 hover:text-rose-600 hover:bg-white p-2 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
              Forma de Pagamento
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 bg-white shadow-sm cursor-pointer"
            >
              <option value="Dinheiro">💵 Dinheiro Vivo</option>
              <option value="Cartão de Crédito">
                💳 Cartão de Crédito (Maquininha)
              </option>
              <option value="Cartão de Débito">
                💳 Cartão de Débito (Maquininha)
              </option>
              <option value="PIX">📱 PIX Direto</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Itens da Venda
          </h4>

          {currentSale.length === 0 ? (
            <div className="text-center text-slate-400 text-sm mt-10 flex flex-col items-center gap-3">
              <ShoppingCart size={40} className="text-slate-200" />
              Clique nos produtos para
              <br />
              adicionar à venda atual.
            </div>
          ) : (
            currentSale.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 text-sm border-b border-slate-100 py-4 last:border-0 group"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="font-bold text-slate-800 line-clamp-2 leading-tight flex-1">
                    {item.name}
                  </div>
                  <button
                    onClick={() =>
                      setCurrentSale((prev) =>
                        prev.filter((i) => i.id !== item.id),
                      )
                    }
                    className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                    title="Remover Item"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="flex justify-between items-center mt-1">
                  {/* Seletor Rápido de Quantidade no PDV */}
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200/50">
                    <button
                      onClick={() => updatePosQty(item.id, -1)}
                      className="w-7 h-7 flex items-center justify-center bg-white rounded-md shadow-sm font-black text-slate-500 hover:text-indigo-600 transition-colors"
                    >
                      -
                    </button>
                    <span className="text-sm font-bold w-6 text-center text-slate-800">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updatePosQty(item.id, 1)}
                      className="w-7 h-7 flex items-center justify-center bg-white rounded-md shadow-sm font-black text-slate-500 hover:text-indigo-600 transition-colors"
                    >
                      +
                    </button>
                  </div>

                  <div className="font-black text-slate-800 text-base">
                    R$ {(item.qty * item.price).toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-3xl">
          <div className="flex justify-between text-xl font-bold mb-5 items-center">
            <span className="text-slate-500 text-sm uppercase tracking-wider">
              Total a Cobrar
            </span>
            <span className="text-slate-900 text-3xl font-black">
              R$ {totalSale.toFixed(2)}
            </span>
          </div>
          <button
            onClick={finalizeSale}
            disabled={currentSale.length === 0}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:bg-slate-300 disabled:shadow-none flex justify-center items-center gap-2 text-lg active:scale-[0.98]"
          >
            <CheckCircle2 size={24} /> Concluir Venda
          </button>
        </div>
      </div>
    </div>
  );
}

function OrdersList({ orders, showToast, quickFilter = "all" }) {
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [trackingDrafts, setTrackingDrafts] = useState({});
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [orderToRefund, setOrderToRefund] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const stockReturnStatuses = new Set(["estornado", "cancelado"]);

  const statusCatalog = {
    pendente_pagamento: {
      label: "Pendente de Pagamento",
      color: "bg-amber-100 text-amber-700",
    },
    pendente: { label: "Pendente", color: "bg-amber-100 text-amber-700" },
    separacao: {
      label: "Em Separação",
      color: "bg-sky-100 text-sky-700",
    },
    enviado: { label: "Enviado", color: "bg-indigo-100 text-indigo-700" },
    entregue: { label: "Entregue", color: "bg-emerald-100 text-emerald-700" },
    concluido: {
      label: "Concluído",
      color: "bg-emerald-100 text-emerald-700",
    },
    estornado: {
      label: "Estornado",
      color: "bg-rose-100 text-rose-700",
    },
    cancelado: { label: "Cancelado", color: "bg-slate-100 text-slate-700" },
  };

  const getOrderStatus = (order) => {
    if (order.status) return order.status;
    return order.type === "online" ? "pendente_pagamento" : "concluido";
  };

  useEffect(() => {
    if (quickFilter === "losses") {
      setStatusFilter("losses");
    }
  }, [quickFilter]);

  const filteredOrders = useMemo(() => {
    const query = String(searchTerm || "")
      .trim()
      .toLowerCase();

    return orders.filter((order) => {
      const status = getOrderStatus(order);
      const type = String(order?.type || "").toLowerCase();
      const orderRef = String(order?.id || "").toLowerCase();
      const customer = String(
        order?.customerName || order?.address?.recebedorNome || "",
      ).toLowerCase();
      const email = String(order?.customerEmail || "").toLowerCase();
      const phone = String(
        order?.customerPhone || order?.address?.recebedorTelefone || "",
      ).toLowerCase();
      const tracking = String(order?.trackingCode || "").toLowerCase();
      const paymentMethod = String(order?.paymentMethod || "").toLowerCase();

      const matchesQuery =
        !query ||
        orderRef.includes(query) ||
        customer.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        tracking.includes(query) ||
        paymentMethod.includes(query);

      const matchesType = typeFilter === "all" || type === typeFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "losses"
          ? status === "estornado" || status === "cancelado"
          : status === statusFilter);

      return matchesQuery && matchesType && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter, typeFilter]);

  const statusHistoryPush = (order, nextStatus, actionLabel) => {
    const prevHistory = Array.isArray(order.statusHistory)
      ? order.statusHistory
      : [];
    return [
      ...prevHistory,
      {
        from: getOrderStatus(order),
        to: nextStatus,
        action: actionLabel,
        at: new Date().toISOString(),
      },
    ];
  };

  const getAllowedStatuses = (order) => {
    if (order.type === "online") {
      return [
        "pendente_pagamento",
        "separacao",
        "enviado",
        "entregue",
        "estornado",
        "cancelado",
      ];
    }
    return ["pendente_pagamento", "concluido", "estornado", "cancelado"];
  };

  const applyOrderStockAdjustment = async (order, mode) => {
    const items = Array.isArray(order?.items) ? order.items : [];

    for (const item of items) {
      if (!item?.id) continue;

      const qty = Number(item.qty || 0);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const productRef = doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "products",
        item.id,
      );
      const productSnap = await getDoc(productRef);
      if (!productSnap.exists()) continue;

      const currentStock = Number(productSnap.data()?.stock || 0);
      const nextStock =
        mode === "restore"
          ? currentStock + qty
          : Math.max(0, currentStock - qty);

      await updateDoc(productRef, { stock: nextStock });
    }
  };

  const updateOrderStatusWithStock = async (
    order,
    nextStatus,
    actionLabel,
    extraPayload = {},
  ) => {
    const isReturningStockStatus = stockReturnStatuses.has(nextStatus);
    const hasStockRestored = Boolean(order.stockRestored);

    if (isReturningStockStatus && !hasStockRestored) {
      await applyOrderStockAdjustment(order, "restore");
    }

    if (!isReturningStockStatus && hasStockRestored) {
      await applyOrderStockAdjustment(order, "deduct");
    }

    const payload = {
      status: nextStatus,
      statusUpdatedAt: serverTimestamp(),
      statusHistory: statusHistoryPush(order, nextStatus, actionLabel),
      ...extraPayload,
    };

    if (isReturningStockStatus && !hasStockRestored) {
      payload.stockRestored = true;
      payload.stockRestoredAt = serverTimestamp();
    }

    if (!isReturningStockStatus && hasStockRestored) {
      payload.stockRestored = false;
      payload.stockRestoredAt = null;
      payload.stockReappliedAt = serverTimestamp();
    }

    await updateDoc(
      doc(db, "artifacts", appId, "public", "data", "orders", order.id),
      payload,
    );
  };

  const handleStatusChange = async (order, nextStatus) => {
    if (!order?.id || !nextStatus) return;
    if (nextStatus === getOrderStatus(order)) return;

    setSavingOrderId(order.id);
    try {
      const payload = {};
      if (nextStatus === "enviado" && !order.shippedAt) {
        payload.shippedAt = serverTimestamp();
      }
      if (nextStatus === "entregue") {
        payload.deliveredAt = serverTimestamp();
      }

      await updateOrderStatusWithStock(
        order,
        nextStatus,
        "status_update",
        payload,
      );
      showToast("Status do pedido atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar status do pedido:", error);
      showToast("Erro ao atualizar status do pedido", "error");
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleSaveTracking = async (order) => {
    if (!order?.id) return;
    const rawTracking =
      trackingDrafts[order.id] !== undefined
        ? trackingDrafts[order.id]
        : order.trackingCode || "";
    const trackingCode = String(rawTracking || "").trim();

    if (!trackingCode) {
      return showToast("Informe um código de rastreio válido", "error");
    }

    setSavingOrderId(order.id);
    try {
      const currentStatus = getOrderStatus(order);
      const nextStatus =
        currentStatus === "pendente_pagamento" ||
        currentStatus === "pendente" ||
        currentStatus === "separacao"
          ? "enviado"
          : currentStatus;

      const payload = {
        trackingCode,
        trackingUpdatedAt: serverTimestamp(),
      };

      if (nextStatus !== currentStatus) {
        payload.status = nextStatus;
        payload.shippedAt = serverTimestamp();
        payload.statusUpdatedAt = serverTimestamp();
        payload.statusHistory = statusHistoryPush(
          order,
          nextStatus,
          "tracking_attached",
        );
      }

      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "orders", order.id),
        payload,
      );
      showToast("Código de rastreio salvo!");
    } catch (error) {
      console.error("Erro ao salvar rastreio:", error);
      showToast("Erro ao salvar código de rastreio", "error");
    } finally {
      setSavingOrderId(null);
    }
  };

  const handleRefund = async (order) => {
    if (!order?.id) return;
    setOrderToRefund(order.id);
  };

  const executeRefundOrder = async () => {
    if (!orderToRefund) return;

    const order = orders.find((item) => item.id === orderToRefund);
    if (!order) {
      setOrderToRefund(null);
      return showToast("Pedido não encontrado para estorno.", "error");
    }

    setSavingOrderId(order.id);
    try {
      await updateOrderStatusWithStock(order, "estornado", "refund", {
        refundedAt: serverTimestamp(),
        refundRequestedBy: "painel_admin",
      });
      showToast("Pedido marcado como estornado.");
    } catch (error) {
      console.error("Erro ao estornar pedido:", error);
      showToast("Erro ao estornar pedido", "error");
    } finally {
      setSavingOrderId(null);
      setOrderToRefund(null);
    }
  };

  const buildCustomerContactHref = (order) => {
    const phone = String(
      order?.customerPhone || order?.address?.recebedorTelefone || "",
    );
    const digits = normalizePhoneDigits(phone);
    if (digits.length < 10) return "";
    return `https://wa.me/55${digits}`;
  };

  const handleReviewCancellationRequest = async (order, decision) => {
    if (!order?.id || order?.cancellationRequest?.status !== "requested")
      return;

    setSavingOrderId(order.id);
    try {
      if (decision === "approved") {
        await updateOrderStatusWithStock(
          order,
          "cancelado",
          "cancel_request_approved",
          {
            cancellationRequest: {
              ...order.cancellationRequest,
              status: "approved",
              reviewedAt: serverTimestamp(),
              reviewedBy: "admin",
            },
            cancellationReviewedAt: serverTimestamp(),
          },
        );
        showToast("Solicitação de cancelamento aprovada.");
        return;
      }

      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "orders", order.id),
        {
          cancellationRequest: {
            ...order.cancellationRequest,
            status: "rejected",
            reviewedAt: serverTimestamp(),
            reviewedBy: "admin",
          },
          cancellationReviewedAt: serverTimestamp(),
        },
      );
      showToast("Solicitação de cancelamento recusada.");
    } catch (error) {
      console.error("Erro ao revisar cancelamento:", error);
      showToast("Erro ao revisar solicitação de cancelamento", "error");
    } finally {
      setSavingOrderId(null);
    }
  };

  const executeDeleteOrder = async () => {
    if (!orderToDelete) return;

    const order = orders.find((item) => item.id === orderToDelete);
    setSavingOrderId(orderToDelete);
    try {
      if (order) {
        const status = getOrderStatus(order);
        const hasStockRestored = Boolean(order.stockRestored);
        const shouldRestoreBeforeDelete =
          !hasStockRestored && !stockReturnStatuses.has(status);

        if (shouldRestoreBeforeDelete) {
          await applyOrderStockAdjustment(order, "restore");
        }
      }

      await deleteDoc(
        doc(db, "artifacts", appId, "public", "data", "orders", orderToDelete),
      );
      showToast("Compra excluída com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir compra:", error);
      showToast("Erro ao excluir compra", "error");
    } finally {
      setSavingOrderId(null);
      setOrderToDelete(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col lg:flex-row gap-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por pedido, cliente, e-mail, telefone ou rastreio"
          className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="p-3 border border-slate-200 rounded-xl bg-white min-w-[160px]"
        >
          <option value="all">Todos os tipos</option>
          <option value="online">Online</option>
          <option value="presencial">Presencial</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-3 border border-slate-200 rounded-xl bg-white min-w-[220px]"
        >
          <option value="all">Todos os status</option>
          <option value="losses">Perdas (Estornado/Cancelado)</option>
          <option value="pendente_pagamento">Pendente de Pagamento</option>
          <option value="separacao">Em Separação</option>
          <option value="enviado">Enviado</option>
          <option value="entregue">Entregue</option>
          <option value="concluido">Concluído</option>
          <option value="estornado">Estornado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>
      <table className="w-full text-left text-sm min-w-[1120px]">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="p-4">Data/Hora</th>
            <th className="p-4">Tipo</th>
            <th className="p-4">Cliente</th>
            <th className="p-4">Status</th>
            <th className="p-4">Rastreio</th>
            <th className="p-4">Método</th>
            <th className="p-4 text-right">Valor Total</th>
            <th className="p-4 text-center">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredOrders.map((o) => {
            const status = getOrderStatus(o);
            const statusMeta = statusCatalog[status] ||
              statusCatalog.pendente || {
                label: status,
                color: "bg-slate-100 text-slate-700",
              };
            const allowedStatuses = getAllowedStatuses(o);
            const isSaving = savingOrderId === o.id;
            const trackingValue =
              trackingDrafts[o.id] !== undefined
                ? trackingDrafts[o.id]
                : o.trackingCode || "";
            const cancellationStatus = o?.cancellationRequest?.status || "";
            const hasPendingCancellation = cancellationStatus === "requested";
            const customerContactHref = buildCustomerContactHref(o);

            return (
              <tr key={o.id} className="hover:bg-slate-50 align-top">
                <td className="p-4 font-medium text-slate-700 whitespace-nowrap">
                  {o.createdAt
                    ? new Date(o.createdAt.toMillis()).toLocaleString()
                    : "Recente"}
                </td>
                <td className="p-4">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center w-max gap-1 ${o.type === "online" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {o.type === "online" ? (
                      <Smartphone size={12} />
                    ) : (
                      <Store size={12} />
                    )}
                    {o.type.toUpperCase()}
                  </span>
                </td>
                <td className="p-4 text-slate-600 min-w-[200px]">
                  <span className="font-bold">
                    {o.customerName ||
                      o.address?.recebedorNome ||
                      "Cliente Anônimo"}
                  </span>
                  {(o.customerPhone || o.address?.recebedorTelefone) && (
                    <span className="block text-xs text-slate-400">
                      {o.customerPhone || o.address?.recebedorTelefone}
                    </span>
                  )}
                </td>
                <td className="p-4 min-w-[220px] space-y-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex ${statusMeta.color}`}
                  >
                    {statusMeta.label}
                  </span>
                  {hasPendingCancellation && (
                    <div className="text-[11px] rounded-lg bg-rose-50 border border-rose-200 text-rose-700 p-2">
                      <p className="font-bold">Cancelamento solicitado</p>
                      <p className="mt-1">
                        {o?.cancellationRequest?.reason ||
                          "Sem motivo informado."}
                      </p>
                    </div>
                  )}
                  <select
                    value={status}
                    onChange={(e) => handleStatusChange(o, e.target.value)}
                    disabled={isSaving}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold bg-white"
                  >
                    {allowedStatuses.map((statusCode) => (
                      <option key={statusCode} value={statusCode}>
                        {statusCatalog[statusCode]?.label || statusCode}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-4 min-w-[230px]">
                  {o.type === "online" ? (
                    <div className="space-y-2">
                      <input
                        value={trackingValue}
                        onChange={(e) =>
                          setTrackingDrafts((prev) => ({
                            ...prev,
                            [o.id]: e.target.value,
                          }))
                        }
                        placeholder="Código de rastreio"
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                        disabled={isSaving}
                      />
                      <button
                        onClick={() => handleSaveTracking(o)}
                        disabled={isSaving}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold py-2 rounded-lg"
                      >
                        {isSaving ? "Salvando..." : "Salvar Rastreio"}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">
                      Não aplicável
                    </span>
                  )}
                </td>
                <td className="p-4 text-slate-500 whitespace-nowrap">
                  {o.paymentMethod || "N/A"}
                </td>
                <td className="p-4 font-bold text-indigo-600 text-right text-base whitespace-nowrap">
                  R$ {Number(o.total).toFixed(2)}
                </td>
                <td className="p-4 text-center min-w-[150px]">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {o.type === "online" ? (
                      <button
                        onClick={() => handleRefund(o)}
                        disabled={isSaving || status === "estornado"}
                        className="bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:bg-slate-100 disabled:text-slate-400 text-xs font-bold px-3 py-2 rounded-lg"
                      >
                        Estornar
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                    {hasPendingCancellation && (
                      <>
                        <button
                          onClick={() =>
                            handleReviewCancellationRequest(o, "approved")
                          }
                          disabled={isSaving}
                          className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:bg-slate-100 disabled:text-slate-400 text-xs font-bold px-3 py-2 rounded-lg"
                        >
                          Aprovar cancelamento
                        </button>
                        <button
                          onClick={() =>
                            handleReviewCancellationRequest(o, "rejected")
                          }
                          disabled={isSaving}
                          className="bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:bg-slate-100 disabled:text-slate-400 text-xs font-bold px-3 py-2 rounded-lg"
                        >
                          Recusar
                        </button>
                      </>
                    )}
                    {customerContactHref && (
                      <a
                        href={customerContactHref}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-sky-100 text-sky-700 hover:bg-sky-200 text-xs font-bold px-3 py-2 rounded-lg inline-flex items-center gap-1"
                      >
                        <MessageCircle size={13} /> Contato
                      </a>
                    )}
                    <button
                      onClick={() => setOrderToDelete(o.id)}
                      disabled={isSaving}
                      className="bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400 text-xs font-bold px-3 py-2 rounded-lg"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {filteredOrders.length === 0 && (
            <tr>
              <td colSpan="8" className="p-8 text-center text-slate-400">
                Nenhuma venda encontrada com os filtros aplicados.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <ConfirmModal
        isOpen={!!orderToDelete}
        title="Excluir Compra"
        message="Tem certeza que deseja excluir esta compra? Esta ação remove o pedido do banco de dados e não pode ser desfeita."
        onConfirm={executeDeleteOrder}
        onCancel={() => setOrderToDelete(null)}
        confirmText="Excluir Compra"
      />

      <ConfirmModal
        isOpen={!!orderToRefund}
        title="Confirmar Estorno"
        message="Deseja realmente estornar este pedido? O status será alterado para ESTORNADO e o estoque será ajustado automaticamente."
        onConfirm={executeRefundOrder}
        onCancel={() => setOrderToRefund(null)}
        confirmText="Estornar Pedido"
        confirmStyle="bg-rose-600 hover:bg-rose-700"
      />
    </div>
  );
}

// 2.X Aba Carrinhos Abandonados
function AbandonedCartsList({ carts, showToast }) {
  const [viewingCart, setViewingCart] = useState(null);
  const [cartToDelete, setCartToDelete] = useState(null);

  const executeDeleteCart = async () => {
    if (!cartToDelete) return;
    try {
      await deleteDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "abandoned_carts",
          cartToDelete,
        ),
      );
      showToast("Carrinho removido com sucesso!");
    } catch (error) {
      showToast("Erro ao remover carrinho.", "error");
    }
    setCartToDelete(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-800">Carrinhos Ativos</h2>
        <p className="text-sm text-slate-500 max-w-3xl">
          Abaixo estão os clientes que adicionaram produtos ao carrinho mas
          ainda não concluíram a compra. Os clientes registados aparecem com as
          informações de contacto, ideais para remarketing.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[800px]">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-4">Última Ação</th>
              <th className="p-4">Cliente / Contacto</th>
              <th className="p-4">Itens no Carrinho</th>
              <th className="p-4 text-right">Total a Recuperar</th>
              <th className="p-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {carts.map((cart) => {
              const whatsAppNumber =
                cart.customerPhone !== "N/A"
                  ? cart.customerPhone.replace(/\D/g, "")
                  : null;

              return (
                <tr
                  key={cart.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="p-4">
                    <span className="font-medium text-slate-700">
                      {cart.updatedAt
                        ? new Date(cart.updatedAt.toMillis()).toLocaleString()
                        : "Agora mesmo"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">
                        {cart.customerName !== "N/A"
                          ? cart.customerName
                          : "Visitante"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {cart.customerEmail}
                      </span>
                      {whatsAppNumber && (
                        <a
                          href={`https://wa.me/55${whatsAppNumber}?text=Olá! Vimos que deixou alguns itens no carrinho da nossa loja. Precisa de ajuda para finalizar a compra?`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 w-max px-2 py-1 rounded"
                        >
                          <MessageCircle size={14} /> Chamar no WhatsApp
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="max-w-[250px]">
                      <div className="text-slate-800 text-xs font-semibold mb-1">
                        {cart.items?.length || 0} Itens:
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {cart.items
                          ?.map(
                            (i) =>
                              `${i.qty}x ${i.name} ${i.selectedVariation ? `(${i.selectedVariation})` : ""}`,
                          )
                          .join(", ")}
                      </p>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-black text-indigo-600 text-base">
                      R$ {Number(cart.total).toFixed(2)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center items-center gap-2">
                      <button
                        onClick={() => setViewingCart(cart)}
                        className="text-indigo-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded transition-colors"
                        title="Ver Detalhes do Carrinho"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => setCartToDelete(cart.id)}
                        className="text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded transition-colors"
                        title="Excluir Carrinho"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {carts.length === 0 && (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-400">
                  Nenhum carrinho ativo no momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!cartToDelete}
        title="Excluir Carrinho Abandonado"
        message="Tem certeza que deseja excluir os registros deste carrinho ativo? Esta ação não pode ser desfeita."
        onConfirm={executeDeleteCart}
        onCancel={() => setCartToDelete(null)}
        confirmText="Excluir Carrinho"
      />

      {/* Modal para Visualizar Carrinho */}
      {viewingCart && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl animate-slide-up relative flex flex-col my-8">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-800">
                Detalhes do Carrinho
              </h3>
              <button
                onClick={() => setViewingCart(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-600" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
              {/* Informações do Cliente */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-700 mb-3 border-b border-slate-100 pb-2">
                  Informações do Cliente
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Nome</p>
                    <p className="font-semibold text-slate-800">
                      {viewingCart.customerName !== "N/A"
                        ? viewingCart.customerName
                        : "Visitante Anônimo"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">E-mail</p>
                    <p className="font-semibold text-slate-800">
                      {viewingCart.customerEmail}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Telefone</p>
                    <p className="font-semibold text-slate-800">
                      {viewingCart.customerPhone}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Última atualização</p>
                    <p className="font-semibold text-slate-800">
                      {viewingCart.updatedAt
                        ? new Date(
                            viewingCart.updatedAt.toMillis(),
                          ).toLocaleString()
                        : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Lista de Itens */}
              <div>
                <h4 className="font-bold text-slate-700 mb-3">
                  Produtos Adicionados ({viewingCart.items?.length})
                </h4>
                <div className="space-y-3">
                  {viewingCart.items?.map((item) => (
                    <div
                      key={item.cartItemId || item.id}
                      className="flex items-center gap-4 p-4 border border-slate-100 bg-slate-50 rounded-xl"
                    >
                      <div className="w-16 h-16 bg-white rounded-lg overflow-hidden shrink-0 border border-slate-100">
                        {item.images?.[0] || item.image ? (
                          <img
                            src={item.images?.[0] || item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-full h-full p-4 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-800 line-clamp-1">
                          {item.name}
                        </p>
                        {item.selectedVariation && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Opção escolhida:{" "}
                            <span className="font-semibold">
                              {item.selectedVariation}
                            </span>
                          </p>
                        )}
                        <p className="text-sm text-indigo-600 font-bold mt-1">
                          R$ {Number(item.price).toFixed(2)}
                        </p>
                      </div>
                      <div className="font-black text-slate-700 bg-slate-200 px-3 py-1.5 rounded-lg text-sm">
                        {item.qty}x
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 rounded-b-2xl flex justify-between items-center">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-sm">
                Valor Total no Carrinho:
              </span>
              <span className="text-2xl font-black text-indigo-600">
                R$ {Number(viewingCart.total).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminSettings({ showToast, storeSettings }) {
  const [config, setConfig] = useState({
    storeName: "",
    storeTagline: "",
    logo: "",
    banners: [],
    footerDescription: "",
    contactPhones: [],
    socialLinks: {
      whatsapp: "",
      instagram: "",
      facebook: "",
      youtube: "",
      tiktok: "",
    },
    mpPublicKey: DEFAULT_MP_PUBLIC_KEY,
    pixKey: "",
    catalog: DEFAULT_PRODUCT_CATALOG,
    shipping: {
      pickupEnabled: true,
      correiosBaseRate: 25.0,
      localCities: [],
    },
  });
  const [isUploading, setIsUploading] = useState(false);
  const [newCity, setNewCity] = useState({ name: "", state: "", rate: "" });
  const [newCategory, setNewCategory] = useState({
    name: "",
    subcategories: "",
    subsubcategories: "",
    featured: false,
  });
  const [newSectionName, setNewSectionName] = useState("");
  const [editingSectionId, setEditingSectionId] = useState("");
  const [editSectionDraft, setEditSectionDraft] = useState({
    id: "",
    name: "",
  });
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editCategoryDraft, setEditCategoryDraft] = useState({
    name: "",
    subcategories: "",
    subsubcategories: "",
    featured: false,
  });
  const [newVariationType, setNewVariationType] = useState({
    name: "",
    options: "",
  });
  const [editingVariationTypeName, setEditingVariationTypeName] = useState("");
  const [editVariationTypeDraft, setEditVariationTypeDraft] = useState({
    name: "",
    options: "",
  });
  const [contactPhonesDraft, setContactPhonesDraft] = useState("");
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const lastPersistedConfigRef = useRef("");

  const buildSettingsPayload = useCallback(
    (sourceConfig) => ({
      ...sourceConfig,
      mpPublicKey: String(
        sourceConfig.mpPublicKey || DEFAULT_MP_PUBLIC_KEY,
      ).trim(),
      pixKey: String(sourceConfig.pixKey || "").trim(),
      contactPhones: normalizePhoneList(sourceConfig.contactPhones),
      socialLinks: normalizeSocialLinks(sourceConfig.socialLinks),
      catalog: normalizeCatalog(sourceConfig.catalog),
    }),
    [],
  );

  const persistSettings = useCallback(
    async (sourceConfig, options = {}) => {
      const { withToast = false } = options;
      const payload = buildSettingsPayload(sourceConfig);
      await setDoc(
        doc(db, "artifacts", appId, "public", "data", "settings", "config"),
        payload,
        { merge: true },
      );
      lastPersistedConfigRef.current = JSON.stringify(payload);
      if (withToast) {
        showToast("Configurações salvas e aplicadas na loja!");
      }
    },
    [buildSettingsPayload, showToast],
  );

  // Carrega as configurações globais para o formulário local
  useEffect(() => {
    if (storeSettings) {
      setConfig((prev) => {
        const hydratedConfig = {
          ...prev,
          ...storeSettings,
          mpPublicKey: String(
            storeSettings.mpPublicKey || DEFAULT_MP_PUBLIC_KEY,
          ).trim(),
          catalog: normalizeCatalog(storeSettings.catalog),
          socialLinks: normalizeSocialLinks(storeSettings.socialLinks),
          contactPhones: normalizePhoneList(storeSettings.contactPhones),
          shipping: storeSettings.shipping || {
            pickupEnabled: true,
            correiosBaseRate: 25.0,
            localCities: [],
          },
        };

        lastPersistedConfigRef.current = JSON.stringify(
          buildSettingsPayload(hydratedConfig),
        );

        return hydratedConfig;
      });
      setContactPhonesDraft(
        normalizePhoneList(storeSettings.contactPhones).join("\n"),
      );
    }
  }, [buildSettingsPayload, storeSettings]);

  useEffect(() => {
    if (!storeSettings) return;

    const payload = buildSettingsPayload(config);
    const serializedPayload = JSON.stringify(payload);
    if (serializedPayload === lastPersistedConfigRef.current) return;

    const timeoutId = setTimeout(async () => {
      try {
        setIsAutoSaving(true);
        await setDoc(
          doc(db, "artifacts", appId, "public", "data", "settings", "config"),
          payload,
          { merge: true },
        );
        lastPersistedConfigRef.current = serializedPayload;
      } catch (error) {
        console.error(error);
        showToast("Erro ao salvar automaticamente", "error");
      } finally {
        setIsAutoSaving(false);
      }
    }, 700);

    return () => clearTimeout(timeoutId);
  }, [buildSettingsPayload, config, showToast, storeSettings]);

  // Redimensionador de Imagens (evita limite de 1MB do Firestore)
  const processImage = (file, maxWidth, quality = 0.8) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width,
            height = img.height;
          if (width > maxWidth) {
            height = height * (maxWidth / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const base64 = await processImage(file, 400);
    setConfig({ ...config, logo: base64 });
    setIsUploading(false);
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const base64 = await processImage(file, 1200, 0.7); // Banners mais comprimidos
    setConfig({ ...config, banners: [...(config.banners || []), base64] });
    setIsUploading(false);
  };

  const removeBanner = (index) => {
    const newBanners = [...config.banners];
    newBanners.splice(index, 1);
    setConfig({ ...config, banners: newBanners });
  };

  // Funções de Frete
  const handleAddCity = () => {
    if (!newCity.name || !newCity.state || !newCity.rate) {
      return showToast("Preencha todos os campos da cidade", "error");
    }
    const updatedCities = [
      ...(config.shipping.localCities || []),
      { ...newCity, state: newCity.state.toUpperCase() },
    ];
    setConfig({
      ...config,
      shipping: { ...config.shipping, localCities: updatedCities },
    });
    setNewCity({ name: "", state: "", rate: "" });
  };

  const handleRemoveCity = (index) => {
    const updatedCities = [...config.shipping.localCities];
    updatedCities.splice(index, 1);
    setConfig({
      ...config,
      shipping: { ...config.shipping, localCities: updatedCities },
    });
  };

  const handleAddCategory = () => {
    const name = String(newCategory.name || "").trim();
    if (!name) {
      return showToast("Informe o nome da categoria", "error");
    }

    const subcategories = normalizeTextList(newCategory.subcategories);
    const subsubcategories = normalizeTextList(newCategory.subsubcategories);
    const alreadyExists = (config.catalog?.categories || []).some(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );

    if (alreadyExists) {
      return showToast("Categoria já existe", "error");
    }

    setConfig((prev) => ({
      ...prev,
      catalog: {
        ...normalizeCatalog(prev.catalog),
        categories: [
          ...(prev.catalog?.categories || []),
          {
            name,
            subcategories,
            subsubcategories,
            featured: Boolean(newCategory.featured),
          },
        ],
      },
    }));
    setNewCategory({
      name: "",
      subcategories: "",
      subsubcategories: "",
      featured: false,
    });
  };

  const handleAddSection = () => {
    const name = String(newSectionName || "").trim();
    if (!name) {
      return showToast("Informe o nome da sessão", "error");
    }

    const alreadyExists = (config.catalog?.sections || []).some(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );

    if (alreadyExists) {
      return showToast("Sessão já existe", "error");
    }

    setConfig((prev) => ({
      ...prev,
      catalog: {
        ...normalizeCatalog(prev.catalog),
        sections: [
          ...(normalizeCatalog(prev.catalog).sections || []),
          { id: createCatalogSectionId(), name },
        ],
      },
    }));
    setNewSectionName("");
  };

  const handleRemoveSection = (sectionId) => {
    setConfig((prev) => ({
      ...prev,
      catalog: {
        ...normalizeCatalog(prev.catalog),
        sections: (normalizeCatalog(prev.catalog).sections || []).filter(
          (item) => item.id !== sectionId,
        ),
      },
    }));

    if (editingSectionId === sectionId) {
      setEditingSectionId("");
      setEditSectionDraft({ id: "", name: "" });
    }
  };

  const handleStartEditSection = (section) => {
    setEditingSectionId(section.id);
    setEditSectionDraft({ id: section.id, name: section.name });
  };

  const handleCancelEditSection = () => {
    setEditingSectionId("");
    setEditSectionDraft({ id: "", name: "" });
  };

  const handleSaveSectionEdit = () => {
    const nextName = String(editSectionDraft.name || "").trim();
    if (!nextName) {
      return showToast("Nome da sessão é obrigatório", "error");
    }

    const hasDuplicatedName = (config.catalog?.sections || []).some(
      (item) =>
        item.name.toLowerCase() === nextName.toLowerCase() &&
        item.id !== editingSectionId,
    );

    if (hasDuplicatedName) {
      return showToast("Já existe outra sessão com esse nome", "error");
    }

    setConfig((prev) => ({
      ...prev,
      catalog: {
        ...normalizeCatalog(prev.catalog),
        sections: (normalizeCatalog(prev.catalog).sections || []).map((item) =>
          item.id === editingSectionId ? { ...item, name: nextName } : item,
        ),
      },
    }));

    handleCancelEditSection();
    showToast("Sessão atualizada!");
  };

  const handleMoveSection = (sectionId, direction) => {
    setConfig((prev) => {
      const currentSections = [
        ...(normalizeCatalog(prev.catalog).sections || []),
      ];
      const currentIndex = currentSections.findIndex(
        (item) => item.id === sectionId,
      );

      if (currentIndex === -1) return prev;

      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= currentSections.length) {
        return prev;
      }

      [currentSections[currentIndex], currentSections[targetIndex]] = [
        currentSections[targetIndex],
        currentSections[currentIndex],
      ];

      return {
        ...prev,
        catalog: {
          ...normalizeCatalog(prev.catalog),
          sections: currentSections,
        },
      };
    });
  };

  const handleRemoveCategory = (name) => {
    setConfig((prev) => ({
      ...prev,
      catalog: {
        ...normalizeCatalog(prev.catalog),
        categories: (prev.catalog?.categories || []).filter(
          (item) => item.name !== name,
        ),
      },
    }));
  };

  const handleStartEditCategory = (category) => {
    setEditingCategoryName(category.name);
    setEditCategoryDraft({
      name: category.name,
      subcategories: (category.subcategories || []).join(", "),
      subsubcategories: (category.subsubcategories || []).join(", "),
      featured: Boolean(category.featured),
    });
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryName("");
    setEditCategoryDraft({
      name: "",
      subcategories: "",
      subsubcategories: "",
      featured: false,
    });
  };

  const handleSaveCategoryEdit = () => {
    const nextName = String(editCategoryDraft.name || "").trim();
    if (!nextName) {
      return showToast("Nome da categoria é obrigatório", "error");
    }

    const hasDuplicatedName = (config.catalog?.categories || []).some(
      (item) =>
        item.name.toLowerCase() === nextName.toLowerCase() &&
        item.name !== editingCategoryName,
    );

    if (hasDuplicatedName) {
      return showToast("Já existe outra categoria com esse nome", "error");
    }

    setConfig((prev) => ({
      ...prev,
      catalog: {
        ...normalizeCatalog(prev.catalog),
        categories: (prev.catalog?.categories || []).map((item) =>
          item.name === editingCategoryName
            ? {
                name: nextName,
                subcategories: normalizeTextList(
                  editCategoryDraft.subcategories,
                ),
                subsubcategories: normalizeTextList(
                  editCategoryDraft.subsubcategories,
                ),
                featured: Boolean(editCategoryDraft.featured),
              }
            : item,
        ),
      },
    }));

    handleCancelEditCategory();
    showToast("Categoria atualizada!");
  };

  const handleAddVariationType = () => {
    const name = String(newVariationType.name || "").trim();
    if (!name) {
      return showToast("Informe o tipo de variação", "error");
    }

    const options = normalizeTextList(newVariationType.options);
    const alreadyExists = (config.catalog?.variationTypes || []).some(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );

    if (alreadyExists) {
      return showToast("Tipo de variação já existe", "error");
    }

    setConfig((prev) => ({
      ...prev,
      catalog: {
        ...normalizeCatalog(prev.catalog),
        variationTypes: [
          ...(prev.catalog?.variationTypes || []),
          { name, options },
        ],
      },
    }));
    setNewVariationType({ name: "", options: "" });
  };

  const handleRemoveVariationType = (name) => {
    setConfig((prev) => ({
      ...prev,
      catalog: {
        ...normalizeCatalog(prev.catalog),
        variationTypes: (prev.catalog?.variationTypes || []).filter(
          (item) => item.name !== name,
        ),
      },
    }));
  };

  const handleStartEditVariationType = (variationType) => {
    setEditingVariationTypeName(variationType.name);
    setEditVariationTypeDraft({
      name: variationType.name,
      options: (variationType.options || []).join(", "),
    });
  };

  const handleCancelEditVariationType = () => {
    setEditingVariationTypeName("");
    setEditVariationTypeDraft({ name: "", options: "" });
  };

  const handleSaveVariationTypeEdit = () => {
    const nextName = String(editVariationTypeDraft.name || "").trim();
    if (!nextName) {
      return showToast("Nome do tipo de variação é obrigatório", "error");
    }

    const hasDuplicatedName = (config.catalog?.variationTypes || []).some(
      (item) =>
        item.name.toLowerCase() === nextName.toLowerCase() &&
        item.name !== editingVariationTypeName,
    );

    if (hasDuplicatedName) {
      return showToast("Já existe outro tipo com esse nome", "error");
    }

    setConfig((prev) => ({
      ...prev,
      catalog: {
        ...normalizeCatalog(prev.catalog),
        variationTypes: (prev.catalog?.variationTypes || []).map((item) =>
          item.name === editingVariationTypeName
            ? {
                name: nextName,
                options: normalizeTextList(editVariationTypeDraft.options),
              }
            : item,
        ),
      },
    }));

    handleCancelEditVariationType();
    showToast("Tipo de variação atualizado!");
  };

  const saveSettings = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    try {
      await persistSettings(config, { withToast: true });
    } catch (error) {
      console.error(error);
      showToast("Erro ao salvar", "error");
    }
  };

  return (
    <div className="max-w-4xl bg-white rounded-2xl shadow-sm border p-6 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
          <Settings /> Configurações Gerais
        </h2>
        <button
          onClick={saveSettings}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition shadow-sm w-full sm:w-auto"
        >
          {isAutoSaving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

      {/* Identidade Visual */}
      <div className="space-y-6">
        <h3 className="font-semibold text-lg border-b pb-2 text-slate-700">
          Identidade da Loja
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                Nome da Loja
              </label>
              <input
                type="text"
                value={config.storeName || ""}
                onChange={(e) =>
                  setConfig({ ...config, storeName: e.target.value })
                }
                placeholder="Ex: Minha Loja Fantástica"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                Subtítulo da Loja (opcional)
              </label>
              <input
                type="text"
                value={config.storeTagline || ""}
                onChange={(e) =>
                  setConfig({ ...config, storeTagline: e.target.value })
                }
                placeholder="Ex: Moda, ofertas e envio para todo Brasil"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Deixe vazio para não exibir nenhuma frase abaixo do nome.
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                Logomarca
              </label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 border-2 border-dashed rounded-xl flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                  {config.logo ? (
                    <img
                      src={config.logo}
                      className="w-full h-full object-contain"
                      alt="Logo"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">Sem Logo</span>
                  )}
                </div>
                <label className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg cursor-pointer text-sm font-medium transition text-center">
                  {isUploading ? "Processando..." : "Alterar Logo"}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-slate-700">
              Banners Rotativos (Carrossel)
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Estes banners aparecerão no topo da sua loja virtual. Arraste para
              os lados (no telemóvel) para vê-los.
            </p>

            <div className="space-y-3">
              {(config.banners || []).map((banner, idx) => (
                <div
                  key={idx}
                  className="relative group rounded-lg overflow-hidden border bg-slate-100 h-24 sm:h-32"
                >
                  <img
                    src={normalizeExternalImageUrl(banner)}
                    className="w-full h-full object-cover"
                    alt={`Banner ${idx}`}
                  />
                  <button
                    onClick={() => removeBanner(idx)}
                    className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition shadow-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl cursor-pointer bg-slate-50 transition text-slate-500 hover:text-indigo-500">
                <Plus size={24} className="mb-1" />
                <span className="text-sm font-medium">Adicionar Banner</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  disabled={isUploading}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Catálogo de Produtos */}
      <div className="space-y-6">
        <h3 className="font-semibold text-lg border-b pb-2 text-slate-700">
          Catálogo de Produtos
        </h3>

        <div className="space-y-4">
          <h4 className="text-sm font-black uppercase tracking-wider text-slate-600">
            Sessões do Mostruário
          </h4>
          <p className="text-sm text-slate-500">
            Crie sessões para aparecer no início da loja. Elas só serão exibidas
            se houver produtos vinculados a elas.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <input
              placeholder="Ex: Novidades da Semana"
              className="p-2.5 border rounded-lg text-sm outline-none"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
            />
            <button
              onClick={handleAddSection}
              className="bg-slate-900 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-lg"
            >
              Adicionar Sessão
            </button>
          </div>

          <div className="overflow-auto border border-slate-200 rounded-xl bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left p-3 w-20">Ordem</th>
                  <th className="text-left p-3">Sessão</th>
                  <th className="text-right p-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(config.catalog?.sections || []).length === 0 ? (
                  <tr>
                    <td colSpan="3" className="p-4 text-sm text-slate-500">
                      Nenhuma sessão cadastrada ainda.
                    </td>
                  </tr>
                ) : (
                  (config.catalog?.sections || []).map(
                    (section, index, all) => (
                      <tr key={section.id}>
                        <td className="p-3 text-slate-500 font-bold">
                          #{index + 1}
                        </td>
                        <td className="p-3 font-semibold text-slate-700">
                          {editingSectionId === section.id ? (
                            <input
                              value={editSectionDraft.name}
                              onChange={(e) =>
                                setEditSectionDraft((prev) => ({
                                  ...prev,
                                  name: e.target.value,
                                }))
                              }
                              className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none"
                            />
                          ) : (
                            section.name
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-2">
                            {editingSectionId === section.id ? (
                              <>
                                <button
                                  onClick={handleSaveSectionEdit}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                                >
                                  Salvar
                                </button>
                                <button
                                  onClick={handleCancelEditSection}
                                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() =>
                                    handleMoveSection(section.id, -1)
                                  }
                                  disabled={index === 0}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-black"
                                  title="Mover para cima"
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() =>
                                    handleMoveSection(section.id, 1)
                                  }
                                  disabled={index === all.length - 1}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-black"
                                  title="Mover para baixo"
                                >
                                  ↓
                                </button>
                                <button
                                  onClick={() =>
                                    handleStartEditSection(section)
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() =>
                                    handleRemoveSection(section.id)
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold"
                                >
                                  Remover
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-600">
              Tabela de Categorias, Subcategorias e Segmentos
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <input
                placeholder="Categoria"
                className="p-2.5 border rounded-lg text-sm outline-none"
                value={newCategory.name}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, name: e.target.value })
                }
              />
              <input
                placeholder="Subcategorias (virgula)"
                className="sm:col-span-2 p-2.5 border rounded-lg text-sm outline-none"
                value={newCategory.subcategories}
                onChange={(e) =>
                  setNewCategory({
                    ...newCategory,
                    subcategories: e.target.value,
                  })
                }
              />
              <input
                placeholder="Segmentos / 3o nivel (virgula) - ex: Torcedor, Jogador"
                className="sm:col-span-3 p-2.5 border rounded-lg text-sm outline-none"
                value={newCategory.subsubcategories}
                onChange={(e) =>
                  setNewCategory({
                    ...newCategory,
                    subsubcategories: e.target.value,
                  })
                }
              />
              <label className="sm:col-span-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={newCategory.featured}
                  onChange={(e) =>
                    setNewCategory({
                      ...newCategory,
                      featured: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                />
                Exibir como categoria destaque na loja
              </label>
              <button
                onClick={handleAddCategory}
                className="sm:col-span-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg"
              >
                Adicionar Categoria
              </button>
            </div>

            <div className="overflow-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="text-left p-3">Categoria</th>
                    <th className="text-left p-3">Subcategorias</th>
                    <th className="text-left p-3">Segmentos</th>
                    <th className="text-left p-3">Destaque</th>
                    <th className="text-right p-3">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(config.catalog?.categories || []).map((category) => (
                    <tr key={category.name}>
                      <td className="p-3 font-semibold text-slate-700">
                        {editingCategoryName === category.name ? (
                          <input
                            value={editCategoryDraft.name}
                            onChange={(e) =>
                              setEditCategoryDraft((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none"
                          />
                        ) : (
                          category.name
                        )}
                      </td>
                      <td className="p-3 text-slate-600">
                        {editingCategoryName === category.name ? (
                          <input
                            value={editCategoryDraft.subcategories}
                            onChange={(e) =>
                              setEditCategoryDraft((prev) => ({
                                ...prev,
                                subcategories: e.target.value,
                              }))
                            }
                            placeholder="Subcategorias separadas por vírgula"
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none"
                          />
                        ) : (
                          category.subcategories?.join(", ") || "-"
                        )}
                      </td>
                      <td className="p-3 text-slate-600">
                        {editingCategoryName === category.name ? (
                          <input
                            value={editCategoryDraft.subsubcategories}
                            onChange={(e) =>
                              setEditCategoryDraft((prev) => ({
                                ...prev,
                                subsubcategories: e.target.value,
                              }))
                            }
                            placeholder="Segmentos separados por virgula"
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none"
                          />
                        ) : (
                          category.subsubcategories?.join(", ") || "-"
                        )}
                      </td>
                      <td className="p-3 text-slate-600">
                        {editingCategoryName === category.name ? (
                          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={editCategoryDraft.featured}
                              onChange={(e) =>
                                setEditCategoryDraft((prev) => ({
                                  ...prev,
                                  featured: e.target.checked,
                                }))
                              }
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                            />
                            Destaque
                          </label>
                        ) : category.featured ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                            Sim
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
                            Não
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          {editingCategoryName === category.name ? (
                            <>
                              <button
                                onClick={handleSaveCategoryEdit}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={handleCancelEditCategory}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() =>
                                  handleStartEditCategory(category)
                                }
                                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() =>
                                  handleRemoveCategory(category.name)
                                }
                                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold"
                              >
                                Remover
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-600">
              Tipos de Variação (Tamanho, Cor, etc.)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <input
                placeholder="Tipo (ex: Tamanho)"
                className="p-2.5 border rounded-lg text-sm outline-none"
                value={newVariationType.name}
                onChange={(e) =>
                  setNewVariationType({
                    ...newVariationType,
                    name: e.target.value,
                  })
                }
              />
              <input
                placeholder="Opções (P, M, G...)"
                className="sm:col-span-2 p-2.5 border rounded-lg text-sm outline-none"
                value={newVariationType.options}
                onChange={(e) =>
                  setNewVariationType({
                    ...newVariationType,
                    options: e.target.value,
                  })
                }
              />
              <button
                onClick={handleAddVariationType}
                className="sm:col-span-3 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 rounded-lg"
              >
                Adicionar Tipo de Variação
              </button>
            </div>

            <div className="overflow-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-left p-3">Opções</th>
                    <th className="text-right p-3">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(config.catalog?.variationTypes || []).map((item) => (
                    <tr key={item.name}>
                      <td className="p-3 font-semibold text-slate-700">
                        {editingVariationTypeName === item.name ? (
                          <input
                            value={editVariationTypeDraft.name}
                            onChange={(e) =>
                              setEditVariationTypeDraft((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none"
                          />
                        ) : (
                          item.name
                        )}
                      </td>
                      <td className="p-3 text-slate-600">
                        {editingVariationTypeName === item.name ? (
                          <input
                            value={editVariationTypeDraft.options}
                            onChange={(e) =>
                              setEditVariationTypeDraft((prev) => ({
                                ...prev,
                                options: e.target.value,
                              }))
                            }
                            placeholder="Opções separadas por vírgula"
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none"
                          />
                        ) : (
                          item.options?.join(", ") || "-"
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          {editingVariationTypeName === item.name ? (
                            <>
                              <button
                                onClick={handleSaveVariationTypeEdit}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={handleCancelEditVariationType}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() =>
                                  handleStartEditVariationType(item)
                                }
                                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() =>
                                  handleRemoveVariationType(item.name)
                                }
                                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold"
                              >
                                Remover
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="font-semibold text-lg border-b pb-2 text-slate-700">
          Rodapé e Canais de Atendimento
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                Descrição do Rodapé
              </label>
              <textarea
                rows={4}
                value={config.footerDescription || ""}
                onChange={(e) =>
                  setConfig({ ...config, footerDescription: e.target.value })
                }
                placeholder="Escreva uma mensagem institucional curta da sua loja."
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                Telefones de Contato (um por linha)
              </label>
              <textarea
                rows={5}
                value={contactPhonesDraft}
                onChange={(e) => {
                  const draft = e.target.value;
                  setContactPhonesDraft(draft);
                  setConfig((prev) => ({
                    ...prev,
                    contactPhones: normalizePhoneList(draft),
                  }));
                }}
                onBlur={(e) => {
                  const normalizedPhones = normalizePhoneList(e.target.value)
                    .map((phone) => formatContactPhone(phone))
                    .join("\n");
                  setContactPhonesDraft(normalizedPhones);
                  setConfig((prev) => ({
                    ...prev,
                    contactPhones: normalizePhoneList(normalizedPhones),
                  }));
                }}
                placeholder="(11) 99999-9999\n(11) 3333-3333"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Esses telefones aparecerão no rodapé da loja.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                WhatsApp (somente número ou link)
              </label>
              <input
                type="text"
                value={config.socialLinks?.whatsapp || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    socialLinks: {
                      ...normalizeSocialLinks(config.socialLinks),
                      whatsapp: e.target.value,
                    },
                  })
                }
                placeholder="11999999999"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Usado no botão flutuante de WhatsApp da loja.
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                Instagram (usuário ou link)
              </label>
              <input
                type="text"
                value={config.socialLinks?.instagram || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    socialLinks: {
                      ...normalizeSocialLinks(config.socialLinks),
                      instagram: e.target.value,
                    },
                  })
                }
                placeholder="@minhaloja"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                Facebook (usuário/página ou link)
              </label>
              <input
                type="text"
                value={config.socialLinks?.facebook || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    socialLinks: {
                      ...normalizeSocialLinks(config.socialLinks),
                      facebook: e.target.value,
                    },
                  })
                }
                placeholder="minhaloja"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                YouTube (canal ou link)
              </label>
              <input
                type="text"
                value={config.socialLinks?.youtube || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    socialLinks: {
                      ...normalizeSocialLinks(config.socialLinks),
                      youtube: e.target.value,
                    },
                  })
                }
                placeholder="@canaldaloja"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                TikTok (usuário ou link)
              </label>
              <input
                type="text"
                value={config.socialLinks?.tiktok || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    socialLinks: {
                      ...normalizeSocialLinks(config.socialLinks),
                      tiktok: e.target.value,
                    },
                  })
                }
                placeholder="@minhaloja"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Configurações de Frete */}
      <div className="space-y-6">
        <h3 className="font-semibold text-lg border-b pb-2 text-slate-700 flex items-center gap-2">
          <Truck size={20} /> Fretes e Entregas
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-5">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                  checked={config.shipping.pickupEnabled !== false} // default true se undefined
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      shipping: {
                        ...config.shipping,
                        pickupEnabled: e.target.checked,
                      },
                    })
                  }
                />
                <span className="font-semibold text-slate-700">
                  Permitir "Retirada na Loja" (Grátis)
                </span>
              </label>
              <p className="text-xs text-slate-500 mt-2 ml-8">
                Ative esta opção para permitir que o cliente compre online e
                retire o pedido presencialmente sem custo.
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                Taxa Base - Envio Correios (R$)
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Valor aplicado simulando frete (PAC/Sedex) para todas as cidades
                não configuradas na lista de Motoboy.
              </p>
              <input
                type="number"
                step="0.01"
                value={config.shipping.correiosBaseRate || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    shipping: {
                      ...config.shipping,
                      correiosBaseRate: e.target.value,
                    },
                  })
                }
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2 text-slate-700">
              Entregas Locais (Motoboy / Uber)
            </label>
            <p className="text-xs text-slate-500 mb-4">
              Adicione as cidades da sua região onde você fará entrega por
              Motoboy com valor fixo configurado.
            </p>

            <div className="flex gap-2 mb-4 bg-slate-50 p-3 rounded-lg border">
              <input
                placeholder="Cidade"
                className="w-1/3 p-2 border rounded text-sm outline-none"
                value={newCity.name}
                onChange={(e) =>
                  setNewCity({ ...newCity, name: e.target.value })
                }
              />
              <input
                placeholder="UF (ex: SP)"
                maxLength={2}
                className="w-16 p-2 border rounded text-sm outline-none uppercase"
                value={newCity.state}
                onChange={(e) =>
                  setNewCity({ ...newCity, state: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="R$ Taxa"
                className="w-24 p-2 border rounded text-sm outline-none"
                value={newCity.rate}
                onChange={(e) =>
                  setNewCity({ ...newCity, rate: e.target.value })
                }
              />
              <button
                onClick={handleAddCity}
                className="bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 transition"
              >
                <Plus size={18} />
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(config.shipping.localCities || []).length === 0 ? (
                <div className="text-sm text-slate-400 text-center py-4">
                  Nenhuma cidade configurada.
                </div>
              ) : (
                config.shipping.localCities.map((city, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center bg-white p-3 border rounded-lg shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <MapIcon size={16} className="text-slate-400" />
                      <span className="font-semibold text-sm">
                        {city.name} - {city.state}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-indigo-600 text-sm">
                        R$ {Number(city.rate).toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleRemoveCity(idx)}
                        className="text-rose-500 hover:bg-rose-50 p-1.5 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Integrações */}
      <div className="space-y-6">
        <h3 className="font-semibold text-lg border-b pb-2 text-slate-700">
          Integração de Pagamentos
        </h3>
        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-200 text-sm leading-relaxed">
          <strong>Segurança em primeiro lugar!</strong> <br />
          <br />A sua <strong>Public Key</strong> pode ficar salva aqui na loja
          para gerar os componentes de pagamento do Mercado Pago. <br />
          <br />
          Se preferir, defina a chave pública por ambiente com
          <strong> VITE_MERCADO_PAGO_PUBLIC_KEY</strong> no frontend de
          produção. <br />
          <br />O seu <strong>Access Token</strong> NÃO DEVE ser configurado ou
          salvo aqui no frontend. Ele deve ser colocado de forma exclusiva no
          ficheiro <code className="bg-blue-100 px-1 rounded">.env</code> do seu
          Servidor/Backend!
        </div>
        <div>
          <label className="block text-sm font-bold mb-2 text-slate-700">
            Public Key (Mercado Pago Frontend)
          </label>
          <input
            type="text"
            value={config.mpPublicKey || ""}
            onChange={(e) =>
              setConfig({ ...config, mpPublicKey: e.target.value })
            }
            placeholder="APP_USR-xxxxxxxx-xxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
          />
          <p className="text-xs text-slate-500 mt-2">
            Opcional: se essa chave não for salva aqui, o app usa o valor de
            VITE_MERCADO_PAGO_PUBLIC_KEY quando existir no ambiente.
          </p>
        </div>

        <div>
          <label className="block text-sm font-bold mb-2 text-slate-700">
            Chave PIX (PDV)
          </label>
          <input
            type="text"
            value={config.pixKey || ""}
            onChange={(e) => setConfig({ ...config, pixKey: e.target.value })}
            placeholder="Ex: email, telefone, CPF/CNPJ ou chave aleatória"
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-mono text-sm"
          />
          <p className="text-xs text-slate-500 mt-2">
            Essa chave será usada no PDV para gerar QR Code PIX direto no caixa,
            sem precisar da Public Key para esse fluxo.
          </p>
        </div>
      </div>
    </div>
  );
}
