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
  XCircle,
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
  Copy,
  Eye,
  UserPlus,
  FileText,
  AlertTriangle,
  Upload,
  Download,
  ZoomIn,
  Maximize2,
  Share2,
  Star,
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
  GoogleAuthProvider,
  signInWithPopup,
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
  getDocs,
  runTransaction,
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

const ORDER_NUMBER_START = 200;
const ORDER_COUNTER_BASE = ORDER_NUMBER_START - 1;

const getOrderNumberValue = (order) => {
  const parsed = Number(order?.orderNumber);
  if (!Number.isInteger(parsed) || parsed < ORDER_NUMBER_START) return null;
  return parsed;
};

const formatOrderDisplayId = (order) => {
  const orderNumber = getOrderNumberValue(order);
  if (orderNumber !== null) {
    return `#${orderNumber}`;
  }

  const fallback = String(order?.id || "")
    .trim()
    .slice(0, 8)
    .toUpperCase();

  return fallback ? `#${fallback}` : "#-";
};

const PAYMENT_PENDING_STORAGE_KEY = "jn_pending_payment_v1";
const ACCOUNT_AUTO_OPEN_KEY = "jn_open_account_after_reload_v1";

const savePendingPaymentContext = (payload) => {
  try {
    localStorage.setItem(PAYMENT_PENDING_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // no-op: storage indisponivel no contexto atual
  }
};

const readPendingPaymentContext = () => {
  try {
    const raw = localStorage.getItem(PAYMENT_PENDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const clearPendingPaymentContext = () => {
  try {
    localStorage.removeItem(PAYMENT_PENDING_STORAGE_KEY);
  } catch {
    // no-op: storage indisponivel no contexto atual
  }
};

const markOpenAccountAfterReload = () => {
  try {
    localStorage.setItem(ACCOUNT_AUTO_OPEN_KEY, "1");
  } catch {
    // no-op: storage indisponivel no contexto atual
  }
};

const consumeOpenAccountAfterReload = () => {
  try {
    const value = localStorage.getItem(ACCOUNT_AUTO_OPEN_KEY);
    if (value) {
      localStorage.removeItem(ACCOUNT_AUTO_OPEN_KEY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

const parsePaymentReturnParams = () => {
  if (typeof window === "undefined") {
    return { paymentId: "", externalReference: "", rawStatus: "" };
  }

  const search = new URLSearchParams(window.location.search || "");
  const hash = String(window.location.hash || "");
  const hashQuery = hash.includes("?") ? hash.split("?")[1] : "";
  const hashParams = new URLSearchParams(hashQuery);

  const pick = (key) => search.get(key) || hashParams.get(key) || "";

  return {
    paymentId: pick("payment_id") || pick("collection_id"),
    externalReference: pick("external_reference") || pick("externalReference"),
    rawStatus: pick("status") || pick("collection_status"),
  };
};

const clearPaymentReturnParamsFromUrl = () => {
  if (typeof window === "undefined") return;

  const { pathname, hash } = window.location;
  const cleanHash = hash.includes("?") ? hash.split("?")[0] : hash;
  const target = `${pathname}${cleanHash}`;
  window.history.replaceState({}, document.title, target);
};

const ADMIN_ALLOWED_EMAILS = String(import.meta.env.VITE_ADMIN_EMAILS || "")
  .split(/[;,\n]/)
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

const isAllowedAdminEmail = (email) =>
  ADMIN_ALLOWED_EMAILS.includes(
    String(email || "")
      .trim()
      .toLowerCase(),
  );

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
const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: "select_account" });

const splitFullName = (value) => {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

const getFriendlyAuthErrorMessage = (error) => {
  if (error?.code === "auth/email-already-in-use") {
    return "Este e-mail já está em uso.";
  }

  if (error?.code === "auth/invalid-credential") {
    return "E-mail ou senha incorretos.";
  }

  if (error?.code === "auth/popup-closed-by-user") {
    return "O login com Google foi cancelado antes da conclusão.";
  }

  if (error?.code === "auth/popup-blocked") {
    return "O navegador bloqueou a janela do Google. Libere pop-ups e tente novamente.";
  }

  if (error?.code === "auth/account-exists-with-different-credential") {
    return "Já existe uma conta com este e-mail usando outro método de acesso.";
  }

  if (error?.code === "auth/operation-not-allowed") {
    return "O provedor correspondente não está habilitado no Firebase. Ative E-mail/Senha ou Google no painel.";
  }

  return error?.message || "Não foi possível concluir a autenticação.";
};

const syncCustomerIdentity = async (firebaseUser, profileOverrides = {}) => {
  if (!firebaseUser?.uid) return;

  const profileRef = doc(
    db,
    "artifacts",
    appId,
    "users",
    firebaseUser.uid,
    "profile",
    "info",
  );
  const customerRef = doc(
    db,
    "artifacts",
    appId,
    "public",
    "data",
    "customers",
    firebaseUser.uid,
  );

  const [profileSnap, customerSnap] = await Promise.all([
    getDoc(profileRef),
    getDoc(customerRef),
  ]);

  const existingProfile = profileSnap.exists() ? profileSnap.data() : {};
  const existingCustomer = customerSnap.exists() ? customerSnap.data() : {};
  const displayNameParts = splitFullName(firebaseUser.displayName);

  const firstName =
    String(profileOverrides.firstName || "").trim() ||
    String(existingProfile.firstName || "").trim() ||
    displayNameParts.firstName;
  const lastName =
    String(profileOverrides.lastName || "").trim() ||
    String(existingProfile.lastName || "").trim() ||
    displayNameParts.lastName;
  const phone =
    maskPhone(String(profileOverrides.phone || existingProfile.phone || "")) ||
    "";
  const cpf = String(profileOverrides.cpf || existingProfile.cpf || "").trim();
  const email =
    String(profileOverrides.email || "").trim() ||
    String(firebaseUser.email || "").trim() ||
    String(existingProfile.email || existingCustomer.email || "").trim();
  const fullName =
    `${firstName} ${lastName}`.trim() ||
    String(
      existingCustomer.name || firebaseUser.displayName || "Cliente",
    ).trim();

  const profilePayload = {
    firstName,
    lastName,
    phone,
    cpf,
    email,
    updatedAt: serverTimestamp(),
  };

  const customerPayload = {
    name: fullName,
    phone,
    cpf,
    email,
    document: String(existingCustomer.document || "").trim(),
    userId: firebaseUser.uid,
    updatedAt: serverTimestamp(),
  };

  if (!profileSnap.exists()) {
    profilePayload.createdAt = serverTimestamp();
  }

  if (!customerSnap.exists()) {
    customerPayload.createdAt = serverTimestamp();
  }

  await Promise.all([
    setDoc(profileRef, profilePayload, { merge: true }),
    setDoc(customerRef, customerPayload, { merge: true }),
  ]);
};

const generateNextOrderNumber = async () => {
  const counterRef = doc(
    db,
    "artifacts",
    appId,
    "public",
    "data",
    "counters",
    "order_number",
  );

  return runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const rawCurrent = Number(counterSnap.data()?.lastOrderNumber);
    const current =
      Number.isInteger(rawCurrent) && rawCurrent >= ORDER_COUNTER_BASE
        ? rawCurrent
        : ORDER_COUNTER_BASE;
    const nextOrderNumber = current + 1;

    transaction.set(
      counterRef,
      {
        lastOrderNumber: nextOrderNumber,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return nextOrderNumber;
  });
};

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

const maskCpf = (value) => {
  const v = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 11);
  if (v.length <= 3) return v;
  if (v.length <= 6) return v.replace(/(\d{3})(\d+)/, "$1.$2");
  if (v.length <= 9) return v.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
};

const validateCpf = (cpf) => {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += parseInt(d[i]) * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 || r === 11 ? 0 : r;
  };
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
};

const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "");

const normalizeForSearch = (str) =>
  String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

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

function GoogleBrandIcon({ size = 18, className = "" }) {
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
        d="M21.805 12.23C21.805 11.55 21.744 10.906 21.629 10.286H12.24V14.127H17.606C17.375 15.369 16.668 16.422 15.606 17.13V19.62H18.814C20.69 17.893 21.805 15.351 21.805 12.23Z"
        fill="#4285F4"
      />
      <path
        d="M12.24 21.96C14.934 21.96 17.191 21.067 18.814 19.62L15.606 17.13C14.713 17.727 13.572 18.08 12.24 18.08C9.643 18.08 7.446 16.326 6.661 13.969H3.344V16.538C4.958 19.746 8.276 21.96 12.24 21.96Z"
        fill="#34A853"
      />
      <path
        d="M6.661 13.969C6.462 13.372 6.349 12.735 6.349 12.08C6.349 11.425 6.462 10.788 6.661 10.191V7.622H3.344C2.679 8.945 2.3 10.435 2.3 12.08C2.3 13.725 2.679 15.215 3.344 16.538L6.661 13.969Z"
        fill="#FBBC05"
      />
      <path
        d="M12.24 6.08C13.693 6.08 14.997 6.58 16.022 7.562L18.886 4.698C17.186 3.112 14.928 2.2 12.24 2.2C8.276 2.2 4.958 4.414 3.344 7.622L6.661 10.191C7.446 7.834 9.643 6.08 12.24 6.08Z"
        fill="#EA4335"
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

const normalizeAnnouncementMessages = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/\n|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeFaqItems = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      question: String(item?.question || "").trim(),
      answer: String(item?.answer || "").trim(),
    }))
    .filter((item) => item.question && item.answer);
};

const normalizeCustomerHighlights = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const starsRaw = Number(item?.stars);
      const stars = Number.isFinite(starsRaw)
        ? Math.max(1, Math.min(5, Math.round(starsRaw)))
        : 5;

      return {
        author: String(item?.author || "").trim(),
        text: String(item?.text || "").trim(),
        stars,
      };
    })
    .filter((item) => item.author && item.text);
};

const resolveComplimentsAndQuestionsLink = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^(https?:\/\/|mailto:|tel:)/i.test(raw)) return raw;

  if (raw.includes("@")) {
    const email = raw.replace(/^mailto:/i, "").trim();
    return `mailto:${email}?subject=${encodeURIComponent("Dúvida/Elogio")}`;
  }

  const digits = normalizePhoneDigits(raw);
  if (digits.length >= 10) {
    return `https://wa.me/55${digits}?text=${encodeURIComponent("Olá! Quero enviar uma dúvida/elogio sobre a loja.")}`;
  }

  return "";
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

const isPickupOrder = (order) => String(order?.shipping?.id || "") === "pickup";

const resolvePickupMapUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
};

const normalizeStoreAddress = (value) => {
  const source = value && typeof value === "object" ? value : {};
  return {
    cep: String(source.cep || "").trim(),
    rua: String(source.rua || "").trim(),
    numero: String(source.numero || "").trim(),
    complemento: String(source.complemento || "").trim(),
    bairro: String(source.bairro || "").trim(),
    cidade: String(source.cidade || "").trim(),
    estado: String(source.estado || "")
      .trim()
      .toUpperCase()
      .slice(0, 2),
  };
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
  sizeTables: [
    {
      id: "size_table_default",
      name: "Tabela padrão (Camisetas)",
      html: "<table><thead><tr><th>Tamanho</th><th>Largura (Peito)</th><th>Comprimento (Altura)</th></tr></thead><tbody><tr><td>S (P)</td><td>50 cm</td><td>70 cm</td></tr><tr><td>M (M)</td><td>52 cm</td><td>72 cm</td></tr><tr><td>L (G)</td><td>54 cm</td><td>74 cm</td></tr><tr><td>XL (GG)</td><td>56 cm</td><td>76 cm</td></tr><tr><td>2XL (XG)</td><td>58 cm</td><td>78 cm</td></tr></tbody></table>",
    },
  ],
};

const createCatalogSectionId = () =>
  `section_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createCatalogSizeTableId = () =>
  `size_table_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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
  const raw = String(value || "").replace(/\u00A0/g, " ");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Accepts textual tables like: "Coluna A | Coluna B | Coluna C"
  if (lines.length > 1 && lines.some((line) => line.includes("|"))) {
    const parsedRows = lines
      .filter((line) => !/^\|?\s*[-:]+(?:\s*\|\s*[-:]+)+\s*\|?$/.test(line))
      .map((line) =>
        line
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell, index, all) => {
            if (all.length <= 1) return Boolean(cell);
            const isEdge = index === 0 || index === all.length - 1;
            return isEdge ? true : true;
          }),
      )
      .map((cells) => {
        if (
          cells.length >= 2 &&
          cells[0] === "" &&
          cells[cells.length - 1] === ""
        ) {
          return cells.slice(1, -1);
        }
        return cells;
      })
      .map((cells) => cells.map((cell) => cell.trim()))
      .filter((cells) => cells.some(Boolean));

    if (parsedRows.length >= 2) {
      const maxCols = Math.max(...parsedRows.map((row) => row.length));
      const headerRow = parsedRows[0];
      const dataRows = parsedRows.slice(1);
      const headers = Array.from({ length: maxCols }, (_, index) => {
        const label = String(headerRow[index] || "").trim();
        return label || `Coluna ${index + 1}`;
      });

      const thead = `<thead><tr>${headers
        .map((header) => `<th>${escapeHtml(header)}</th>`)
        .join("")}</tr></thead>`;

      const tbody = `<tbody>${dataRows
        .map((row) => {
          const cells = Array.from({ length: maxCols }, (_, index) =>
            escapeHtml(String(row[index] || "").trim()),
          );
          return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
        })
        .join("")}</tbody>`;

      return `<table>${thead}${tbody}</table>`;
    }
  }

  const text = raw.replace(/\s+/g, " ").trim();

  if (!text) return "";

  const rowRegex =
    /((?:\d?\s*XL|[SPMLG])\s*\([^)]+\))\s*(\d{2,3}(?:\s*-\s*\d{2,3})?\s*cm)\s*(\d{2,3}(?:\s*-\s*\d{2,3})?\s*cm)/gi;
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

const buildSizeTableTextFromHtml = (value) => {
  if (typeof window === "undefined") return "";

  const html = String(value || "").trim();
  if (!html) return "";

  try {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    const headers = Array.from(wrapper.querySelectorAll("thead th"))
      .map((cell) => cell.textContent?.replace(/\s+/g, " ").trim() || "")
      .filter(Boolean);
    const rows = Array.from(wrapper.querySelectorAll("tbody tr"));

    if (rows.length === 0) {
      return wrapper.textContent?.replace(/\s+/g, " ").trim() || "";
    }

    const contentLines = rows
      .map((row) =>
        Array.from(row.querySelectorAll("td"))
          .map((cell) => cell.textContent?.replace(/\s+/g, " ").trim() || "")
          .join(" | "),
      )
      .filter((line) => line.replace(/\|/g, "").trim().length > 0);

    if (headers.length > 0) {
      return [headers.join(" | "), ...contentLines].join("\n");
    }

    return contentLines.join("\n");
  } catch (error) {
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
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

const parseBooleanFlag = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return ["true", "1", "sim", "yes", "y", "pickup", "retirada"].includes(
    normalized,
  );
};

const isProductPickupEligible = (product) =>
  parseBooleanFlag(product?.allowPickup);

const findLocalCityCoverage = (address, shippingConfig) => {
  if (!address) return null;

  const city = String(address?.cidade || "")
    .trim()
    .toLowerCase();
  const state = String(address?.estado || "")
    .trim()
    .toLowerCase();

  if (!city || !state) return null;

  const localCities = Array.isArray(shippingConfig?.localCities)
    ? shippingConfig.localCities
    : [];

  return (
    localCities.find(
      (item) =>
        String(item?.name || "")
          .trim()
          .toLowerCase() === city &&
        String(item?.state || "")
          .trim()
          .toLowerCase() === state,
    ) || null
  );
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

  const sizeTables = Array.isArray(base.sizeTables)
    ? base.sizeTables
        .map((item) => ({
          id:
            String(item?.id || "").trim() ||
            `size_table_${Math.random().toString(36).slice(2, 8)}`,
          name: String(item?.name || "").trim(),
          html: String(item?.html || "").trim(),
        }))
        .filter((item) => item.name && item.html)
    : [];

  return {
    sections,
    categories:
      categories.length > 0 ? categories : DEFAULT_PRODUCT_CATALOG.categories,
    variationTypes:
      variationTypes.length > 0
        ? variationTypes
        : DEFAULT_PRODUCT_CATALOG.variationTypes,
    sizeTables:
      sizeTables.length > 0 ? sizeTables : DEFAULT_PRODUCT_CATALOG.sizeTables,
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

const normalizeProductPersonalization = (product) => {
  const base =
    product?.personalization && typeof product.personalization === "object"
      ? product.personalization
      : {};
  const price = Number(base.price);

  return {
    enabled: Boolean(base.enabled),
    allowName: Boolean(base.allowName),
    allowNumber: Boolean(base.allowNumber),
    details: String(base.details || "").trim(),
    price: Number.isFinite(price) && price > 0 ? price : 0,
  };
};

const normalizeSelectedPersonalization = (value) => {
  const base = value && typeof value === "object" ? value : {};
  return {
    usePersonalization: Boolean(base.usePersonalization),
    name: String(base.name || "").trim(),
    number: String(base.number || "").trim(),
  };
};

const getSelectedPersonalizationLabel = (value) => {
  const personalization = normalizeSelectedPersonalization(value);
  if (!personalization.usePersonalization) return "";

  const parts = [];
  if (personalization.name) {
    parts.push(`Nome: ${personalization.name}`);
  }
  if (personalization.number) {
    parts.push(`Número: ${personalization.number}`);
  }

  return parts.join(" | ");
};

const getCartItemUnitPrice = (item) => Math.max(0, Number(item?.price || 0));

const getCartItemTotalPrice = (item) =>
  getCartItemUnitPrice(item) * Math.max(1, Number(item?.qty || 1));

const getCartItemPersonalizationPrice = (item) =>
  Math.max(0, Number(item?.personalizationPrice || 0));

const buildCartItemId = (item) => {
  const variation = String(item?.selectedVariation || "").trim();
  const personalizationLabel = getSelectedPersonalizationLabel(
    item?.selectedPersonalization,
  );

  return [String(item?.id || "").trim(), variation, personalizationLabel]
    .filter(Boolean)
    .join("-");
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
  onShareProduct,
  isShelf = false,
}) {
  const { priceTag, discountPct } = getDiscountMeta(product);
  const pickupAvailable = isProductPickupEligible(product);
  const hasVariations = getProductVariationGroups(product).length > 0;
  const personalization = normalizeProductPersonalization(product);
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
        {pickupAvailable && (
          <span className="inline-flex items-center w-fit mb-2 px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 text-[10px] sm:text-[11px] font-bold border border-cyan-200">
            Retirada na loja
          </span>
        )}
        {personalization.enabled && (
          <span className="inline-flex items-center w-fit mb-2 px-2.5 py-1 rounded-full bg-fuchsia-50 text-fuchsia-700 text-[10px] sm:text-[11px] font-bold border border-fuchsia-200">
            Personalizável
          </span>
        )}
        {descriptionPreview && (
          <p className="text-[11px] sm:text-xs text-slate-500 mb-2 line-clamp-2 leading-relaxed min-h-[2rem]">
            {descriptionPreview}
          </p>
        )}

        <div className="mt-auto pt-3 border-t border-slate-100 space-y-2">
          <div className="hidden md:flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShareProduct(product);
              }}
              className="group/share relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition cursor-pointer"
              title="Compartilhar produto"
            >
              <Share2 size={16} />
              <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold bg-slate-900 text-white px-2.5 py-1 rounded-lg opacity-0 pointer-events-none group-hover/share:opacity-100 transition">
                Compartilhar
              </span>
            </button>
          </div>

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

          <div className="md:hidden flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShareProduct(product);
              }}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition cursor-pointer"
              title="Compartilhar produto"
            >
              <Share2 size={16} />
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
  const [productInterestLeads, setProductInterestLeads] = useState([]);
  const [productNotFoundRequests, setProductNotFoundRequests] = useState([]);
  const [customerFeedbacks, setCustomerFeedbacks] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [storeSettings, setStoreSettings] = useState({
    storeName: "NovaLoja",
    storeTagline: "",
    heroTitle: "Seu Estilo, Sua Vitrine",
    heroDescription:
      "Filtros rapidos, categorias inteligentes e colecoes em destaque para facilitar a compra no celular e no desktop.",
    logo: "",
    banners: [],
    announcementMessages: [],
    footerDescription: "",
    faqItems: [],
    customerHighlights: [],
    complimentsAndQuestionsContact: "",
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
    pickupMapUrl: "",
    storeAddress: {
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
    },
    catalog: DEFAULT_PRODUCT_CATALOG,
    shipping: {
      pickupEnabled: true,
      localCities: [],
      separationDays: 2,
      pacEnabled: true,
      pacRate: 25.0,
      pacDeliveryDays: "5 a 10",
      sedexEnabled: true,
      sedexRate: 37.5,
      sedexDeliveryDays: "2 a 4",
      localDeliveryTime: "mesmo dia",
      pickupTime: "1 dia útil",
    },
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

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
  const isAdminAuthenticated =
    Boolean(user) && !user?.isAnonymous && isAllowedAdminEmail(user?.email);

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

    const couponsRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "coupons",
    );
    const unsubCoupons = onSnapshot(
      couponsRef,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCoupons(
          list.sort(
            (a, b) =>
              (b.createdAt?.toMillis?.() || 0) -
              (a.createdAt?.toMillis?.() || 0),
          ),
        );
      },
      (err) => console.error(err),
    );

    const customerFeedbacksRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "customer_feedbacks",
    );
    const unsubCustomerFeedbacks = onSnapshot(
      customerFeedbacksRef,
      (snapshot) => {
        const list = snapshot.docs.map((feedbackDoc) => ({
          id: feedbackDoc.id,
          ...feedbackDoc.data(),
        }));
        setCustomerFeedbacks(
          list.sort(
            (a, b) =>
              (b.createdAt?.toMillis?.() || 0) -
              (a.createdAt?.toMillis?.() || 0),
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
      unsubCoupons();
      unsubCustomerFeedbacks();
      unsubSettings();
    };
  }, [user]);

  // Data Fetching (Admin Data)
  useEffect(() => {
    if (!user || !isAdminRoute || !isAdminAuthenticated) {
      setOrders([]);
      setAbandonedCarts([]);
      setProductInterestLeads([]);
      setProductNotFoundRequests([]);
      return;
    }

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
        const ords = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
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
        const carts = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
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

    const leadsRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "product_interest_leads",
    );
    const unsubLeads = onSnapshot(
      leadsRef,
      (snapshot) => {
        const leads = snapshot.docs.map((leadDoc) => ({
          id: leadDoc.id,
          ...leadDoc.data(),
        }));

        setProductInterestLeads(
          leads.sort(
            (a, b) =>
              (b.lastClickedAt?.toMillis?.() || 0) -
              (a.lastClickedAt?.toMillis?.() || 0),
          ),
        );
      },
      (err) => console.error(err),
    );

    const productRequestsRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "product_not_found_requests",
    );
    const unsubProductRequests = onSnapshot(
      productRequestsRef,
      (snapshot) => {
        const list = snapshot.docs.map((requestDoc) => ({
          id: requestDoc.id,
          ...requestDoc.data(),
        }));
        setProductNotFoundRequests(
          list.sort(
            (a, b) =>
              (b.createdAt?.toMillis?.() || 0) -
              (a.createdAt?.toMillis?.() || 0),
          ),
        );
      },
      (err) => console.error(err),
    );

    return () => {
      unsubOrders();
      unsubCarts();
      unsubLeads();
      unsubProductRequests();
    };
  }, [user, isAdminRoute, isAdminAuthenticated]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdminLogin = async (email, password) => {
    if (!ADMIN_ALLOWED_EMAILS.length) {
      showToast(
        "VITE_ADMIN_EMAILS não está configurada. Defina os e-mails admin no ambiente.",
        "error",
      );
      return false;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        String(email || "").trim(),
        password,
      );

      if (!isAllowedAdminEmail(userCredential.user?.email)) {
        await signOut(auth);
        showToast(
          "Este usuário não está autorizado para o painel admin.",
          "error",
        );
        return false;
      }

      showToast("Acesso administrativo liberado.");
      return true;
    } catch (error) {
      showToast(getFriendlyAuthErrorMessage(error), "error");
      return false;
    }
  };

  const handleAdminLogout = async () => {
    await signOut(auth);
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
          coupons={coupons}
          customerFeedbacks={customerFeedbacks}
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
          productInterestLeads={productInterestLeads}
          productNotFoundRequests={productNotFoundRequests}
          customerFeedbacks={customerFeedbacks}
          coupons={coupons}
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

        .feedback-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(100, 116, 139, 0.55) transparent; }
        .feedback-scrollbar::-webkit-scrollbar { width: 6px; }
        .feedback-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .feedback-scrollbar::-webkit-scrollbar-thumb { background: rgba(100, 116, 139, 0.55); border-radius: 999px; }
        .feedback-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.75); }
        
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

        @keyframes announcement-marquee-right-to-left {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .announcement-marquee {
          animation: announcement-marquee-right-to-left 16s linear infinite;
          will-change: transform;
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onLogin(email, password);
    } finally {
      setIsSubmitting(false);
    }
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            O acesso depende de autenticação no Firebase e do e-mail estar
            listado em VITE_ADMIN_EMAILS.
          </p>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Entrando..." : "Entrar no Painel"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 1. ÁREA DO CLIENTE (STOREFRONT)
// ==========================================
function StoreFront({
  products,
  user,
  showToast,
  storeSettings,
  coupons = [],
  customerFeedbacks = [],
}) {
  const [cart, setCart] = useState([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [myOrders, setMyOrders] = useState([]);
  const [myProductRequests, setMyProductRequests] = useState([]);
  const previousAuthUserRef = useRef(null);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isNotFoundRequestOpen, setIsNotFoundRequestOpen] = useState(false);
  const [isSubmittingNotFoundRequest, setIsSubmittingNotFoundRequest] =
    useState(false);
  const [isFaqSectionExpanded, setIsFaqSectionExpanded] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    customerName: "",
    stars: 5,
    message: "",
  });
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [notFoundRequestForm, setNotFoundRequestForm] = useState({
    productName: "",
    category: "",
    brand: "",
    description: "",
  });
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
  const hasAppliedSharedLinkRef = useRef(false);
  const resultsAnchorRef = useRef(null);
  const shouldScrollToResultsRef = useRef(false);
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
  const announcementMessages = useMemo(
    () => normalizeAnnouncementMessages(storeSettings?.announcementMessages),
    [storeSettings?.announcementMessages],
  );
  const faqItems = useMemo(
    () => normalizeFaqItems(storeSettings?.faqItems),
    [storeSettings?.faqItems],
  );
  const customerHighlights = useMemo(
    () => normalizeCustomerHighlights(storeSettings?.customerHighlights),
    [storeSettings?.customerHighlights],
  );
  const approvedCustomerFeedbacks = useMemo(() => {
    const approved = Array.isArray(customerFeedbacks)
      ? customerFeedbacks
          .filter((item) => String(item?.status || "pending") === "approved")
          .map((item) => ({
            author: String(item?.customerName || "Cliente").trim() || "Cliente",
            text: String(item?.message || "").trim(),
            stars: Number(item?.stars) || 5,
          }))
      : [];

    return normalizeCustomerHighlights(approved);
  }, [customerFeedbacks]);
  const complimentsAndQuestionsHref = useMemo(
    () =>
      resolveComplimentsAndQuestionsLink(
        storeSettings?.complimentsAndQuestionsContact,
      ),
    [storeSettings?.complimentsAndQuestionsContact],
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

  const heroTitle =
    String(storeSettings?.heroTitle || "").trim() || "Seu Estilo, Sua Vitrine";
  const heroDescription =
    String(storeSettings?.heroDescription || "").trim() ||
    "Filtros rapidos, categorias inteligentes e colecoes em destaque para facilitar a compra no celular e no desktop.";

  const trackProductInterest = useCallback(
    async (product) => {
      if (!user?.uid || !product?.id) return;

      const safeUserId = String(user.uid).replace(/\//g, "_");
      const safeProductId = String(product.id).replace(/\//g, "_");
      const leadId = `${safeUserId}__${safeProductId}`;

      const customerName = userProfile
        ? `${String(userProfile.firstName || "").trim()} ${String(userProfile.lastName || "").trim()}`.trim() ||
          "Cliente"
        : user.isAnonymous
          ? "Visitante"
          : String(user.email || "")
              .split("@")[0]
              .trim() || "Cliente";

      const customerEmail = String(user?.email || "").trim();
      const customerPhone = String(userProfile?.phone || "").trim();

      const leadRef = doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "product_interest_leads",
        leadId,
      );

      const basePayload = {
        userId: user.uid,
        isAnonymous: Boolean(user.isAnonymous),
        customerName,
        customerEmail,
        customerPhone,
        productId: String(product.id || ""),
        productName: String(product.name || ""),
        productCategory: String(product.category || ""),
        productSubcategory: String(product.subcategory || ""),
        productPrice: Number(product.price || 0),
        productImage: String(product.images?.[0] || product.image || ""),
      };

      try {
        const leadSnap = await getDoc(leadRef);
        if (leadSnap.exists()) {
          const currentCount = Number(leadSnap.data()?.clickCount || 0);
          await updateDoc(leadRef, {
            ...basePayload,
            clickCount: currentCount + 1,
            lastClickedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return;
        }

        await setDoc(leadRef, {
          ...basePayload,
          clickCount: 1,
          firstClickedAt: serverTimestamp(),
          lastClickedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Erro ao registrar interesse no produto:", error);
      }
    },
    [user, userProfile],
  );
  const hasContactPhones = contactPhones.length > 0;
  const hasSocialLinks = socialItems.length > 0;
  const hasFaqItems = faqItems.length > 0;
  const mergedCustomerHighlights = [
    ...approvedCustomerFeedbacks,
    ...customerHighlights,
  ];
  const hasCustomerHighlights = mergedCustomerHighlights.length > 0;
  const formattedContactPhones = contactPhones.map((phone) => ({
    raw: phone,
    label: formatContactPhone(phone),
  }));

  const submitCustomerFeedback = async () => {
    const fromProfileName = userProfile
      ? `${String(userProfile.firstName || "").trim()} ${String(userProfile.lastName || "").trim()}`.trim()
      : "";

    const customerName =
      String(feedbackForm.customerName || "").trim() ||
      fromProfileName ||
      String(user?.email || "")
        .split("@")[0]
        .trim();

    const message = String(feedbackForm.message || "").trim();
    const stars = Math.max(
      1,
      Math.min(5, Math.round(Number(feedbackForm.stars) || 5)),
    );

    if (!customerName) {
      showToast("Informe seu nome para enviar o feedback", "error");
      return;
    }

    if (!message) {
      showToast("Escreva seu feedback antes de enviar", "error");
      return;
    }

    try {
      setIsSubmittingFeedback(true);
      await addDoc(
        collection(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "customer_feedbacks",
        ),
        {
          customerId: user?.uid || "",
          customerName,
          customerEmail: String(user?.email || "").trim(),
          customerPhone: String(userProfile?.phone || "").trim(),
          stars,
          message,
          status: "pending",
          isAnonymous: Boolean(user?.isAnonymous),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      );

      setFeedbackForm({ customerName: "", stars: 5, message: "" });
      showToast("Feedback enviado! O admin vai revisar antes de publicar.");
    } catch (error) {
      console.error("Erro ao enviar feedback:", error);
      showToast("Não foi possível enviar o feedback", "error");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

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

  useEffect(() => {
    if (!isRealUser || !user?.uid) return;

    const productRequestsQuery = query(
      collection(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "product_not_found_requests",
      ),
      where("customerId", "==", user.uid),
    );

    const unsub = onSnapshot(
      productRequestsQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((requestDoc) => ({
          id: requestDoc.id,
          ...requestDoc.data(),
        }));

        setMyProductRequests(
          docs.sort(
            (a, b) =>
              (b.createdAt?.toMillis?.() || 0) -
              (a.createdAt?.toMillis?.() || 0),
          ),
        );
      },
      (error) => {
        console.error("Erro ao carregar solicitações de produto:", error);
      },
    );

    return () => unsub();
  }, [isRealUser, user]);

  const handleOpenNotFoundRequestModal = () => {
    if (!isRealUser) {
      showToast("Entre na sua conta para solicitar um produto.", "error");
      setIsAuthModalOpen(true);
      return;
    }

    setNotFoundRequestForm((prev) => ({
      ...prev,
      productName: prev.productName || searchTerm,
    }));
    setIsNotFoundRequestOpen(true);
  };

  const handleSubmitNotFoundRequest = async (e) => {
    e.preventDefault();

    if (!isRealUser || !user?.uid) {
      showToast("Entre na sua conta para solicitar um produto.", "error");
      return;
    }

    if (!String(notFoundRequestForm.productName || "").trim()) {
      showToast("Informe o nome do produto que você procura.", "error");
      return;
    }

    if (String(notFoundRequestForm.description || "").trim().length < 10) {
      showToast(
        "Adicione uma descrição com pelo menos 10 caracteres.",
        "error",
      );
      return;
    }

    setIsSubmittingNotFoundRequest(true);
    try {
      const customerName = userProfile
        ? `${String(userProfile.firstName || "").trim()} ${String(userProfile.lastName || "").trim()}`.trim() ||
          "Cliente"
        : String(user.email || "")
            .split("@")[0]
            .trim() || "Cliente";

      await addDoc(
        collection(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "product_not_found_requests",
        ),
        {
          customerId: user.uid,
          customerName,
          customerEmail: String(user.email || "").trim(),
          customerPhone: String(userProfile?.phone || "").trim(),
          productName: String(notFoundRequestForm.productName || "").trim(),
          category: String(notFoundRequestForm.category || "").trim(),
          brand: String(notFoundRequestForm.brand || "").trim(),
          description: String(notFoundRequestForm.description || "").trim(),
          requestedSearchTerm: searchTerm,
          status: "produto_nao_encontrado",
          adminLink: "",
          adminMessage: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      );

      showToast("Solicitação enviada! Em breve retornaremos com novidades.");
      setIsNotFoundRequestOpen(false);
      setNotFoundRequestForm({
        productName: "",
        category: "",
        brand: "",
        description: "",
      });
    } catch (error) {
      console.error("Erro ao enviar solicitação de produto:", error);
      showToast("Não foi possível enviar a solicitação.", "error");
    } finally {
      setIsSubmittingNotFoundRequest(false);
    }
  };

  useEffect(() => {
    if (!isRealUser || !user?.uid) return;

    const returnParams = parsePaymentReturnParams();
    const pendingContext = readPendingPaymentContext();
    const paymentId = String(
      returnParams.paymentId || pendingContext?.paymentId || "",
    ).trim();

    if (!paymentId) return;

    let cancelled = false;

    const reconcileReturnedPayment = async () => {
      try {
        const res = await fetch(
          buildApiUrl(
            `/api/payment-status?paymentId=${encodeURIComponent(paymentId)}`,
          ),
        );
        const data = await res.json();

        if (!res.ok || !data?.status) {
          throw new Error(
            data?.error ||
              data?.providerMessage ||
              "Falha ao consultar pagamento.",
          );
        }

        let orderId = String(pendingContext?.orderId || "").trim();
        let shippingId = String(pendingContext?.shippingId || "").trim();
        const externalReference = String(
          returnParams.externalReference ||
            pendingContext?.externalReference ||
            data.externalReference ||
            "",
        ).trim();

        if (!orderId && externalReference) {
          const orderByReference = await getDocs(
            query(
              collection(db, "artifacts", appId, "public", "data", "orders"),
              where("mpExternalReference", "==", externalReference),
            ),
          );

          const matchedDoc = orderByReference.docs.find(
            (orderDoc) =>
              String(orderDoc.data()?.customerId || "") === user.uid,
          );

          if (matchedDoc) {
            orderId = matchedDoc.id;
            shippingId = String(matchedDoc.data()?.shipping?.id || "").trim();
          }
        }

        if (!orderId) {
          clearPendingPaymentContext();
          clearPaymentReturnParamsFromUrl();
          return;
        }

        const paymentStatus = String(data.status || "").toLowerCase();
        const updatePayload = {
          paymentStatus,
          mpPaymentId: Number(data.paymentId || paymentId) || Number(paymentId),
          lastPaymentCheckAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (paymentStatus === "approved") {
          updatePayload.status =
            shippingId === "pickup" ? "aguardando_retirada" : "pago";
          updatePayload.paymentApprovedAt = serverTimestamp();
        }

        await updateDoc(
          doc(db, "artifacts", appId, "public", "data", "orders", orderId),
          updatePayload,
        );

        if (cancelled) return;

        if (paymentStatus === "approved") {
          showToast(
            "Pagamento confirmado! Abrindo seus pedidos em 5 segundos.",
          );
          markOpenAccountAfterReload();
          setIsAccountOpen(true);
          window.setTimeout(() => {
            window.location.reload();
          }, 5000);
        } else if (data.isFinal) {
          showToast(
            `Pagamento retornou com status: ${paymentStatus}.`,
            "error",
          );
        } else {
          showToast("Pagamento ainda pendente. Acompanhe em Minha Conta.");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Erro ao reconciliar retorno do checkout:", error);
        }
      } finally {
        clearPendingPaymentContext();
        clearPaymentReturnParamsFromUrl();
      }
    };

    reconcileReturnedPayment();

    return () => {
      cancelled = true;
    };
  }, [isRealUser, user?.uid, showToast]);

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
    (sum, item) => sum + getCartItemTotalPrice(item),
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

  const categoryMenuItems = useMemo(
    () =>
      categories
        .filter((category) => category !== "Todas")
        .map((category) => ({
          category,
          subcategories: [
            ...new Set(
              products
                .filter((product) => product.category === category)
                .flatMap((product) => getProductSubcategories(product))
                .filter(Boolean),
            ),
          ],
        })),
    [categories, products],
  );

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
  const hasActiveCategoryFilter =
    selectedCategory !== "Todas" || effectiveSubcategory !== "Todas";
  const isSearchLikeMode = isSearchMode || hasActiveCategoryFilter;

  const handleBackToStart = () => {
    setSearch("");
    setSelectedCategory("Todas");
    setSelectedSubcategory("Todas");
    setSortBy("relevancia");
    setPriceRange("todos");
    setOnlyInStock(false);
    setOnlyWithVariations(false);
    setActiveShowcaseSectionId("");
    setProductsPage(1);

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const queueResultsScroll = useCallback(() => {
    shouldScrollToResultsRef.current = true;
  }, []);

  const applyCategoryFilter = useCallback(
    (category, subcategory = "Todas") => {
      queueResultsScroll();
      setSelectedCategory(category);
      setSelectedSubcategory(subcategory);
    },
    [queueResultsScroll],
  );

  const applySubcategoryFilter = useCallback(
    (subcategory) => {
      queueResultsScroll();
      setSelectedSubcategory(subcategory);
    },
    [queueResultsScroll],
  );

  const applySortFilter = useCallback(
    (value) => {
      queueResultsScroll();
      setSortBy(value);
    },
    [queueResultsScroll],
  );

  const applyPriceRangeFilter = useCallback(
    (value) => {
      queueResultsScroll();
      setPriceRange(value);
    },
    [queueResultsScroll],
  );

  const applyOnlyInStockFilter = useCallback(
    (value) => {
      queueResultsScroll();
      setOnlyInStock(value);
    },
    [queueResultsScroll],
  );

  const applyOnlyWithVariationsFilter = useCallback(
    (value) => {
      queueResultsScroll();
      setOnlyWithVariations(value);
    },
    [queueResultsScroll],
  );

  const applySearchFilter = useCallback(
    (value) => {
      queueResultsScroll();
      setSearch(value);
    },
    [queueResultsScroll],
  );

  // Adiciona ao carrinho validando o estoque
  const addToCart = (product, qty = 1) => {
    const cartItemId =
      String(product.cartItemId || "").trim() || buildCartItemId(product);

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
      return [
        ...prev,
        {
          ...product,
          allowPickup: isProductPickupEligible(product),
          cartItemId: cartItemId,
          qty,
        },
      ];
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
    const matchesSearch = normalizeForSearch(p.name).includes(
      normalizeForSearch(searchTerm),
    );
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
    normalizeForSearch(p?.name).includes(normalizeForSearch(searchTerm)),
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

  const isDesktopViewport = viewportWidth >= 1024;
  const productsPerPage = isDesktopViewport ? 20 : productGridColumns * 3;
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

  useEffect(() => {
    if (!shouldScrollToResultsRef.current || typeof window === "undefined") {
      return;
    }

    const target = resultsAnchorRef.current;
    shouldScrollToResultsRef.current = false;
    if (!target) return;

    window.requestAnimationFrame(() => {
      const headerOffset = window.innerWidth >= 768 ? 190 : 150;
      const top =
        target.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
    });
  }, [
    searchTerm,
    selectedCategory,
    effectiveSubcategory,
    sortBy,
    priceRange,
    onlyInStock,
    onlyWithVariations,
    visibleProducts.length,
  ]);

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

  useEffect(() => {
    if (!isRealUser) return;
    if (consumeOpenAccountAfterReload()) {
      setIsAccountOpen(true);
    }
  }, [isRealUser]);

  const openProductWithTracking = useCallback(
    (product) => {
      setSelectedProduct(product);
      trackProductInterest(product);
    },
    [trackProductInterest],
  );

  const handleShareProduct = useCallback(
    async (product) => {
      const params = new URLSearchParams();
      params.set("productId", String(product?.id || ""));
      if (product?.category) params.set("category", String(product.category));
      if (product?.subcategory)
        params.set("subcategory", String(product.subcategory));

      const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}${window.location.hash || ""}`;

      try {
        if (navigator.share) {
          await navigator.share({
            title: String(product?.name || "Produto"),
            text: `Confira este produto: ${String(product?.name || "")}`,
            url: shareUrl,
          });
          return;
        }

        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          showToast("Link do produto copiado para compartilhar!");
          return;
        }

        showToast(`Link do produto: ${shareUrl}`);
      } catch (error) {
        console.error("Erro ao compartilhar produto:", error);
        showToast("Não foi possível compartilhar este produto.", "error");
      }
    },
    [showToast],
  );

  useEffect(() => {
    if (!products.length || hasAppliedSharedLinkRef.current) return;

    const params = new URLSearchParams(window.location.search || "");
    const productId = String(params.get("productId") || "").trim();
    const categoryFromUrl = String(params.get("category") || "").trim();
    const subcategoryFromUrl = String(params.get("subcategory") || "").trim();

    if (!productId && !categoryFromUrl && !subcategoryFromUrl) return;

    hasAppliedSharedLinkRef.current = true;

    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl);
      setSelectedSubcategory("Todas");
    }

    if (subcategoryFromUrl) {
      setSelectedSubcategory(subcategoryFromUrl);
    }

    if (productId) {
      const product = products.find((item) => String(item?.id) === productId);
      if (product) {
        openProductWithTracking(product);
      }
    }
  }, [products, openProductWithTracking]);

  useEffect(() => {
    const previousUser = previousAuthUserRef.current;
    previousAuthUserRef.current = user
      ? { uid: user.uid, isAnonymous: Boolean(user.isAnonymous) }
      : null;

    if (!previousUser || !user?.uid) return;

    const switchedFromAnonymousToRealUser =
      previousUser.isAnonymous &&
      !user.isAnonymous &&
      previousUser.uid !== user.uid;

    if (!switchedFromAnonymousToRealUser) return;

    // Remove o carrinho anônimo anterior para não duplicar em "carrinhos ativos".
    deleteDoc(
      doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "abandoned_carts",
        previousUser.uid,
      ),
    ).catch((error) => {
      console.error("Erro ao limpar carrinho anônimo antigo:", error);
    });
  }, [user]);

  return (
    <div className="relative min-h-[calc(100vh-36px)] bg-slate-50/50 print:hidden flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl shadow-sm">
        {announcementMessages.length > 0 && (
          <div className="relative overflow-hidden border-b border-amber-300 bg-gradient-to-r from-amber-500 via-rose-500 to-orange-500 text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.18)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_45%)] pointer-events-none"></div>
            <div className="flex items-center gap-3 px-3 md:px-4 py-2.5">
              <span className="shrink-0 rounded-full bg-white/20 border border-white/30 px-2.5 py-1 text-[10px] md:text-[11px] font-black uppercase tracking-[0.24em]">
                Avisos
              </span>
              <div className="relative flex-1 overflow-hidden">
                <div className="announcement-marquee flex min-w-max items-center gap-8 whitespace-nowrap font-black text-[12px] md:text-sm tracking-wide">
                  {[...announcementMessages, ...announcementMessages].map(
                    (message, index) => (
                      <span
                        key={`${message}-${index}`}
                        className="inline-flex items-center gap-3"
                      >
                        <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.7)]"></span>
                        <span>{message}</span>
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4 flex flex-col gap-4">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={handleBackToStart}
                className="w-14 h-14 md:w-16 md:h-16 rounded-2xl p-1.5 bg-gradient-to-br from-amber-200 via-rose-100 to-sky-100 shadow-md shrink-0 cursor-pointer"
                title="Voltar ao início"
              >
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
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                  <button
                    onClick={handleBackToStart}
                    className="cursor-pointer"
                    title="Voltar ao início"
                  >
                    <h1 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 truncate leading-tight max-w-[280px] sm:max-w-[360px] md:max-w-none text-left hover:text-indigo-700 transition">
                      {storeSettings.storeName || "Aucela Multimarcas"}
                    </h1>
                  </button>
                  {!isSearchMode && categoryMenuItems.length > 0 && (
                    <div className="hidden md:flex items-center gap-2 flex-wrap">
                      {categoryMenuItems.map((item) => (
                        <div key={item.category} className="relative group">
                          <button
                            onClick={() => applyCategoryFilter(item.category)}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                              selectedCategory === item.category
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            {item.category}
                          </button>

                          {item.subcategories.length > 0 && (
                            <div className="absolute left-0 top-full pt-1 z-50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition">
                              <div className="min-w-[220px] max-w-[320px] flex flex-wrap gap-1.5 bg-white border border-slate-200 rounded-xl p-2 shadow-xl">
                                {item.subcategories.map((sub) => (
                                  <button
                                    key={`${item.category}-${sub}`}
                                    onClick={() =>
                                      applyCategoryFilter(item.category, sub)
                                    }
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                      selectedCategory === item.category &&
                                      effectiveSubcategory === sub
                                        ? "bg-amber-500 text-white"
                                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    }`}
                                  >
                                    {sub}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                    className="flex items-center gap-2 text-slate-700 hover:text-indigo-600 font-bold text-sm transition bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-full cursor-pointer"
                    title="Minha Conta"
                  >
                    <FileText size={18} />
                    <span className="hidden sm:inline">Minha Conta</span>
                  </button>
                  <button
                    onClick={() => signOut(auth)}
                    className="text-slate-500 hover:text-rose-500 transition cursor-pointer"
                    title="Sair"
                  >
                    <LogOut size={22} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-2 text-slate-700 hover:text-indigo-600 font-bold text-sm transition bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-full cursor-pointer"
                >
                  <User size={18} />{" "}
                  <span className="hidden sm:inline">Entrar / Cadastrar</span>
                </button>
              )}

              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2.5 text-slate-700 hover:text-white hover:bg-gradient-to-r hover:from-indigo-600 hover:to-purple-600 hover:shadow-md transition-all duration-300 bg-slate-200 rounded-full hover:scale-105 cursor-pointer"
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

          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <div className="relative flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Buscar produtos, marcas e estilos..."
                value={search}
                onChange={(e) => applySearchFilter(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-100 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 border border-slate-200"
              />
            </div>

            {hasActiveCategoryFilter && (
              <button
                onClick={() => {
                  setSelectedCategory("Todas");
                  setSelectedSubcategory("Todas");
                }}
                className="px-4 py-3 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm transition cursor-pointer whitespace-nowrap"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </div>
      </header>

      {!isSearchLikeMode && (
        <>
          {/* Banners Carousel */}
          <BannerCarousel banners={storeSettings.banners} />

          {/* Hero Section */}
          <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white py-14 px-4 text-center border-b-[5px] border-amber-400 shadow-2xl">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-black mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-amber-100 drop-shadow-2xl">
                {heroTitle}
              </h2>
              <p className="text-sm md:text-base text-slate-200 max-w-2xl mx-auto">
                {heroDescription}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Product Grid */}
      <main className="max-w-[1400px] mx-auto px-4 py-8 md:py-12 pb-20 md:pb-10 flex-1 w-full">
        {!isSearchLikeMode && showcaseSections.length > 0 && (
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
                          className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs md:text-sm font-black transition cursor-pointer"
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
                            onOpenProduct={openProductWithTracking}
                            onAddToCart={addToCart}
                            onShareProduct={handleShareProduct}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex gap-3 md:gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory pb-1">
                        {section.products.slice(0, 10).map((product) => (
                          <StoreProductCard
                            key={`${section.id}-${product.id}`}
                            product={product}
                            onOpenProduct={openProductWithTracking}
                            onAddToCart={addToCart}
                            onShareProduct={handleShareProduct}
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

        {!isSearchLikeMode && (
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
                        onClick={() => applyCategoryFilter(cat)}
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
                        onClick={() => applySubcategoryFilter(sub)}
                        className={`px-3.5 py-1.5 rounded-full text-xs md:text-sm font-bold transition-all cursor-pointer ${
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
                    onChange={(e) => applySortFilter(e.target.value)}
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
                    onChange={(e) => applyPriceRangeFilter(e.target.value)}
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
                      onChange={(e) => applyOnlyInStockFilter(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                    />
                    Somente em estoque
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={onlyWithVariations}
                      onChange={(e) =>
                        applyOnlyWithVariationsFilter(e.target.checked)
                      }
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                    />
                    Com variações
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={resultsAnchorRef} />

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
            <button
              onClick={handleOpenNotFoundRequestModal}
              className="mt-5 inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition cursor-pointer"
            >
              Solicitar / Indicar um produto
            </button>
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
                  onOpenProduct={openProductWithTracking}
                  onAddToCart={addToCart}
                  onShareProduct={handleShareProduct}
                />
              ))}
            </div>

            {totalProductPages > 1 && (
              <div className="pt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setProductsPage((prev) => Math.max(1, prev - 1));
                    setTimeout(() => {
                      const el = resultsAnchorRef.current;
                      if (!el) return;
                      const headerOffset = window.innerWidth >= 768 ? 80 : 60;
                      const top =
                        el.getBoundingClientRect().top +
                        window.scrollY -
                        headerOffset;
                      window.scrollTo({
                        top: Math.max(top, 0),
                        behavior: "smooth",
                      });
                    }, 50);
                  }}
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
                  onClick={() => {
                    setProductsPage((prev) =>
                      Math.min(totalProductPages, prev + 1),
                    );
                    setTimeout(() => {
                      const el = resultsAnchorRef.current;
                      if (!el) return;
                      const headerOffset = window.innerWidth >= 768 ? 80 : 60;
                      const top =
                        el.getBoundingClientRect().top +
                        window.scrollY -
                        headerOffset;
                      window.scrollTo({
                        top: Math.max(top, 0),
                        behavior: "smooth",
                      });
                    }, 50);
                  }}
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

          {(hasFaqItems || hasCustomerHighlights) && (
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {hasFaqItems && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-300">
                        FAQ
                      </h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {faqItems.length} pergunta(s)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {complimentsAndQuestionsHref && (
                        <a
                          href={complimentsAndQuestionsHref}
                          target={
                            complimentsAndQuestionsHref.startsWith("http")
                              ? "_blank"
                              : undefined
                          }
                          rel={
                            complimentsAndQuestionsHref.startsWith("http")
                              ? "noreferrer"
                              : undefined
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-cyan-400/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-cyan-200 hover:bg-cyan-500/20"
                        >
                          <MessageCircle size={13} /> Enviar dúvida/elogios
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsFaqSectionExpanded((prev) => !prev)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-200 hover:bg-slate-800"
                      >
                        {isFaqSectionExpanded ? "Recolher FAQ" : "Ver FAQ"}
                        <span
                          className={`transition-transform ${isFaqSectionExpanded ? "rotate-45" : ""}`}
                        >
                          +
                        </span>
                      </button>
                    </div>
                  </div>

                  {isFaqSectionExpanded ? (
                    <div className="feedback-scrollbar mt-4 space-y-3 max-h-[250px] overflow-y-auto pr-1">
                      {faqItems.map((faq, index) => (
                        <details
                          key={`${faq.question}-${index}`}
                          className="group rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
                        >
                          <summary className="cursor-pointer list-none text-sm font-bold text-slate-100 flex items-start justify-between gap-3">
                            <span>{faq.question}</span>
                            <span className="text-slate-400 group-open:rotate-45 transition-transform">
                              +
                            </span>
                          </summary>
                          <p className="mt-2 text-sm leading-relaxed text-slate-400">
                            {faq.answer}
                          </p>
                        </details>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {hasCustomerHighlights && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-300">
                    Avaliações de Clientes
                  </h4>
                  <div className="feedback-scrollbar mt-4 space-y-3 max-h-[250px] overflow-y-auto pr-1">
                    {mergedCustomerHighlights.map((item, index) => (
                      <article
                        key={`${item.author}-${index}`}
                        className="rounded-xl border border-slate-700 bg-[#06080f] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
                      >
                        <p className="text-sm leading-relaxed text-slate-100 italic">
                          "{item.text}"
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                          <span className="font-semibold">- {item.author}</span>
                          <div
                            className="flex items-center gap-0.5"
                            aria-label={`${item.stars} estrelas`}
                          >
                            {Array.from({ length: 5 }).map((_, starIndex) => (
                              <Star
                                key={`${item.author}-${index}-${starIndex}`}
                                size={13}
                                className={
                                  starIndex < item.stars
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-slate-600"
                                }
                              />
                            ))}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-6">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-300">
              Conte Sua Experiência
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Seu feedback é revisado pelo admin antes de aparecer publicamente.
            </p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-3">
              <input
                type="text"
                value={feedbackForm.customerName}
                onChange={(e) =>
                  setFeedbackForm((prev) => ({
                    ...prev,
                    customerName: e.target.value,
                  }))
                }
                placeholder="Seu nome"
                className="md:col-span-3 p-2.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={feedbackForm.stars}
                onChange={(e) =>
                  setFeedbackForm((prev) => ({
                    ...prev,
                    stars: e.target.value,
                  }))
                }
                className="md:col-span-1 p-2.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={5}>5 estrelas</option>
                <option value={4}>4 estrelas</option>
                <option value={3}>3 estrelas</option>
                <option value={2}>2 estrelas</option>
                <option value={1}>1 estrela</option>
              </select>
              <button
                type="button"
                onClick={submitCustomerFeedback}
                disabled={isSubmittingFeedback}
                className="md:col-span-2 p-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white font-bold"
              >
                {isSubmittingFeedback ? "Enviando..." : "Enviar feedback"}
              </button>
              <textarea
                rows={3}
                value={feedbackForm.message}
                onChange={(e) =>
                  setFeedbackForm((prev) => ({
                    ...prev,
                    message: e.target.value,
                  }))
                }
                placeholder="Como foi sua experiência com a loja?"
                className="md:col-span-6 p-2.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
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
          productRequests={myProductRequests}
          storeSettings={storeSettings}
          close={() => setIsAccountOpen(false)}
          showToast={showToast}
        />
      )}
      {isNotFoundRequestOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-indigo-100 bg-white shadow-2xl overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 border-b border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-slate-800">
                    Solicitar / Indicar um produto
                  </h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                    Não se preocupe! Não encontrou o produto? Envie o máximo de
                    informações abaixo e retornaremos com o link pronto do item
                    ou com uma resposta da sua solicitação.
                  </p>
                </div>
                <button
                  onClick={() => setIsNotFoundRequestOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 transition cursor-pointer"
                  aria-label="Fechar modal"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmitNotFoundRequest}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                    Nome do produto*
                  </label>
                  <input
                    value={notFoundRequestForm.productName}
                    onChange={(e) =>
                      setNotFoundRequestForm((prev) => ({
                        ...prev,
                        productName: e.target.value,
                      }))
                    }
                    placeholder="Ex: Tênis Nike Air Max 90 branco"
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                    Categoria
                  </label>
                  <input
                    value={notFoundRequestForm.category}
                    onChange={(e) =>
                      setNotFoundRequestForm((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    placeholder="Ex: Calçados, Camisetas, Acessórios"
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                    Marca
                  </label>
                  <input
                    value={notFoundRequestForm.brand}
                    onChange={(e) =>
                      setNotFoundRequestForm((prev) => ({
                        ...prev,
                        brand: e.target.value,
                      }))
                    }
                    placeholder="Ex: Nike, Adidas, Reserva"
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Descrição detalhada*
                </label>
                <textarea
                  rows={5}
                  value={notFoundRequestForm.description}
                  onChange={(e) =>
                    setNotFoundRequestForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Modelo, cor, tamanho, faixa de preço, referência, uso, fotos de referência, tudo que ajudar a localizar o produto ideal."
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNotFoundRequestOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNotFoundRequest}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold transition cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmittingNotFoundRequest
                    ? "Enviando..."
                    : "Enviar solicitação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isCheckoutOpen && (
        <CheckoutFlow
          cart={cart}
          cartTotal={cartTotal}
          products={products}
          user={user}
          userProfile={userProfile}
          storeSettings={storeSettings}
          coupons={coupons}
          close={() => setIsCheckoutOpen(false)}
          showToast={showToast}
          clearCart={() => setCart([])}
        />
      )}
    </div>
  );
}

function CustomerAccountModal({
  user,
  userProfile,
  orders,
  productRequests,
  storeSettings,
  close,
  showToast,
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isNewAddressFormOpen, setIsNewAddressFormOpen] = useState(false);
  const [isDeletingAddressId, setIsDeletingAddressId] = useState("");
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [paymentModalOrder, setPaymentModalOrder] = useState(null);
  const [retryPaymentMethod, setRetryPaymentMethod] = useState("");
  const [retryPixData, setRetryPixData] = useState(null);
  const [retryPaymentError, setRetryPaymentError] = useState("");
  const [retryPaymentCheckLabel, setRetryPaymentCheckLabel] = useState("");
  const [isRetryPaymentChecking, setIsRetryPaymentChecking] = useState(false);
  const retryApprovedHandledRef = useRef(false);
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState("");
  const [myOrdersSearchTerm, setMyOrdersSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    cpf: "",
    email: "",
  });
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
    recebedorCpf: "",
  });
  const [editingAddressId, setEditingAddressId] = useState("");
  const [editAddressDraft, setEditAddressDraft] = useState({
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    recebedorNome: "",
    recebedorTelefone: "",
    recebedorCpf: "",
  });
  const [isUpdatingAddress, setIsUpdatingAddress] = useState(false);
  const [isSettingPrimaryId, setIsSettingPrimaryId] = useState("");

  useEffect(() => {
    setFormData({
      firstName: userProfile?.firstName || "",
      lastName: userProfile?.lastName || "",
      phone: userProfile?.phone || "",
      cpf: userProfile?.cpf || "",
      email: user?.email || userProfile?.email || "",
    });
  }, [userProfile, user]);

  useEffect(() => {
    if (!user?.uid) return;

    const unsub = onSnapshot(
      collection(db, "artifacts", appId, "users", user.uid, "addresses"),
      (snap) => {
        setAddresses(
          snap.docs.map((addressDoc) => ({
            id: addressDoc.id,
            ...addressDoc.data(),
          })),
        );
      },
      (error) => console.error("Erro ao carregar endereços da conta:", error),
    );

    return () => unsub();
  }, [user?.uid]);

  const handleAccountCepChange = async (e) => {
    const rawCep = e.target.value;
    const maskedCep = maskCEP(rawCep);
    setNewAddress((prev) => ({ ...prev, cep: maskedCep }));

    const cleanCep = maskedCep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

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
    } catch (error) {
      console.error("Erro ao buscar CEP da conta:", error);
    }
  };

  const saveAccountAddress = async (e) => {
    e.preventDefault();

    if (newAddress.cep.replace(/\D/g, "").length !== 8) {
      return showToast("Digite um CEP válido com 8 dígitos", "error");
    }

    if (newAddress.recebedorTelefone.replace(/\D/g, "").length < 10) {
      return showToast("Digite um telefone válido", "error");
    }

    setIsSavingAddress(true);
    try {
      const hasSavedAddress = (addresses || []).length > 0;
      await addDoc(
        collection(db, "artifacts", appId, "users", user.uid, "addresses"),
        {
          ...newAddress,
          isPrimary: !hasSavedAddress,
        },
      );

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
        recebedorCpf: "",
      });
      setIsNewAddressFormOpen(false);
      showToast("Endereço salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar endereço da conta:", error);
      showToast("Erro ao salvar endereço", "error");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const deleteAccountAddress = async (addressId) => {
    if (!user?.uid || !addressId) return;

    if ((addresses || []).length <= 1) {
      showToast(
        "Cadastre outro endereço antes de excluir o único salvo.",
        "error",
      );
      return;
    }

    setIsDeletingAddressId(addressId);
    try {
      const addressToDelete = (addresses || []).find(
        (item) => item.id === addressId,
      );
      const remainingAddresses = (addresses || []).filter(
        (item) => item.id !== addressId,
      );

      await deleteDoc(
        doc(db, "artifacts", appId, "users", user.uid, "addresses", addressId),
      );

      if (
        addressToDelete?.isPrimary === true &&
        remainingAddresses.length > 0
      ) {
        await updateDoc(
          doc(
            db,
            "artifacts",
            appId,
            "users",
            user.uid,
            "addresses",
            remainingAddresses[0].id,
          ),
          { isPrimary: true },
        );
      }

      showToast("Endereço excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir endereço da conta:", error);
      showToast("Erro ao excluir endereço", "error");
    } finally {
      setIsDeletingAddressId("");
    }
  };

  const setAddressAsPrimary = async (addressId) => {
    if (!user?.uid || !addressId) return;

    const currentAddresses = Array.isArray(addresses) ? addresses : [];
    const alreadyPrimary = currentAddresses.some(
      (item) => item.id === addressId && item.isPrimary === true,
    );

    if (alreadyPrimary) return;

    setIsSettingPrimaryId(addressId);
    try {
      await Promise.all(
        currentAddresses.map((item) =>
          updateDoc(
            doc(
              db,
              "artifacts",
              appId,
              "users",
              user.uid,
              "addresses",
              item.id,
            ),
            { isPrimary: item.id === addressId },
          ),
        ),
      );
      showToast("Endereço principal atualizado!");
    } catch (error) {
      console.error("Erro ao definir endereço principal:", error);
      showToast("Erro ao definir endereço principal", "error");
    } finally {
      setIsSettingPrimaryId("");
    }
  };

  const startEditAddress = (address) => {
    if (!address?.id) return;

    setEditingAddressId(address.id);
    setEditAddressDraft({
      cep: String(address.cep || ""),
      rua: String(address.rua || ""),
      numero: String(address.numero || ""),
      complemento: String(address.complemento || ""),
      bairro: String(address.bairro || ""),
      cidade: String(address.cidade || ""),
      estado: String(address.estado || ""),
      recebedorNome: String(address.recebedorNome || ""),
      recebedorTelefone: String(address.recebedorTelefone || ""),
      recebedorCpf: String(address.recebedorCpf || ""),
    });
  };

  const cancelEditAddress = () => {
    setEditingAddressId("");
    setEditAddressDraft({
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      recebedorNome: "",
      recebedorTelefone: "",
      recebedorCpf: "",
    });
  };

  const saveEditedAddress = async (addressId) => {
    if (!user?.uid || !addressId) return;

    if (String(editAddressDraft.cep || "").replace(/\D/g, "").length !== 8) {
      return showToast("Digite um CEP válido com 8 dígitos", "error");
    }

    if (
      String(editAddressDraft.recebedorTelefone || "").replace(/\D/g, "")
        .length < 10
    ) {
      return showToast("Digite um telefone válido", "error");
    }

    setIsUpdatingAddress(true);
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "users", user.uid, "addresses", addressId),
        {
          ...editAddressDraft,
          estado: String(editAddressDraft.estado || "")
            .trim()
            .toUpperCase(),
          recebedorTelefone: maskPhone(editAddressDraft.recebedorTelefone),
        },
      );

      cancelEditAddress();
      showToast("Endereço atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar endereço da conta:", error);
      showToast("Erro ao atualizar endereço", "error");
    } finally {
      setIsUpdatingAddress(false);
    }
  };

  const pickupMapUrl = resolvePickupMapUrl(storeSettings?.pickupMapUrl);
  const pickupStoreAddress = normalizeStoreAddress(storeSettings?.storeAddress);
  const hasPickupStoreAddress = Boolean(
    pickupStoreAddress.rua ||
    pickupStoreAddress.numero ||
    pickupStoreAddress.bairro ||
    pickupStoreAddress.cidade ||
    pickupStoreAddress.estado ||
    pickupStoreAddress.cep,
  );

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
    aguardando_retirada: {
      label: "Aguardando Retirada",
      color: "bg-cyan-100 text-cyan-700",
    },
    enviado: { label: "Enviado", color: "bg-indigo-100 text-indigo-700" },
    entregue: { label: "Entregue", color: "bg-emerald-100 text-emerald-700" },
    pago: {
      label: "Pago",
      color: "bg-emerald-100 text-emerald-700",
    },
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

  const productRequestStatusCatalog = {
    produto_nao_encontrado: {
      label: "Produto não encontrado",
      color: "bg-amber-100 text-amber-700",
    },
    em_analise: {
      label: "Em análise",
      color: "bg-sky-100 text-sky-700",
    },
    link_disponivel: {
      label: "Link disponível",
      color: "bg-emerald-100 text-emerald-700",
    },
    nao_disponivel: {
      label: "Não disponível",
      color: "bg-slate-100 text-slate-700",
    },
  };

  const resolveOrderStatus = (order) => {
    if (order.status) return order.status;
    return order.type === "online" ? "pendente_pagamento" : "concluido";
  };

  const buildCheckoutItemsFromOrder = (order) => {
    const orderItems = Array.isArray(order?.items) ? order.items : [];
    const checkoutItems = orderItems
      .map((item) => ({
        title: String(
          item?.selectedPersonalizationLabel
            ? `${item?.name || "Item"} (${item.selectedPersonalizationLabel})`
            : item?.name || "Item",
        )
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

  const checkRetryPixPaymentStatus = useCallback(
    async ({ silent = false } = {}) => {
      if (!paymentModalOrder?.id || !retryPixData?.id) return false;

      if (!silent) setIsRetryPaymentChecking(true);
      try {
        const res = await fetch(
          buildApiUrl(
            `/api/payment-status?paymentId=${encodeURIComponent(String(retryPixData.id))}`,
          ),
        );
        const data = await res.json();

        if (!res.ok || !data?.status) {
          throw new Error(
            data?.error ||
              data?.providerMessage ||
              "Falha ao consultar o pagamento deste pedido.",
          );
        }

        const paymentStatus = String(data.status || "").toLowerCase();
        const payload = {
          paymentStatus,
          mpPaymentId:
            Number(data.paymentId || retryPixData.id) ||
            Number(retryPixData.id),
          lastPaymentCheckAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (paymentStatus === "approved") {
          payload.status = isPickupOrder(paymentModalOrder)
            ? "aguardando_retirada"
            : "pago";
          payload.paymentApprovedAt = serverTimestamp();
        }

        await updateDoc(
          doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "orders",
            paymentModalOrder.id,
          ),
          payload,
        );

        if (paymentStatus === "approved") {
          setRetryPaymentCheckLabel(
            "Pagamento confirmado. Pedido em preparação.",
          );
          showToast("Pagamento confirmado com sucesso!");

          if (!retryApprovedHandledRef.current) {
            retryApprovedHandledRef.current = true;
            markOpenAccountAfterReload();
            window.setTimeout(() => {
              window.location.reload();
            }, 5000);
          }

          return true;
        }

        if (data.isFinal) {
          setRetryPaymentCheckLabel(
            `Pagamento finalizado com status: ${paymentStatus}.`,
          );
        } else {
          setRetryPaymentCheckLabel(
            "Pagamento ainda pendente. Vamos atualizar automaticamente.",
          );
        }

        return false;
      } catch (error) {
        if (!silent) {
          showToast(error?.message || "Erro ao consultar pagamento", "error");
        }
        return false;
      } finally {
        if (!silent) setIsRetryPaymentChecking(false);
      }
    },
    [paymentModalOrder?.id, retryPixData?.id, showToast],
  );

  useEffect(() => {
    if (!paymentModalOrder?.id || !retryPixData?.id) return;

    let cancelled = false;
    let intervalId = null;

    const runCheck = async () => {
      const approved = await checkRetryPixPaymentStatus({ silent: true });
      if (approved || cancelled) {
        if (intervalId) window.clearInterval(intervalId);
      }
    };

    runCheck();
    intervalId = window.setInterval(runCheck, 5000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [paymentModalOrder?.id, retryPixData?.id, checkRetryPixPaymentStatus]);

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

    setPaymentModalOrder(order);
    setRetryPaymentMethod("");
    setRetryPixData(null);
    setRetryPaymentError("");
    setRetryPaymentCheckLabel("");
    retryApprovedHandledRef.current = false;
  };

  const closePaymentModal = () => {
    if (
      paymentModalOrder?.id &&
      processingOrderId &&
      processingOrderId === paymentModalOrder.id
    ) {
      return;
    }

    setPaymentModalOrder(null);
    setRetryPaymentMethod("");
    setRetryPixData(null);
    setRetryPaymentError("");
    setRetryPaymentCheckLabel("");
    retryApprovedHandledRef.current = false;
  };

  const submitRetryPayment = async () => {
    if (!paymentModalOrder?.id) return;

    const status = resolveOrderStatus(paymentModalOrder);
    if (
      paymentModalOrder.type !== "online" ||
      status !== "pendente_pagamento"
    ) {
      return showToast(
        "Este pedido não está elegível para novo pagamento.",
        "error",
      );
    }

    const items = buildCheckoutItemsFromOrder(paymentModalOrder);
    if (!items.length) {
      return showToast(
        "Não foi possível montar os itens do pagamento deste pedido.",
        "error",
      );
    }

    if (!retryPaymentMethod) {
      setRetryPaymentError("Selecione uma forma de pagamento para continuar.");
      return;
    }

    setRetryPaymentError("");
    setProcessingOrderId(paymentModalOrder.id);
    try {
      const baseExternalReference = `retry-${paymentModalOrder.id}-${Date.now()}`;

      if (retryPaymentMethod === "PIX") {
        const res = await fetch(buildApiUrl("/api/pix"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-idempotency-key": createIdempotencyKey("retry-pix"),
          },
          body: JSON.stringify({
            transaction_amount: Number(paymentModalOrder.total || 0),
            description: `Pagamento do pedido ${formatOrderDisplayId(paymentModalOrder)}`,
            external_reference: `${baseExternalReference}-pix`,
            payer: {
              email:
                paymentModalOrder.customerEmail ||
                user?.email ||
                "cliente@loja.com",
              first_name:
                paymentModalOrder.customerName ||
                userProfile?.firstName ||
                user?.email?.split("@")[0] ||
                "Cliente",
            },
          }),
        });

        const data = await res.json();
        if (!res.ok || !data?.qr_code_base64 || !data?.qr_code) {
          throw new Error(
            data?.error || data?.providerMessage || "Falha ao gerar PIX.",
          );
        }

        await updateDoc(
          doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "orders",
            paymentModalOrder.id,
          ),
          {
            mpPaymentId: data.id || null,
            mpExternalReference: `${baseExternalReference}-pix`,
            paymentMethod: "PIX",
            lastPaymentAttemptAt: serverTimestamp(),
            paymentRetryCount:
              Number(paymentModalOrder.paymentRetryCount || 0) + 1,
            updatedAt: serverTimestamp(),
          },
        );

        setRetryPixData(data);
        setRetryPaymentCheckLabel("Aguardando confirmação do PIX...");
        showToast("PIX gerado com sucesso para este pedido.");
        return;
      }

      const res = await fetch(buildApiUrl("/api/checkout/preference"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": createIdempotencyKey("retry-checkout"),
        },
        body: JSON.stringify({
          items,
          external_reference: `${baseExternalReference}-card`,
          payer: {
            email:
              paymentModalOrder.customerEmail ||
              user?.email ||
              "cliente@loja.com",
            first_name:
              paymentModalOrder.customerName ||
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
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "orders",
          paymentModalOrder.id,
        ),
        {
          mpPreferenceId: data.preferenceId || null,
          mpExternalReference: `${baseExternalReference}-card`,
          paymentMethod: "Cartão de Crédito",
          lastPaymentAttemptAt: serverTimestamp(),
          paymentRetryCount:
            Number(paymentModalOrder.paymentRetryCount || 0) + 1,
          updatedAt: serverTimestamp(),
        },
      );

      savePendingPaymentContext({
        orderId: paymentModalOrder.id,
        externalReference: `${baseExternalReference}-card`,
        paymentId: "",
        type: "CARD",
        shippingId: String(paymentModalOrder?.shipping?.id || ""),
        createdAt: Date.now(),
      });

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

    if (
      ![
        "pendente_pagamento",
        "pendente",
        "separacao",
        "aguardando_retirada",
      ].includes(status)
    ) {
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

    if (formData.cpf.trim() && !validateCpf(formData.cpf)) {
      return showToast("CPF inválido. Verifique o número informado.", "error");
    }

    setIsSaving(true);
    try {
      await syncCustomerIdentity(user, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone,
        cpf: formData.cpf.trim(),
        email: formData.email || user.email || "",
      });

      showToast("Dados atualizados com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar perfil do cliente:", error);
      showToast("Erro ao atualizar seus dados.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const normalizedMyOrdersSearchTerm =
    normalizeForSearch(myOrdersSearchTerm).trim();

  const filteredAccountOrders = useMemo(() => {
    if (!normalizedMyOrdersSearchTerm) return orders;

    return orders.filter((order) => {
      const number = normalizeForSearch(order?.orderNumber);
      const displayId = normalizeForSearch(formatOrderDisplayId(order));
      const legacyId = normalizeForSearch(order?.id);
      const dateLabel = order?.createdAt?.toMillis
        ? new Date(order.createdAt.toMillis()).toLocaleString("pt-BR")
        : "";
      const products = Array.isArray(order?.items)
        ? order.items.map((item) => normalizeForSearch(item?.name)).join(" ")
        : "";

      return [
        number,
        displayId,
        legacyId,
        normalizeForSearch(dateLabel),
        products,
      ].some((value) => value.includes(normalizedMyOrdersSearchTerm));
    });
  }, [orders, normalizedMyOrdersSearchTerm]);

  const filteredAccountProductRequests = useMemo(() => {
    if (!normalizedMyOrdersSearchTerm) return productRequests;

    return productRequests.filter((request) => {
      const createdAtLabel = request?.createdAt?.toMillis
        ? new Date(request.createdAt.toMillis()).toLocaleString("pt-BR")
        : "";

      return [
        request?.id,
        request?.productName,
        request?.category,
        request?.brand,
        request?.description,
        request?.requestedSearchTerm,
        createdAtLabel,
      ]
        .map((value) => normalizeForSearch(value))
        .some((value) => value.includes(normalizedMyOrdersSearchTerm));
    });
  }, [productRequests, normalizedMyOrdersSearchTerm]);

  const hasAccountRecords = orders.length > 0 || productRequests.length > 0;
  const hasFilteredAccountRecords =
    filteredAccountOrders.length > 0 ||
    filteredAccountProductRequests.length > 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-2 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-hidden print:hidden">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl max-h-[calc(100vh-1rem)] sm:max-h-[90vh] overflow-hidden animate-slide-up border border-slate-100 flex flex-col">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 flex-1 overflow-y-auto">
          <div className="p-5 md:p-6 border-b lg:border-b-0 lg:border-r border-slate-100 space-y-8">
            <div>
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
                    CPF
                  </label>
                  <div className="relative">
                    <input
                      value={formData.cpf}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          cpf: maskCpf(e.target.value),
                        }))
                      }
                      maxLength={14}
                      placeholder="000.000.000-00"
                      className={`w-full p-3 pr-10 border rounded-xl outline-none focus:ring-2 transition-all ${
                        !formData.cpf
                          ? "border-slate-200 focus:ring-indigo-500"
                          : validateCpf(formData.cpf)
                            ? "border-green-400 focus:ring-green-400"
                            : "border-red-400 focus:ring-red-400"
                      }`}
                    />
                    {formData.cpf && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        {validateCpf(formData.cpf) ? (
                          <CheckCircle2 size={18} className="text-green-500" />
                        ) : (
                          <XCircle size={18} className="text-red-400" />
                        )}
                      </span>
                    )}
                  </div>
                  {formData.cpf && !validateCpf(formData.cpf) && (
                    <p className="text-xs text-red-500 mt-1">CPF inválido</p>
                  )}
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
                  disabled={
                    isSaving || (!!formData.cpf && !validateCpf(formData.cpf))
                  }
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-bold transition"
                >
                  {isSaving ? "Salvando..." : "Salvar Dados"}
                </button>
              </form>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-slate-800">Meus Endereços</h3>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  {addresses.length} salvo(s)
                </span>
              </div>

              <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
                {addresses.length === 0 ? (
                  <div className="border border-slate-200 rounded-xl p-4 text-sm text-slate-500 bg-slate-50">
                    Você ainda não possui endereços salvos.
                  </div>
                ) : (
                  addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="border border-slate-200 rounded-xl p-4 bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {addr.recebedorNome || "Sem nome cadastrado"}
                          </p>
                          {addr.isPrimary === true && (
                            <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
                              Endereço principal
                            </span>
                          )}
                          <p className="text-xs text-slate-500 mt-1">
                            {addr.rua}, {addr.numero}
                            {addr.complemento ? ` - ${addr.complemento}` : ""}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {addr.bairro}, {addr.cidade}/{addr.estado} • CEP:{" "}
                            {addr.cep}
                          </p>
                          {addr.recebedorTelefone && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              Contato: {addr.recebedorTelefone}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          {addr.isPrimary !== true && (
                            <button
                              type="button"
                              onClick={() => setAddressAsPrimary(addr.id)}
                              disabled={isSettingPrimaryId === addr.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition disabled:opacity-50"
                            >
                              {isSettingPrimaryId === addr.id
                                ? "Salvando..."
                                : "Definir principal"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEditAddress(addr)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition"
                          >
                            <Edit size={13} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAccountAddress(addr.id)}
                            disabled={isDeletingAddressId === addr.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                            {isDeletingAddressId === addr.id
                              ? "Excluindo..."
                              : "Excluir"}
                          </button>
                        </div>
                      </div>

                      {editingAddressId === addr.id && (
                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                              placeholder="CEP"
                              maxLength={9}
                              value={editAddressDraft.cep}
                              onChange={(e) =>
                                setEditAddressDraft((prev) => ({
                                  ...prev,
                                  cep: maskCEP(e.target.value),
                                }))
                              }
                              className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <input
                              placeholder="Cidade"
                              value={editAddressDraft.cidade}
                              onChange={(e) =>
                                setEditAddressDraft((prev) => ({
                                  ...prev,
                                  cidade: e.target.value,
                                }))
                              }
                              className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <input
                              placeholder="Estado"
                              maxLength={2}
                              value={editAddressDraft.estado}
                              onChange={(e) =>
                                setEditAddressDraft((prev) => ({
                                  ...prev,
                                  estado: e.target.value.toUpperCase(),
                                }))
                              }
                              className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <input
                              placeholder="Bairro"
                              value={editAddressDraft.bairro}
                              onChange={(e) =>
                                setEditAddressDraft((prev) => ({
                                  ...prev,
                                  bairro: e.target.value,
                                }))
                              }
                              className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <input
                              placeholder="Rua"
                              value={editAddressDraft.rua}
                              onChange={(e) =>
                                setEditAddressDraft((prev) => ({
                                  ...prev,
                                  rua: e.target.value,
                                }))
                              }
                              className="sm:col-span-2 w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <input
                              placeholder="Número"
                              value={editAddressDraft.numero}
                              onChange={(e) =>
                                setEditAddressDraft((prev) => ({
                                  ...prev,
                                  numero: e.target.value,
                                }))
                              }
                              className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <input
                              placeholder="Complemento"
                              value={editAddressDraft.complemento}
                              onChange={(e) =>
                                setEditAddressDraft((prev) => ({
                                  ...prev,
                                  complemento: e.target.value,
                                }))
                              }
                              className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <input
                              placeholder="Recebedor"
                              value={editAddressDraft.recebedorNome}
                              onChange={(e) =>
                                setEditAddressDraft((prev) => ({
                                  ...prev,
                                  recebedorNome: e.target.value,
                                }))
                              }
                              className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <input
                              placeholder="Telefone"
                              maxLength={15}
                              value={editAddressDraft.recebedorTelefone}
                              onChange={(e) =>
                                setEditAddressDraft((prev) => ({
                                  ...prev,
                                  recebedorTelefone: maskPhone(e.target.value),
                                }))
                              }
                              className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <input
                              placeholder="CPF (000.000.000-00)"
                              maxLength={14}
                              value={editAddressDraft.recebedorCpf || ""}
                              onChange={(e) =>
                                setEditAddressDraft((prev) => ({
                                  ...prev,
                                  recebedorCpf: maskCpf(e.target.value),
                                }))
                              }
                              className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEditAddress}
                              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEditedAddress(addr.id)}
                              disabled={isUpdatingAddress}
                              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:bg-slate-300"
                            >
                              {isUpdatingAddress ? "Salvando..." : "Salvar"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsNewAddressFormOpen((prev) => !prev)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-100 transition"
                >
                  <div>
                    <h4 className="font-semibold text-sm text-slate-800">
                      Adicionar Novo Endereço
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Clique para{" "}
                      {isNewAddressFormOpen ? "recolher" : "expandir"} o
                      formulário
                    </p>
                  </div>
                  <ChevronRight
                    size={18}
                    className={`text-slate-500 transition-transform ${isNewAddressFormOpen ? "rotate-90" : ""}`}
                  />
                </button>

                {isNewAddressFormOpen && (
                  <form
                    onSubmit={saveAccountAddress}
                    className="p-4 border-t border-slate-200 space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          CEP
                        </label>
                        <input
                          required
                          placeholder="00000-000"
                          value={newAddress.cep}
                          onChange={handleAccountCepChange}
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
                          value={newAddress.cidade}
                          onChange={(e) =>
                            setNewAddress((prev) => ({
                              ...prev,
                              cidade: e.target.value,
                            }))
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
                          maxLength={2}
                          value={newAddress.estado}
                          onChange={(e) =>
                            setNewAddress((prev) => ({
                              ...prev,
                              estado: e.target.value.toUpperCase(),
                            }))
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
                          value={newAddress.bairro}
                          onChange={(e) =>
                            setNewAddress((prev) => ({
                              ...prev,
                              bairro: e.target.value,
                            }))
                          }
                          className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          Logradouro
                        </label>
                        <input
                          required
                          value={newAddress.rua}
                          onChange={(e) =>
                            setNewAddress((prev) => ({
                              ...prev,
                              rua: e.target.value,
                            }))
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
                          value={newAddress.numero}
                          onChange={(e) =>
                            setNewAddress((prev) => ({
                              ...prev,
                              numero: e.target.value,
                            }))
                          }
                          className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          Complemento
                        </label>
                        <input
                          value={newAddress.complemento}
                          onChange={(e) =>
                            setNewAddress((prev) => ({
                              ...prev,
                              complemento: e.target.value,
                            }))
                          }
                          className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          Nome do recebedor
                        </label>
                        <input
                          required
                          value={newAddress.recebedorNome}
                          onChange={(e) =>
                            setNewAddress((prev) => ({
                              ...prev,
                              recebedorNome: e.target.value,
                            }))
                          }
                          className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          Telefone
                        </label>
                        <input
                          required
                          maxLength={15}
                          value={newAddress.recebedorTelefone}
                          onChange={(e) =>
                            setNewAddress((prev) => ({
                              ...prev,
                              recebedorTelefone: maskPhone(e.target.value),
                            }))
                          }
                          className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          CPF do Recebedor
                        </label>
                        <input
                          maxLength={14}
                          placeholder="000.000.000-00"
                          value={newAddress.recebedorCpf || ""}
                          onChange={(e) =>
                            setNewAddress((prev) => ({
                              ...prev,
                              recebedorCpf: maskCpf(e.target.value),
                            }))
                          }
                          className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="submit"
                        disabled={isSavingAddress}
                        className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white py-3 rounded-xl font-bold transition"
                      >
                        {isSavingAddress
                          ? "Salvando..."
                          : "Salvar Novo Endereço"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsNewAddressFormOpen(false)}
                        className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-100 transition"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="font-bold text-slate-800">Meus Pedidos</h3>
              <input
                type="text"
                value={myOrdersSearchTerm}
                onChange={(e) => setMyOrdersSearchTerm(e.target.value)}
                placeholder="Buscar por número, data ou produto"
                className="w-full sm:w-[320px] p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {!hasAccountRecords && (
                <div className="border border-slate-200 rounded-xl p-4 text-sm text-slate-500 bg-slate-50">
                  Você ainda não possui pedidos registrados.
                </div>
              )}

              {hasAccountRecords && !hasFilteredAccountRecords && (
                <div className="border border-slate-200 rounded-xl p-4 text-sm text-slate-500 bg-slate-50">
                  Nenhum pedido encontrado para a busca informada.
                </div>
              )}

              {filteredAccountProductRequests.map((request) => {
                const requestStatusMeta =
                  productRequestStatusCatalog[request.status] ||
                  productRequestStatusCatalog.produto_nao_encontrado;

                return (
                  <div
                    key={request.id}
                    className="border border-amber-200 rounded-xl p-4 bg-amber-50/30"
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-400">Solicitação</p>
                        <p className="font-bold text-slate-800">
                          #{request.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${requestStatusMeta.color}`}
                      >
                        {requestStatusMeta.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-slate-400">Produto solicitado</p>
                        <p className="font-semibold text-slate-700">
                          {request.productName || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Categoria / Marca</p>
                        <p className="font-semibold text-slate-700">
                          {request.category || "—"}
                          {request.brand ? ` • ${request.brand}` : ""}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-slate-400">Descrição</p>
                        <p className="font-semibold text-slate-700 leading-relaxed">
                          {request.description || "Sem descrição."}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400">Data</p>
                        <p className="font-semibold text-slate-700">
                          {request.createdAt
                            ? new Date(
                                request.createdAt.toMillis(),
                              ).toLocaleString("pt-BR")
                            : "Recente"}
                        </p>
                      </div>
                    </div>

                    {(request.adminMessage || request.adminLink) && (
                      <div className="mt-3 pt-3 border-t border-amber-200 space-y-2">
                        {request.adminMessage && (
                          <p className="text-xs text-slate-700 rounded-lg bg-white p-2.5 border border-slate-200">
                            <strong>Resposta do admin:</strong>{" "}
                            {request.adminMessage}
                          </p>
                        )}

                        {request.adminLink && (
                          <a
                            href={request.adminLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
                          >
                            Ir para o produto indicado
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredAccountOrders.map((order) => {
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
                  [
                    "pendente_pagamento",
                    "pendente",
                    "separacao",
                    "aguardando_retirada",
                  ].includes(statusCode) &&
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
                          {formatOrderDisplayId(order)}
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
                        {isPickupOrder(order) ? (
                          <p className="font-semibold text-slate-700 break-all">
                            Retirada na loja
                          </p>
                        ) : (
                          <p className="font-semibold text-slate-700 break-all">
                            {order.trackingCode || "Aguardando postagem"}
                          </p>
                        )}
                        {isPickupOrder(order) && pickupMapUrl && (
                          <a
                            href={pickupMapUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-cyan-700 hover:text-cyan-800"
                          >
                            <MapPin size={12} /> Ver localização da loja
                          </a>
                        )}
                      </div>
                    </div>

                    {isPickupOrder(order) && (
                      <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 p-2.5 text-xs text-cyan-900">
                        <p className="font-bold">
                          Aguardando retirada na loja.
                        </p>
                        {hasPickupStoreAddress && (
                          <p className="mt-1 text-cyan-900 leading-relaxed">
                            {pickupStoreAddress.rua}
                            {pickupStoreAddress.numero
                              ? `, ${pickupStoreAddress.numero}`
                              : ""}
                            {pickupStoreAddress.complemento
                              ? ` - ${pickupStoreAddress.complemento}`
                              : ""}
                            {(pickupStoreAddress.bairro ||
                              pickupStoreAddress.cidade ||
                              pickupStoreAddress.estado ||
                              pickupStoreAddress.cep) && <br />}
                            {pickupStoreAddress.bairro}
                            {pickupStoreAddress.bairro &&
                            (pickupStoreAddress.cidade ||
                              pickupStoreAddress.estado)
                              ? ", "
                              : ""}
                            {pickupStoreAddress.cidade}
                            {pickupStoreAddress.estado
                              ? `/${pickupStoreAddress.estado}`
                              : ""}
                            {pickupStoreAddress.cep
                              ? ` - CEP: ${pickupStoreAddress.cep}`
                              : ""}
                          </p>
                        )}
                        {pickupMapUrl ? (
                          <a
                            href={pickupMapUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 mt-1 font-bold text-cyan-800 hover:text-cyan-900"
                          >
                            <MapPin size={12} /> Clique para abrir no mapa
                          </a>
                        ) : (
                          <p className="mt-1 text-cyan-800">
                            A localização da loja será disponibilizada em breve.
                          </p>
                        )}
                      </div>
                    )}

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
                              className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:bg-slate-300 cursor-pointer disabled:cursor-not-allowed"
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
                              className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer disabled:cursor-not-allowed"
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
                    {formatOrderDisplayId(cancelModalOrder)}.
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

      {paymentModalOrder && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-indigo-100 bg-white shadow-2xl overflow-hidden animate-slide-up">
            <div className="px-6 py-5 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 border-b border-indigo-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-xl font-black text-slate-800">
                    Realizar pagamento
                  </h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Pedido {formatOrderDisplayId(paymentModalOrder)} | Total: R${" "}
                    {Number(paymentModalOrder.total || 0).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={closePaymentModal}
                  disabled={processingOrderId === paymentModalOrder.id}
                  className="p-2 rounded-full hover:bg-slate-100 transition disabled:opacity-50"
                  aria-label="Fechar modal de pagamento"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRetryPaymentMethod("PIX");
                    setRetryPaymentError("");
                    setRetryPaymentCheckLabel("");
                  }}
                  className={`p-4 rounded-xl border text-left transition ${retryPaymentMethod === "PIX" ? "border-teal-500 bg-teal-50 ring-2 ring-teal-200" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <p className="font-bold text-slate-800 flex items-center gap-2">
                    <QrCode size={18} className="text-teal-600" /> PIX
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Gera QR Code e código Copia e cola na própria tela.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRetryPaymentMethod("CARD");
                    setRetryPaymentError("");
                    setRetryPaymentCheckLabel("");
                  }}
                  className={`p-4 rounded-xl border text-left transition ${retryPaymentMethod === "CARD" ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <p className="font-bold text-slate-800 flex items-center gap-2">
                    <CreditCard size={18} className="text-indigo-600" /> Cartão
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Redireciona para o checkout seguro do Mercado Pago.
                  </p>
                </button>
              </div>

              {retryPaymentError && (
                <div className="text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700 p-2">
                  {retryPaymentError}
                </div>
              )}

              {retryPixData && (
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 space-y-3">
                  <h5 className="font-black text-teal-800 flex items-center gap-2">
                    <QrCode size={18} /> PIX gerado
                  </h5>
                  <div className="flex justify-center">
                    <img
                      src={
                        retryPixData?.qr_code_base64?.startsWith("http")
                          ? retryPixData.qr_code_base64
                          : `data:image/jpeg;base64,${retryPixData?.qr_code_base64}`
                      }
                      className="w-44 h-44 rounded-xl bg-white object-contain border border-teal-100"
                      alt="QR Code PIX do pedido"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-teal-700 uppercase tracking-wider mb-1 block">
                      Código Copia e cola
                    </label>
                    <div className="flex">
                      <input
                        readOnly
                        value={retryPixData?.qr_code || ""}
                        className="flex-1 p-2.5 bg-white border border-teal-100 rounded-l-lg text-xs font-mono outline-none text-slate-600 truncate"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            retryPixData?.qr_code || "",
                          );
                          showToast("Código PIX copiado com sucesso!");
                        }}
                        className="bg-teal-600 text-white px-4 font-bold rounded-r-lg hover:bg-teal-700 transition"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-teal-900 font-semibold">
                      {retryPaymentCheckLabel ||
                        "Aguardando confirmação automática do pagamento."}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        checkRetryPixPaymentStatus({ silent: false })
                      }
                      disabled={isRetryPaymentChecking}
                      className="w-full py-2 rounded-lg bg-white border border-teal-200 text-teal-700 font-bold hover:bg-teal-100 disabled:opacity-50"
                    >
                      {isRetryPaymentChecking
                        ? "Verificando..."
                        : "Já paguei, verificar agora"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={closePaymentModal}
                disabled={processingOrderId === paymentModalOrder.id}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-50"
              >
                Fechar
              </button>
              <button
                onClick={submitRetryPayment}
                disabled={processingOrderId === paymentModalOrder.id}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 disabled:bg-slate-300"
              >
                {processingOrderId === paymentModalOrder.id
                  ? "Processando..."
                  : retryPaymentMethod === "PIX"
                    ? "Gerar PIX"
                    : "Continuar"}
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
  const personalization = normalizeProductPersonalization(product);
  const pickupAvailable = isProductPickupEligible(product);
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
  const [selectedPersonalization, setSelectedPersonalization] = useState({
    usePersonalization: false,
    name: "",
    number: "",
  });
  const [
    personalizationValidationVisible,
    setPersonalizationValidationVisible,
  ] = useState(false);
  const [isPersonalizationModalOpen, setIsPersonalizationModalOpen] =
    useState(false);
  const [isMobilePersonalizationFlow, setIsMobilePersonalizationFlow] =
    useState(() => {
      if (typeof window === "undefined") return false;
      return window.matchMedia("(max-width: 767px)").matches;
    });
  const [qty, setQty] = useState(1);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const media = window.matchMedia("(max-width: 767px)");
    const syncViewport = () =>
      setIsMobilePersonalizationFlow(Boolean(media.matches));

    syncViewport();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncViewport);
      return () => media.removeEventListener("change", syncViewport);
    }

    media.addListener(syncViewport);
    return () => media.removeListener(syncViewport);
  }, []);

  const selectedVariationLabel = variationGroups
    .map((group) => {
      const selected = selectedVariations[group.type] || "";
      return selected ? `${group.type}: ${selected}` : "";
    })
    .filter(Boolean)
    .join(" | ");

  const selectedPersonalizationLabel = getSelectedPersonalizationLabel(
    selectedPersonalization,
  );
  const personalizationPrice =
    selectedPersonalization.usePersonalization && personalization.enabled
      ? personalization.price
      : 0;
  const finalUnitPrice = Math.max(
    0,
    Number(product.price || 0) + personalizationPrice,
  );
  const missingPersonalizationFields = [];

  if (
    selectedPersonalization.usePersonalization &&
    personalization.allowName &&
    !String(selectedPersonalization.name || "").trim()
  ) {
    missingPersonalizationFields.push("nome");
  }

  if (
    selectedPersonalization.usePersonalization &&
    personalization.allowNumber &&
    !String(selectedPersonalization.number || "").trim()
  ) {
    missingPersonalizationFields.push("número");
  }

  const hasMissingPersonalizationFields =
    missingPersonalizationFields.length > 0;

  const handleAdd = () => {
    const hasMissingSelection = variationGroups.some(
      (group) => !selectedVariations[group.type],
    );

    if (hasMissingSelection) return;

    if (hasMissingPersonalizationFields) {
      setPersonalizationValidationVisible(true);
      if (
        isMobilePersonalizationFlow &&
        selectedPersonalization.usePersonalization
      ) {
        setIsPersonalizationModalOpen(true);
      }
      return;
    }

    const cartItemPayload = {
      ...product,
      selectedVariation: selectedVariationLabel,
      selectedVariationMap: selectedVariations,
      selectedPersonalization: normalizeSelectedPersonalization(
        selectedPersonalization,
      ),
      selectedPersonalizationLabel,
      personalizationPrice,
      basePrice: Number(product.price || 0),
      price: finalUnitPrice,
      image: images[0] || "",
    };

    cartItemPayload.cartItemId = buildCartItemId(cartItemPayload);

    addToCart(cartItemPayload, qty);
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
            {pickupAvailable && (
              <div className="inline-flex items-center mb-2 ml-2 px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 text-[11px] font-bold border border-cyan-200">
                Retirada na loja
              </div>
            )}
            {priceTag > 0 && (
              <div className="text-sm text-slate-400 line-through font-semibold mb-1">
                De {formatCurrencyBRL(priceTag)}
              </div>
            )}
            <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2 md:mb-3">
              {formatCurrencyBRL(finalUnitPrice)}
            </div>
            {personalization.enabled && (
              <p className="text-xs text-slate-500 font-medium mb-4 md:mb-6">
                {selectedPersonalization.usePersonalization
                  ? `Preço atualizado com personalização de ${formatCurrencyBRL(personalizationPrice)}.`
                  : "Marque a personalização para atualizar o valor do produto."}
              </p>
            )}

            {personalization.enabled && (
              <div className="mb-6 rounded-2xl border border-fuchsia-100 bg-fuchsia-50/70 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-fuchsia-800 uppercase tracking-wider">
                      Personalização opcional
                    </p>
                    <p className="text-xs text-fuchsia-700 mt-1">
                      Acrescente {formatCurrencyBRL(personalization.price)} ao
                      valor do produto para incluir personalização.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-bold text-fuchsia-800">
                    <input
                      type="checkbox"
                      checked={selectedPersonalization.usePersonalization}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setPersonalizationValidationVisible(false);
                        setSelectedPersonalization((prev) => ({
                          ...prev,
                          usePersonalization: checked,
                        }));

                        if (checked && isMobilePersonalizationFlow) {
                          setIsPersonalizationModalOpen(true);
                        }

                        if (!checked) {
                          setIsPersonalizationModalOpen(false);
                        }
                      }}
                      className="w-4 h-4 rounded border-fuchsia-300 text-fuchsia-600"
                    />
                    Adicionar
                  </label>
                </div>

                {selectedPersonalization.usePersonalization &&
                  isMobilePersonalizationFlow && (
                    <button
                      type="button"
                      onClick={() => setIsPersonalizationModalOpen(true)}
                      className="w-full rounded-xl border border-fuchsia-200 bg-white px-3 py-3 text-left"
                    >
                      <p className="text-xs font-black text-fuchsia-700 uppercase tracking-wider">
                        Configurar personalização
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Clique aqui para editar a personalização.
                      </p>
                      <p className="text-xs font-bold text-fuchsia-700 mt-2">
                        Valor extra: {formatCurrencyBRL(personalization.price)}
                      </p>
                    </button>
                  )}

                {selectedPersonalization.usePersonalization &&
                  !isMobilePersonalizationFlow && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {personalizationValidationVisible &&
                        hasMissingPersonalizationFields && (
                          <div className="sm:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 font-medium">
                            Preencha {missingPersonalizationFields.join(" e ")}{" "}
                            para continuar com a personalização.
                          </div>
                        )}

                      {personalization.allowName && (
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-black text-fuchsia-700 uppercase tracking-wider mb-1.5">
                            Nome para estampar
                          </label>
                          <input
                            type="text"
                            maxLength={20}
                            value={selectedPersonalization.name}
                            onChange={(e) => {
                              setSelectedPersonalization((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }));
                              setPersonalizationValidationVisible(false);
                            }}
                            placeholder="Ex: Breno"
                            className={`w-full p-3 border rounded-xl bg-white outline-none focus:ring-2 ${
                              personalizationValidationVisible &&
                              !String(selectedPersonalization.name || "").trim()
                                ? "border-rose-300 focus:ring-rose-200"
                                : "border-fuchsia-200 focus:ring-fuchsia-300"
                            }`}
                          />
                        </div>
                      )}

                      {personalization.allowNumber && (
                        <div>
                          <label className="block text-xs font-black text-fuchsia-700 uppercase tracking-wider mb-1.5">
                            Número
                          </label>
                          <input
                            type="text"
                            maxLength={3}
                            value={selectedPersonalization.number}
                            onChange={(e) => {
                              setSelectedPersonalization((prev) => ({
                                ...prev,
                                number: e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 3),
                              }));
                              setPersonalizationValidationVisible(false);
                            }}
                            placeholder="10"
                            className={`w-full p-3 border rounded-xl bg-white outline-none focus:ring-2 ${
                              personalizationValidationVisible &&
                              !String(
                                selectedPersonalization.number || "",
                              ).trim()
                                ? "border-rose-300 focus:ring-rose-200"
                                : "border-fuchsia-200 focus:ring-fuchsia-300"
                            }`}
                          />
                        </div>
                      )}

                      {personalization.details && (
                        <div className="sm:col-span-2 rounded-xl border border-fuchsia-100 bg-white px-3 py-2.5 text-xs text-fuchsia-700 leading-relaxed">
                          {personalization.details}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            )}

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
                  {formatCurrencyBRL(finalUnitPrice * qty)}
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
              className="w-full py-4 rounded-2xl font-bold text-lg text-white shadow-lg transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-500/30 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer"
            >
              <ShoppingBag size={22} />
              {hasStock ? "Adicionar ao Carrinho" : "Produto Esgotado"}
            </button>
            {personalizationValidationVisible &&
              hasMissingPersonalizationFields && (
                <p className="text-xs text-center text-rose-600 font-medium mt-2">
                  A personalização foi marcada, mas ainda faltam campos
                  obrigatórios.
                </p>
              )}
            {selectedPersonalization.usePersonalization &&
              personalizationPrice > 0 && (
                <p className="text-xs text-center text-slate-500 mt-2">
                  Valor com personalização: {formatCurrencyBRL(finalUnitPrice)}{" "}
                  por unidade.
                </p>
              )}
          </div>
        </div>
      </div>

      {isMobilePersonalizationFlow &&
        personalization.enabled &&
        selectedPersonalization.usePersonalization &&
        isPersonalizationModalOpen && (
          <div className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm">
            <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 max-h-[88dvh] overflow-hidden flex flex-col animate-slide-up">
              <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-fuchsia-700 uppercase tracking-wider">
                    Personalização
                  </p>
                  <h3 className="text-lg font-black text-slate-800 mt-0.5">
                    Configure seu item
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Extra de {formatCurrencyBRL(personalization.price)} por
                    unidade
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPersonalizationModalOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100"
                  aria-label="Fechar personalização"
                >
                  <X size={18} className="text-slate-600" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-3">
                {personalizationValidationVisible &&
                  hasMissingPersonalizationFields && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 font-medium">
                      Preencha {missingPersonalizationFields.join(" e ")} para
                      continuar com a personalização.
                    </div>
                  )}

                {personalization.allowName && (
                  <div>
                    <label className="block text-xs font-black text-fuchsia-700 uppercase tracking-wider mb-1.5">
                      Nome para estampar
                    </label>
                    <input
                      type="text"
                      maxLength={20}
                      value={selectedPersonalization.name}
                      onChange={(e) => {
                        setSelectedPersonalization((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }));
                        setPersonalizationValidationVisible(false);
                      }}
                      placeholder="Ex: Breno"
                      className={`w-full p-3 border rounded-xl bg-white outline-none focus:ring-2 ${
                        personalizationValidationVisible &&
                        !String(selectedPersonalization.name || "").trim()
                          ? "border-rose-300 focus:ring-rose-200"
                          : "border-fuchsia-200 focus:ring-fuchsia-300"
                      }`}
                    />
                  </div>
                )}

                {personalization.allowNumber && (
                  <div>
                    <label className="block text-xs font-black text-fuchsia-700 uppercase tracking-wider mb-1.5">
                      Número
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      value={selectedPersonalization.number}
                      onChange={(e) => {
                        setSelectedPersonalization((prev) => ({
                          ...prev,
                          number: e.target.value.replace(/\D/g, "").slice(0, 3),
                        }));
                        setPersonalizationValidationVisible(false);
                      }}
                      placeholder="10"
                      className={`w-full p-3 border rounded-xl bg-white outline-none focus:ring-2 ${
                        personalizationValidationVisible &&
                        !String(selectedPersonalization.number || "").trim()
                          ? "border-rose-300 focus:ring-rose-200"
                          : "border-fuchsia-200 focus:ring-fuchsia-300"
                      }`}
                    />
                  </div>
                )}

                {personalization.details && (
                  <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50 px-3 py-2.5 text-xs text-fuchsia-700 leading-relaxed">
                    {personalization.details}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-white">
                <button
                  type="button"
                  onClick={() => setIsPersonalizationModalOpen(false)}
                  className="w-full py-3 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold"
                >
                  Salvar personalização
                </button>
              </div>
            </div>
          </div>
        )}
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Novos campos para cadastro
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleGoogleLogin = async () => {
    try {
      setIsSubmitting(true);
      const userCredential = await signInWithPopup(auth, googleAuthProvider);
      await syncCustomerIdentity(userCredential.user);
      showToast("Login com Google realizado com sucesso!");
      close();
    } catch (error) {
      showToast(getFriendlyAuthErrorMessage(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const loggedInUser = userCredential.user;
        await syncCustomerIdentity(loggedInUser, { email });

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
        await syncCustomerIdentity(newUser, {
          firstName,
          lastName,
          phone,
          email,
        });

        showToast("Conta criada com sucesso!");
        close();
      }
    } catch (error) {
      showToast(getFriendlyAuthErrorMessage(error), "error");
    } finally {
      setIsSubmitting(false);
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
        <div className="p-6 border-b border-slate-100 space-y-3">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-3 p-3 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <GoogleBrandIcon />
            <span>Continuar com Google</span>
          </button>
          <p className="text-xs text-slate-500 text-center">
            Use sua conta Google para entrar ou criar o cadastro
            automaticamente.
          </p>
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
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
        disabled={isSubmitting}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3
        rounded-lg font-semibold transition disabled:opacity-60
        disabled:cursor-not-allowed"
        <div className="p-4 bg-slate-50 text-center text-sm rounded-b-2xl border-t">
          {isSubmitting ? "Processando..." : isLogin ? "Entrar" : "Criar Conta"}
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
                  {item.selectedPersonalizationLabel && (
                    <p className="text-xs text-fuchsia-700 font-medium mb-1">
                      Personalização: {item.selectedPersonalizationLabel}
                    </p>
                  )}
                  <p className="text-indigo-600 font-bold text-sm">
                    {formatCurrencyBRL(getCartItemUnitPrice(item))}
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
  products = [],
  user,
  userProfile,
  storeSettings,
  coupons = [],
  close,
  showToast,
  clearCart,
}) {
  const [step, setStep] = useState(1);
  const [addresses, setAddresses] = useState([]);
  const [isDeletingAddressId, setIsDeletingAddressId] = useState("");
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
    recebedorCpf: "",
  });
  const [shippingOption, setShippingOption] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixData, setPixData] = useState(null); // Recebe dados reais do PIX
  const [createdOrderId, setCreatedOrderId] = useState("");
  const [paymentCheckLabel, setPaymentCheckLabel] = useState("");
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupons, setAppliedCoupons] = useState([]);
  const [couponError, setCouponError] = useState("");
  const checkoutApprovedHandledRef = useRef(false);
  const pickupStoreAddress = normalizeStoreAddress(storeSettings?.storeAddress);
  const hasPickupStoreAddress = Boolean(
    pickupStoreAddress.rua ||
    pickupStoreAddress.numero ||
    pickupStoreAddress.bairro ||
    pickupStoreAddress.cidade ||
    pickupStoreAddress.estado ||
    pickupStoreAddress.cep,
  );

  // Fetch user addresses
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      collection(db, "artifacts", appId, "users", user.uid, "addresses"),
      (snap) => {
        const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAddresses(data);
        setSelectedAddress((prev) => {
          const primaryAddress = data.find((item) => item?.isPrimary === true);

          if (data.length === 0) return null;
          if (!prev) return primaryAddress || data[0];

          const updatedCurrent = data.find((item) => item.id === prev.id);
          return updatedCurrent || primaryAddress || data[0];
        });
      },
      (err) => console.error("Erro ao buscar endereços:", err),
    );
    return () => unsub();
  }, [user]);

  // Limpa o frete selecionado se o endereço mudar
  useEffect(() => {
    setShippingOption(null);
  }, [selectedAddress]);

  // Valida e aplica cupom
  const handleApplyCoupon = async () => {
    setCouponError("");
    const code = String(couponCode || "")
      .trim()
      .toUpperCase();

    if (!code) {
      setCouponError("Digite um código de cupom");
      return;
    }

    // Verifica se cupom já foi aplicado
    if (appliedCoupons.some((c) => c.code === code)) {
      setCouponError("Este cupom já foi aplicado");
      return;
    }

    const coupon = coupons.find(
      (c) => String(c.code || "").toUpperCase() === code && c.active !== false,
    );

    if (!coupon) {
      setCouponError("Cupom inválido ou desativado");
      return;
    }

    const now = new Date();
    if (coupon.expiryDate) {
      const expiry = new Date(coupon.expiryDate);
      if (now > expiry) {
        setCouponError("Cupom expirado");
        return;
      }
    }

    if (coupon.firstPurchaseOnly === true) {
      const normalizedEmail = String(user?.email || "")
        .trim()
        .toLowerCase();

      if (!normalizedEmail) {
        setCouponError(
          "Este cupom exige um cliente identificado com e-mail válido",
        );
        return;
      }

      try {
        const ordersSnapshot = await getDocs(
          collection(db, "artifacts", appId, "public", "data", "orders"),
        );

        const hasPreviousOrder = ordersSnapshot.docs.some((orderDoc) => {
          const orderData = orderDoc.data() || {};
          const orderEmail = String(
            orderData.customerEmailNormalized || orderData.customerEmail || "",
          )
            .trim()
            .toLowerCase();
          const orderStatus = String(orderData.status || "")
            .trim()
            .toLowerCase();

          if (!orderEmail || orderEmail !== normalizedEmail) return false;
          if (["cancelado", "cancelled"].includes(orderStatus)) return false;

          return true;
        });

        if (hasPreviousOrder) {
          setCouponError(
            "Este cupom vale apenas para a primeira compra deste e-mail",
          );
          return;
        }
      } catch (error) {
        console.error("Erro ao validar cupom de primeira compra:", error);
        setCouponError("Não foi possível validar a primeira compra agora");
        return;
      }
    }

    // Permite aplicar o cupom mesmo sem atingir o valor mínimo
    setAppliedCoupons((prev) => [...prev, coupon]);
    setCouponCode("");
    showToast("Cupom aplicado com sucesso!");
  };

  const handleRemoveCoupon = (couponCode) => {
    setAppliedCoupons((prev) => prev.filter((c) => c.code !== couponCode));
    setCouponError("");
  };

  const productPickupById = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          isProductPickupEligible(product),
        ]),
      ),
    [products],
  );

  const hasPickupEligibleItem = useMemo(
    () =>
      cart.some((item) => {
        if (isProductPickupEligible(item)) return true;

        const itemId = String(item?.id || "").trim();
        if (!itemId) return false;

        return Boolean(productPickupById.get(itemId));
      }),
    [cart, productPickupById],
  );

  const localCityCoverage = useMemo(
    () => findLocalCityCoverage(selectedAddress, storeSettings?.shipping),
    [selectedAddress, storeSettings?.shipping],
  );

  const isSelectedAddressLocalCoverage = Boolean(localCityCoverage);

  // Calcula as opções de frete baseadas no endereço e nas configurações
  const availableShipping = useMemo(() => {
    if (!selectedAddress) return [];
    const options = [];
    const config = storeSettings?.shipping || {};
    const separationDays = Number(config.separationDays) || 2;

    const fmtTime = (deliveryTime, unit = "dias úteis") => {
      const sep =
        separationDays === 1 ? "1 dia útil" : `${separationDays} dias úteis`;
      return `${sep} p/ separação + ${deliveryTime} ${unit} p/ entrega`;
    };

    if (
      config.pickupEnabled !== false &&
      hasPickupEligibleItem &&
      isSelectedAddressLocalCoverage
    ) {
      const pickupTime = config.pickupTime || "1 dia útil";
      options.push({
        id: "pickup",
        name: "Retirada na Loja",
        price: 0,
        time: `Disponível em ${pickupTime}`,
        separationInfo: `Prazo para retirada: ${pickupTime} após confirmação do pagamento`,
        icon: <Store size={20} />,
      });
    }

    if (selectedAddress.cidade && selectedAddress.estado) {
      if (localCityCoverage && hasPickupEligibleItem) {
        const localTime = config.localDeliveryTime || "mesmo dia";
        options.push({
          id: "local",
          name: "Entrega Expressa (Motoboy/App)",
          price: Number(localCityCoverage.rate),
          time: fmtTime(localTime, "").replace(
            " p/ entrega",
            " p/ entrega local",
          ),
          separationInfo: `${separationDays} dia(s) útil(is) para separação/postagem, entrega ${localTime}`,
          icon: <Truck size={20} />,
        });
      } else {
        if (config.pacEnabled !== false) {
          const pacRate = Number(config.pacRate) || 25;
          const pacDays = config.pacDeliveryDays || "5 a 10";
          options.push({
            id: "correios_pac",
            name: "Correios (PAC)",
            price: pacRate,
            time: fmtTime(pacDays),
            separationInfo: `${separationDays} dia(s) útil(is) para separação/postagem + ${pacDays} dias úteis para entrega pelos Correios`,
            icon: <Package size={20} />,
          });
        }
        if (config.sedexEnabled !== false) {
          const sedexRate = Number(config.sedexRate) || 37.5;
          const sedexDays = config.sedexDeliveryDays || "2 a 4";
          options.push({
            id: "correios_sedex",
            name: "Correios (Sedex)",
            price: sedexRate,
            time: fmtTime(sedexDays),
            separationInfo: `${separationDays} dia(s) útil(is) para separação/postagem + ${sedexDays} dias úteis para entrega pelos Correios`,
            icon: <Package size={20} />,
          });
        }
      }
    }
    return options;
  }, [
    selectedAddress,
    storeSettings,
    hasPickupEligibleItem,
    localCityCoverage,
    isSelectedAddressLocalCoverage,
  ]);

  useEffect(() => {
    if (!shippingOption) return;

    const currentOptionStillAvailable = availableShipping.some(
      (option) => option.id === shippingOption.id,
    );

    if (!currentOptionStillAvailable) {
      setShippingOption(null);
    }
  }, [availableShipping, shippingOption]);

  const checkPixPaymentStatus = useCallback(
    async ({ silent = false } = {}) => {
      if (!pixData?.id || !createdOrderId) return false;

      if (!silent) setIsCheckingPayment(true);
      try {
        const res = await fetch(
          buildApiUrl(
            `/api/payment-status?paymentId=${encodeURIComponent(String(pixData.id))}`,
          ),
        );
        const data = await res.json();

        if (!res.ok || !data?.status) {
          throw new Error(
            data?.error ||
              data?.providerMessage ||
              "Falha ao consultar o pagamento PIX.",
          );
        }

        const paymentStatus = String(data.status || "").toLowerCase();
        const payload = {
          paymentStatus,
          mpPaymentId:
            Number(data.paymentId || pixData.id) || Number(pixData.id),
          lastPaymentCheckAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (paymentStatus === "approved") {
          payload.status =
            shippingOption?.id === "pickup" ? "aguardando_retirada" : "pago";
          payload.paymentApprovedAt = serverTimestamp();
        }

        await updateDoc(
          doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "orders",
            createdOrderId,
          ),
          payload,
        );

        if (paymentStatus === "approved") {
          setPaymentCheckLabel("Pagamento confirmado. Pedido em preparação.");
          showToast("Pagamento PIX confirmado com sucesso!");

          if (!checkoutApprovedHandledRef.current) {
            checkoutApprovedHandledRef.current = true;
            markOpenAccountAfterReload();
            window.setTimeout(() => {
              window.location.reload();
            }, 5000);
          }

          return true;
        }

        if (data.isFinal) {
          setPaymentCheckLabel(
            `Pagamento finalizado com status: ${paymentStatus}.`,
          );
        } else {
          setPaymentCheckLabel(
            "Pagamento ainda pendente. Vamos atualizar automaticamente.",
          );
        }

        return false;
      } catch (error) {
        if (!silent) {
          showToast(
            error?.message || "Erro ao consultar pagamento PIX",
            "error",
          );
        }
        return false;
      } finally {
        if (!silent) setIsCheckingPayment(false);
      }
    },
    [pixData?.id, createdOrderId, showToast],
  );

  useEffect(() => {
    if (
      step !== 4 ||
      paymentMethod !== "PIX" ||
      !pixData?.id ||
      !createdOrderId
    ) {
      return;
    }

    let cancelled = false;
    let intervalId = null;

    const runCheck = async () => {
      const approved = await checkPixPaymentStatus({ silent: true });
      if (approved || cancelled) {
        if (intervalId) window.clearInterval(intervalId);
      }
    };

    runCheck();
    intervalId = window.setInterval(runCheck, 5000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [step, paymentMethod, pixData?.id, createdOrderId, checkPixPaymentStatus]);

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
      const hasSavedAddress = (addresses || []).length > 0;
      const docRef = await addDoc(
        collection(db, "artifacts", appId, "users", user.uid, "addresses"),
        {
          ...newAddress,
          isPrimary: !hasSavedAddress,
        },
      );
      setSelectedAddress({
        id: docRef.id,
        ...newAddress,
        isPrimary: !hasSavedAddress,
      });
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
        recebedorCpf: "",
      });
      showToast("Endereço salvo com sucesso!");
    } catch (error) {
      showToast("Erro ao salvar endereço", "error");
    }
  };

  const deleteAddress = async (addressId) => {
    if (!user?.uid || !addressId) return;

    const currentAddresses = Array.isArray(addresses) ? addresses : [];
    if (currentAddresses.length <= 1) {
      showToast(
        "Cadastre outro endereço antes de excluir o único salvo.",
        "error",
      );
      return;
    }

    setIsDeletingAddressId(addressId);
    try {
      const addressToDelete = currentAddresses.find(
        (item) => item.id === addressId,
      );
      const remainingAddresses = currentAddresses.filter(
        (item) => item.id !== addressId,
      );

      await deleteDoc(
        doc(db, "artifacts", appId, "users", user.uid, "addresses", addressId),
      );

      if (
        addressToDelete?.isPrimary === true &&
        remainingAddresses.length > 0
      ) {
        const nextPrimary = remainingAddresses[0];
        await updateDoc(
          doc(
            db,
            "artifacts",
            appId,
            "users",
            user.uid,
            "addresses",
            nextPrimary.id,
          ),
          { isPrimary: true },
        );
      }

      showToast("Endereço excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir endereço:", error);
      showToast("Erro ao excluir endereço", "error");
    } finally {
      setIsDeletingAddressId("");
    }
  };

  const shippingCost = shippingOption?.price || 0;

  // Constrói array com detalhes de cada cupom aplicado
  const couponDetails = appliedCoupons.map((coupon) => {
    // Base de cálculo: se o cupom tem restrição de produtos, usa só os itens elegíveis
    const hasProductRestriction =
      Array.isArray(coupon.restrictedProductIds) &&
      coupon.restrictedProductIds.length > 0;

    const eligibleCartTotal = hasProductRestriction
      ? cart.reduce((sum, item) => {
          if (coupon.restrictedProductIds.includes(item.id)) {
            const qty = Number(item.qty) || 1;
            const price =
              typeof item.salePrice === "number" && item.salePrice > 0
                ? item.salePrice
                : Number(item.price) || 0;
            return sum + price * qty;
          }
          return sum;
        }, 0)
      : cartTotal;

    const couponMinPurchase = coupon.minOrderValue
      ? Number(coupon.minOrderValue)
      : null;
    const isCouponEligible =
      !couponMinPurchase || cartTotal >= couponMinPurchase;
    const couponMinimumGap = couponMinPurchase
      ? Math.max(0, couponMinPurchase - cartTotal)
      : 0;

    let discountAmount = 0;
    let shippingDiscountAmount = 0;

    if (isCouponEligible) {
      // Desconto em produtos (aplicado sobre a base elegível)
      if (coupon.type === "percent" || coupon.type === "percentage") {
        discountAmount = (eligibleCartTotal * coupon.value) / 100;
      } else if (coupon.type === "fixed") {
        discountAmount = Math.min(coupon.value, eligibleCartTotal);
      }

      // Desconto em frete
      if (coupon.type === "shipping_percent") {
        shippingDiscountAmount = (shippingCost * coupon.value) / 100;
      } else if (coupon.type === "shipping_fixed") {
        shippingDiscountAmount = Math.min(coupon.value, shippingCost);
      } else if (coupon.type === "free_shipping") {
        shippingDiscountAmount = shippingCost;
      }
    }

    return {
      code: coupon.code,
      value: coupon.value,
      type: coupon.type,
      couponMinPurchase,
      isCouponEligible,
      couponMinimumGap,
      discountAmount,
      shippingDiscountAmount,
      hasProductRestriction,
      eligibleCartTotal,
    };
  });

  // Calcula descontos totais somando cupons elegíveis
  const totalDiscountAmount = couponDetails.reduce(
    (sum, detail) =>
      sum + (detail.isCouponEligible ? detail.discountAmount : 0),
    0,
  );

  const totalShippingDiscount = couponDetails.reduce(
    (sum, detail) =>
      sum + (detail.isCouponEligible ? detail.shippingDiscountAmount : 0),
    0,
  );

  // Desconto aplicado ao subtotal e ao frete separadamente
  const finalShippingCost = Math.max(0, shippingCost - totalShippingDiscount);
  const finalTotal = Math.max(
    0,
    cartTotal - totalDiscountAmount + finalShippingCost,
  );

  const finalizeOrder = async () => {
    if (!selectedAddress || !paymentMethod || !shippingOption)
      return showToast("Preencha todos os dados e frete", "error");

    setIsProcessing(true);
    setCreatedOrderId("");
    setPaymentCheckLabel("");
    checkoutApprovedHandledRef.current = false;

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
        price: getCartItemUnitPrice(item),
        basePrice: Number(item.basePrice || item.price || 0),
        personalizationPrice: getCartItemPersonalizationPrice(item),
        qty: item.qty || 1,
        selectedVariation: item.selectedVariation || null,
        selectedPersonalization: normalizeSelectedPersonalization(
          item.selectedPersonalization,
        ),
        selectedPersonalizationLabel:
          item.selectedPersonalizationLabel ||
          getSelectedPersonalizationLabel(item.selectedPersonalization),
        image: item.images?.[0] || item.image || null,
        stock: item.stock || 0,
        allowPickup: isProductPickupEligible(item),
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
        recebedorCpf: selectedAddress.recebedorCpf || userProfile?.cpf || "",
      };

      const customerName =
        cleanAddress.recebedorNome?.trim() ||
        user.displayName?.trim() ||
        user.email?.split("@")[0] ||
        "Cliente Online";
      const customerPhone = cleanAddress.recebedorTelefone?.trim() || "N/A";
      const normalizedCustomerEmail = String(user.email || "")
        .trim()
        .toLowerCase();

      const order = {
        type: "online",
        customerId: user.uid,
        customerEmail: user.email || "N/A",
        customerEmailNormalized: normalizedCustomerEmail,
        customerName,
        customerPhone,
        items: cleanCart,
        subtotal: cartTotal,
        shipping: cleanShipping,
        discountAmount: totalDiscountAmount,
        shippingDiscount: totalShippingDiscount,
        appliedCoupons: appliedCoupons.map((c) => ({
          code: c.code,
          value: c.value,
          type: c.type,
          firstPurchaseOnly: c.firstPurchaseOnly === true,
        })),
        total: finalTotal,
        address: cleanAddress,
        paymentMethod: paymentMethod,
        status: "pendente_pagamento",
        createdAt: serverTimestamp(),
        orderNumber: await generateNextOrderNumber(),
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
        setPaymentCheckLabel("Aguardando confirmação do PIX...");
      } else {
        const checkoutItems = [
          ...cleanCart.map((item) => ({
            title: item.selectedPersonalizationLabel
              ? `${item.name} (${item.selectedPersonalizationLabel})`
              : item.name,
            quantity: Number(item.qty),
            unit_price: Number(item.price),
          })),
        ];

        if (Number(cleanShipping.price || 0) > 0) {
          checkoutItems.push({
            title: `Frete - ${cleanShipping.name}`,
            quantity: 1,
            unit_price: Number(cleanShipping.price || 0),
          });
        }

        const res = await fetch(buildApiUrl("/api/checkout/preference"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-idempotency-key": createIdempotencyKey("online-checkout"),
          },
          body: JSON.stringify({
            items: checkoutItems,
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

        const createdOrder = await addDoc(
          collection(db, "artifacts", appId, "public", "data", "orders"),
          order,
        );

        savePendingPaymentContext({
          orderId: createdOrder.id,
          externalReference,
          paymentId: "",
          type: "CARD",
          shippingId: cleanShipping.id,
          createdAt: Date.now(),
        });

        clearCart();
        showToast("Redirecionando para o checkout seguro do Mercado Pago...");
        window.location.href = checkoutUrl;
        return;
      }

      // 3. Gravar no banco de dados Firebase
      const createdOrder = await addDoc(
        collection(db, "artifacts", appId, "public", "data", "orders"),
        order,
      );
      setCreatedOrderId(createdOrder.id);

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
                          <div className="pr-3">
                            <p className="font-semibold text-slate-800">
                              {addr.recebedorNome || "Sem nome cadastrado"}
                            </p>
                            {addr.isPrimary === true && (
                              <span className="inline-flex mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                Principal
                              </span>
                            )}
                            <span className="inline-flex mt-1 text-xs text-slate-400 bg-slate-200 px-2 py-1 rounded">
                              {addr.cidade}/{addr.estado}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              deleteAddress(addr.id);
                            }}
                            disabled={isDeletingAddressId === addr.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                            {isDeletingAddressId === addr.id
                              ? "Excluindo..."
                              : "Excluir"}
                          </button>
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
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      CPF do Recebedor
                    </label>
                    <input
                      maxLength={14}
                      placeholder={
                        userProfile?.cpf ? userProfile.cpf : "000.000.000-00"
                      }
                      value={newAddress.recebedorCpf || ""}
                      onChange={(e) =>
                        setNewAddress({
                          ...newAddress,
                          recebedorCpf: maskCpf(e.target.value),
                        })
                      }
                      className="w-full p-3 border rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                    />
                    {userProfile?.cpf && !newAddress.recebedorCpf && (
                      <p className="text-xs text-slate-400 mt-1">
                        Deixe em branco para usar o CPF do seu cadastro (
                        {userProfile.cpf})
                      </p>
                    )}
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

                  {/* Informativo de prazo ao selecionar opção */}
                  {shippingOption && shippingOption.separationInfo && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 items-start text-amber-800">
                      <span className="text-lg leading-none">⏱</span>
                      <div className="text-xs leading-relaxed">
                        <strong className="block mb-0.5">
                          Prazo estimado para recebimento:
                        </strong>
                        {shippingOption.separationInfo}
                        <span className="block mt-1 text-amber-600 font-semibold">
                          Os prazos são contados a partir da confirmação do
                          pagamento, em dias úteis.
                        </span>
                      </div>
                    </div>
                  )}

                  {availableShipping.length === 0 && (
                    <p className="text-sm text-rose-500">
                      Nenhuma opção de frete disponível para este endereço.
                    </p>
                  )}
                  {hasPickupEligibleItem && !isSelectedAddressLocalCoverage && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                      Retirada na loja só aparece para endereços em cidades
                      locais configuradas no admin.
                    </p>
                  )}
                </div>

                {shippingOption?.id === "pickup" &&
                  resolvePickupMapUrl(storeSettings?.pickupMapUrl) && (
                    <a
                      href={resolvePickupMapUrl(storeSettings?.pickupMapUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-bold text-cyan-700 hover:text-cyan-800"
                    >
                      <MapPin size={16} /> Ver localização da loja no mapa
                    </a>
                  )}

                {shippingOption?.id === "pickup" && hasPickupStoreAddress && (
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">
                    <p className="font-bold mb-1">Endereço para retirada:</p>
                    <p className="leading-relaxed">
                      {pickupStoreAddress.rua}
                      {pickupStoreAddress.numero
                        ? `, ${pickupStoreAddress.numero}`
                        : ""}
                      {pickupStoreAddress.complemento
                        ? ` - ${pickupStoreAddress.complemento}`
                        : ""}
                      {(pickupStoreAddress.bairro ||
                        pickupStoreAddress.cidade ||
                        pickupStoreAddress.estado ||
                        pickupStoreAddress.cep) && <br />}
                      {pickupStoreAddress.bairro}
                      {pickupStoreAddress.bairro &&
                      (pickupStoreAddress.cidade || pickupStoreAddress.estado)
                        ? ", "
                        : ""}
                      {pickupStoreAddress.cidade}
                      {pickupStoreAddress.estado
                        ? `/${pickupStoreAddress.estado}`
                        : ""}
                      {pickupStoreAddress.cep
                        ? ` - CEP: ${pickupStoreAddress.cep}`
                        : ""}
                    </p>
                  </div>
                )}
              </div>

              <h3 className="text-lg font-bold flex items-center gap-2 mt-6">
                <Package size={20} /> Resumo do Pedido
              </h3>
              <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-3">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Cupom de Desconto
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Digite o código do cupom"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponError("");
                      }}
                      className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={handleApplyCoupon}
                      className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition disabled:bg-slate-300"
                      disabled={!couponCode.trim()}
                    >
                      Aplicar
                    </button>
                  </div>

                  {/* Lista de cupons aplicados */}
                  {appliedCoupons.length > 0 && (
                    <div className="space-y-2">
                      {couponDetails.map((detail, idx) => (
                        <div
                          key={appliedCoupons[idx]?.code}
                          className={`px-3 py-2 rounded-lg border text-sm font-medium flex justify-between items-start gap-2 ${
                            detail.isCouponEligible
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                          }`}
                        >
                          <div className="flex-1">
                            <div>
                              {detail.isCouponEligible
                                ? `✓ Cupom ${detail.code} aplicado!`
                                : `ⓘ Cupom ${detail.code} aplicado`}
                            </div>
                            {!detail.isCouponEligible &&
                              detail.couponMinPurchase && (
                                <div className="space-y-1 mt-1">
                                  <div className="text-xs">
                                    Subtotal: R$ {cartTotal.toFixed(2)}
                                  </div>
                                  <div className="text-xs">
                                    Mínimo: R${" "}
                                    {detail.couponMinPurchase.toFixed(2)}
                                  </div>
                                  <div className="text-xs font-bold">
                                    Faltam R${" "}
                                    {detail.couponMinimumGap.toFixed(2)} para
                                    ativar o desconto de{" "}
                                    {detail.type === "percent" ||
                                    detail.type === "percentage"
                                      ? `${detail.value}%`
                                      : `R$ ${detail.value}`}
                                  </div>
                                </div>
                              )}
                            {detail.isCouponEligible && (
                              <div className="text-xs mt-1 space-y-1">
                                {detail.discountAmount > 0 && (
                                  <div>
                                    Desconto nos Produtos: R${" "}
                                    {detail.discountAmount.toFixed(2)}
                                  </div>
                                )}
                                {detail.shippingDiscountAmount > 0 && (
                                  <div>
                                    Desconto (Frete): R${" "}
                                    {detail.shippingDiscountAmount.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveCoupon(detail.code)}
                            className="px-2 py-1 rounded text-xs font-bold hover:opacity-70 transition"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {couponError && (
                    <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800 font-medium">
                      {couponError}
                    </div>
                  )}
                </div>
              </div>
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
                        {item.selectedPersonalizationLabel && (
                          <span className="text-xs text-fuchsia-700">
                            Personalização: {item.selectedPersonalizationLabel}
                            {getCartItemPersonalizationPrice(item) > 0
                              ? ` (+${formatCurrencyBRL(getCartItemPersonalizationPrice(item))})`
                              : ""}
                          </span>
                        )}
                      </div>
                    </span>
                    <span className="font-medium">
                      {formatCurrencyBRL(getCartItemTotalPrice(item))}
                    </span>
                  </div>
                ))}

                <div className="border-t pt-4 mt-2 space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal dos Produtos</span>
                    <span>R$ {cartTotal.toFixed(2)}</span>
                  </div>
                  {totalDiscountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Desconto nos Produtos</span>
                      <span>-R$ {totalDiscountAmount.toFixed(2)}</span>
                    </div>
                  )}
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
                  {totalShippingDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Desconto (Frete)</span>
                      <span>-R$ {totalShippingDiscount.toFixed(2)}</span>
                    </div>
                  )}
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

                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-slate-600 font-semibold">
                      {paymentCheckLabel ||
                        "Aguardando confirmação automática do pagamento."}
                    </p>
                    <button
                      type="button"
                      onClick={() => checkPixPaymentStatus({ silent: false })}
                      disabled={isCheckingPayment}
                      className="w-full py-2.5 rounded-lg border border-teal-200 text-teal-700 font-bold hover:bg-teal-50 disabled:opacity-50"
                    >
                      {isCheckingPayment
                        ? "Verificando..."
                        : "Já paguei, verificar agora"}
                    </button>
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
  productInterestLeads,
  productNotFoundRequests,
  customerFeedbacks,
  coupons,
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
    { id: "leads", name: "Interesse em Produtos", icon: <Eye size={20} /> },
    {
      id: "notFoundRequests",
      name: "Não Encontrados",
      icon: <AlertTriangle size={20} />,
    },
    { id: "feedbacks", name: "Feedbacks", icon: <MessageCircle size={20} /> },
    { id: "coupons", name: "Cupons", icon: <Tag size={20} /> },
    { id: "settings", name: "Configurações", icon: <Settings size={20} /> },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-36px)] print:bg-white print:h-auto">
      {/* Mobile Nav Header */}
      <div className="md:hidden bg-slate-800 text-white p-4 flex justify-between items-center relative z-30 shadow-md print:hidden">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Store size={20} /> Gestão Loja
        </h2>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 cursor-pointer"
        >
          <LayoutDashboard size={24} />
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[5] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${isMobileMenuOpen ? "fixed inset-0 md:relative" : "hidden"} md:block w-full md:w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex-shrink-0 flex flex-col z-20 md:sticky md:top-[36px] md:h-[calc(100vh-36px)] overflow-y-auto print:hidden shadow-2xl relative`}
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
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 cursor-pointer ${activeTab === tab.id ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 font-bold scale-[1.02]" : "hover:bg-slate-800 hover:text-white font-medium hover:scale-[1.02]"}`}
            >
              {tab.icon}
              <span className="font-medium flex-1 text-left">{tab.name}</span>
              {tab.id === "carts" && abandonedCarts.length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {abandonedCarts.length}
                </span>
              )}
              {tab.id === "leads" && productInterestLeads.length > 0 && (
                <span className="bg-cyan-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {productInterestLeads.length}
                </span>
              )}
              {tab.id === "notFoundRequests" &&
                productNotFoundRequests.filter(
                  (r) =>
                    (r.status || "produto_nao_encontrado") !==
                    "link_disponivel",
                ).length > 0 && (
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {
                      productNotFoundRequests.filter(
                        (r) =>
                          (r.status || "produto_nao_encontrado") !==
                          "link_disponivel",
                      ).length
                    }
                  </span>
                )}
              {tab.id === "feedbacks" &&
                customerFeedbacks.filter(
                  (item) => String(item?.status || "pending") === "pending",
                ).length > 0 && (
                  <span className="bg-fuchsia-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {
                      customerFeedbacks.filter(
                        (item) =>
                          String(item?.status || "pending") === "pending",
                      ).length
                    }
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800 relative z-10">
          <button
            onClick={onAdminLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white font-bold transition-all cursor-pointer"
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
              storeSettings={storeSettings}
              quickFilter={ordersQuickFilter}
            />
          )}
        </div>
        <div className={activeTab !== "carts" ? "print:hidden" : ""}>
          {activeTab === "carts" && (
            <AbandonedCartsList carts={abandonedCarts} showToast={showToast} />
          )}
        </div>
        <div className={activeTab !== "leads" ? "print:hidden" : ""}>
          {activeTab === "leads" && (
            <ProductInterestLeads
              leads={productInterestLeads}
              showToast={showToast}
            />
          )}
        </div>
        <div className={activeTab !== "notFoundRequests" ? "print:hidden" : ""}>
          {activeTab === "notFoundRequests" && (
            <ProductNotFoundRequestsList
              requests={productNotFoundRequests}
              showToast={showToast}
              storeSettings={storeSettings}
            />
          )}
        </div>
        <div className={activeTab !== "feedbacks" ? "print:hidden" : ""}>
          {activeTab === "feedbacks" && (
            <CustomerFeedbackModerationList
              feedbacks={customerFeedbacks}
              showToast={showToast}
            />
          )}
        </div>
        <div className={activeTab !== "coupons" ? "print:hidden" : ""}>
          {activeTab === "coupons" && (
            <CouponManager
              coupons={coupons}
              showToast={showToast}
              products={products}
            />
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

  const paidOrders = orders.filter((order) => {
    const status = resolveOrderStatus(order);
    return status !== "estornado" && status !== "cancelado";
  });

  const totalRevenue = paidOrders.reduce(
    (sum, order) => sum + (Number(order.total) || 0),
    0,
  );

  const totalCosts = paidOrders.reduce((sum, order) => {
    const rawCost =
      order?.cost !== undefined && order?.cost !== null
        ? order.cost
        : order?.orderCost;
    return sum + (Number(rawCost) || 0);
  }, 0);

  const netProfit = totalRevenue - totalCosts;

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
          title="Custos"
          value={`R$ ${totalCosts.toFixed(2)}`}
          icon={<CreditCard size={24} />}
          color="bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/30"
        />
        <StatCard
          title="Lucro Líquido"
          value={`R$ ${netProfit.toFixed(2)}`}
          icon={<CheckCircle2 size={24} />}
          color={
            netProfit >= 0
              ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30"
              : "bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/30"
          }
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
          color="bg-gradient-to-br from-cyan-400 to-sky-500 shadow-sky-500/30"
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
  const [productToDelete, setProductToDelete] = useState(null);
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [selectedSizeTableId, setSelectedSizeTableId] = useState("");
  const itemsPerPage = 20;
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
    allowPickup: false,
    images: [],
    variations: "",
    variationsByType: {},
    personalization: {
      enabled: false,
      price: "",
      allowName: false,
      allowNumber: false,
      details: "",
    },
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
    const query = normalizeForSearch(productSearch).trim();

    return products.filter((product) => {
      const category = String(product?.category || "").trim();
      const name = normalizeForSearch(product?.name);
      const subcategory = normalizeForSearch(product?.subcategory);
      const subsubcategory = normalizeForSearch(product?.subsubcategory);
      const stock = Number(product?.stock || 0);

      const matchesQuery =
        !query ||
        name.includes(query) ||
        normalizeForSearch(category).includes(query) ||
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
  const availableSizeTables = productCatalog.sizeTables || [];

  useEffect(() => {
    if (availableSizeTables.length === 0) {
      setSelectedSizeTableId("");
      return;
    }

    setSelectedSizeTableId((prev) => {
      if (prev && availableSizeTables.some((item) => item.id === prev)) {
        return prev;
      }
      return availableSizeTables[0].id;
    });
  }, [availableSizeTables]);

  const syncEditorDescription = useCallback((html) => {
    if (descriptionEditorRef.current) {
      descriptionEditorRef.current.innerHTML = html;
    }
    setFormData((prev) => ({ ...prev, description: html }));
  }, []);

  const handleInsertSizeTableTemplate = () => {
    const selectedTemplate = availableSizeTables.find(
      (item) => item.id === selectedSizeTableId,
    );
    const templateHtml = String(selectedTemplate?.html || "").trim();

    if (!templateHtml) {
      showToast(
        "Cadastre uma tabela de medidas em Configurações > Catálogo.",
        "error",
      );
      return;
    }

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

  useEffect(() => {
    setCurrentPage(1);
  }, [productSearch, categoryFilter, stockFilter]);

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

  const clearAllImages = () => {
    setFormData((prev) => ({
      ...prev,
      images: [],
      image: "",
    }));
    showToast("Todas as imagens foram removidas.");
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
      personalizationenabled: "personalizationEnabled",
      permitepersonalizacao: "personalizationEnabled",
      personalizacaoativa: "personalizationEnabled",
      personalizationprice: "personalizationPrice",
      precopersonalizacao: "personalizationPrice",
      valorpersonalizacao: "personalizationPrice",
      personalizationallowname: "personalizationAllowName",
      personalizarnome: "personalizationAllowName",
      permitenome: "personalizationAllowName",
      personalizationallownumber: "personalizationAllowNumber",
      personalizarnumero: "personalizationAllowNumber",
      permitenumero: "personalizationAllowNumber",
      personalizationdetails: "personalizationDetails",
      detalhespersonalizacao: "personalizationDetails",
      observacaopersonalizacao: "personalizationDetails",
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
      allowpickup: "allowPickup",
      retiradaloja: "allowPickup",
      retirada: "allowPickup",
      coletarloja: "allowPickup",
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
      const allowPickup = parseBooleanFlag(row.allowPickup);

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
        allowPickup,
        images,
        image: images[0] || "",
        showcaseSections,
        variationsByType,
        variations: flattenedVariations,
        personalization: {
          enabled: parseBooleanFlag(row.personalizationEnabled),
          price: Math.max(0, parseLocaleNumber(row.personalizationPrice) || 0),
          allowName: parseBooleanFlag(row.personalizationAllowName),
          allowNumber: parseBooleanFlag(row.personalizationAllowNumber),
          details: String(row.personalizationDetails || "").trim(),
        },
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
        allowPickup: Boolean(formData.allowPickup),
        subcategories: selectedSubcategories,
        subcategory: selectedSubcategories[0] || "",
        subsubcategory: formData.subsubcategory || "",
        showcaseSections: Array.isArray(formData.showcaseSections)
          ? formData.showcaseSections
          : [],
        variationsByType: normalizedVariationMap,
        variations: flattenedVariations,
        personalization: {
          enabled: Boolean(formData.personalization?.enabled),
          price: Math.max(0, Number(formData.personalization?.price || 0)),
          allowName: Boolean(formData.personalization?.allowName),
          allowNumber: Boolean(formData.personalization?.allowNumber),
          details: String(formData.personalization?.details || "").trim(),
        },
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

  const buildProductFormData = (product) => {
    const personalization = normalizeProductPersonalization(product);
    return {
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
      allowPickup: isProductPickupEligible(product),
      images: product.images || (product.image ? [product.image] : []),
      variations: product.variations || "",
      variationsByType: getInitialVariationMap(product),
      personalization: {
        enabled: personalization.enabled,
        price: personalization.price || "",
        allowName: personalization.allowName,
        allowNumber: personalization.allowNumber,
        details: personalization.details,
      },
    };
  };

  const handleEdit = (product) => {
    setFormData(buildProductFormData(product));
    setEditingId(product.id);
    setIsAdding(true);
  };

  const handleClone = (product) => {
    setFormData(buildProductFormData(product));
    setEditingId(null);
    setIsAdding(true);
    showToast("Produto clonado. Ajuste os dados e salve como novo produto.");
  };

  const buildProductShareUrl = (product) => {
    const params = new URLSearchParams();
    params.set("productId", String(product?.id || ""));
    if (product?.category) params.set("category", String(product.category));
    if (product?.subcategory) {
      params.set("subcategory", String(product.subcategory));
    }

    const url = new URL(window.location.href);
    const normalizedPath = String(url.pathname || "").toLowerCase();
    const normalizedHash = String(url.hash || "")
      .replace(/^#/, "")
      .toLowerCase();

    if (normalizedPath === "/admin") {
      url.pathname = "/";
    }

    if (normalizedHash === "admin" || normalizedHash === "/admin") {
      url.hash = "";
    }

    url.search = params.toString();
    return url.toString();
  };

  const handleCopyShareLink = async (product) => {
    try {
      const shareUrl = buildProductShareUrl(product);

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const tempInput = document.createElement("textarea");
        tempInput.value = shareUrl;
        tempInput.setAttribute("readonly", "");
        tempInput.style.position = "absolute";
        tempInput.style.left = "-9999px";
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
      }

      showToast("Link de compartilhamento copiado!");
    } catch (error) {
      console.error("Erro ao copiar link de compartilhamento:", error);
      showToast("Nao foi possivel copiar o link do produto.", "error");
    }
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

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedProducts.map((p) => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          deleteDoc(
            doc(db, "artifacts", appId, "public", "data", "products", id),
          ),
        ),
      );
      showToast(`${selectedIds.size} produto(s) excluído(s) com sucesso!`);
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
    } catch (error) {
      showToast("Erro ao excluir produtos", "error");
    }
  };

  const exportCsvSelected = () => {
    const selectedProducts = filteredProducts.filter((p) =>
      selectedIds.has(p.id),
    );
    if (selectedProducts.length === 0) {
      showToast("Nenhum produto selecionado para exportar", "error");
      return;
    }
    exportProductsAsCSV(selectedProducts, "produtos-selecionados.csv");
  };

  const exportCsvAll = () => {
    if (filteredProducts.length === 0) {
      showToast("Nenhum produto para exportar", "error");
      return;
    }
    exportProductsAsCSV(filteredProducts, "produtos.csv");
  };

  const exportProductsAsCSV = (productsToExport, filename) => {
    const delimiter = ";";
    const headers = [
      "name",
      "price",
      "priceTag",
      "category",
      "subcategory",
      "subsubcategory",
      "stock",
      "allowPickup",
      "variations",
      "personalizationEnabled",
      "personalizationPrice",
      "personalizationAllowName",
      "personalizationAllowNumber",
      "personalizationDetails",
    ];

    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (
        str.includes(delimiter) ||
        str.includes('"') ||
        str.includes("\n") ||
        str.includes("\r")
      ) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = productsToExport.map((product) => {
      const personalization = normalizeProductPersonalization(product);
      const row = {
        name: product.name || "",
        price: Number(product.price || 0),
        priceTag: Number(product.priceTag || 0) || "",
        category: product.category || "",
        subcategory: product.subcategory || "",
        subsubcategory: product.subsubcategory || "",
        stock: Number(product.stock || 0),
        allowPickup: Boolean(product.allowPickup),
        variations: product.variations || "",
        personalizationEnabled: Boolean(personalization.enabled),
        personalizationPrice: personalization.price || "",
        personalizationAllowName: Boolean(personalization.allowName),
        personalizationAllowNumber: Boolean(personalization.allowNumber),
        personalizationDetails: personalization.details || "",
      };

      return headers
        .map((header) => escapeCsvValue(row[header]))
        .join(delimiter);
    });

    // BOM UTF-8 para o Excel abrir acentuação corretamente.
    const csvContent = `\uFEFF${[headers.join(delimiter), ...csvRows].join("\r\n")}`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`${productsToExport.length} produto(s) exportado(s)!`);
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
      allowPickup: false,
      images: [],
      variations: "",
      variationsByType: {},
      personalization: {
        enabled: false,
        price: "",
        allowName: false,
        allowNumber: false,
        details: "",
      },
    });
  };

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const allSelected =
    paginatedProducts.length > 0 &&
    paginatedProducts.every((p) => selectedIds.has(p.id));

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
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-bold text-slate-700">
                Imagens do Produto
              </label>
              {(formData.images || []).length > 0 && (
                <button
                  type="button"
                  onClick={clearAllImages}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200"
                >
                  Remover todas as imagens
                </button>
              )}
            </div>
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

            <label className="md:col-span-2 inline-flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(formData.allowPickup)}
                onChange={(e) =>
                  setFormData({ ...formData, allowPickup: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-300 text-indigo-600"
              />
              Permitir retirada na loja para este produto
            </label>

            <div className="md:col-span-2 space-y-3 p-4 rounded-xl border border-fuchsia-200 bg-fuchsia-50/50">
              <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(formData.personalization?.enabled)}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      personalization: {
                        ...(prev.personalization || {}),
                        enabled: e.target.checked,
                      },
                    }))
                  }
                  className="w-4 h-4 rounded border-fuchsia-300 text-fuchsia-600"
                />
                Permitir personalização neste produto
              </label>

              {formData.personalization?.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Preço da personalização (R$)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ex: 20"
                      value={formData.personalization?.price || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          personalization: {
                            ...(prev.personalization || {}),
                            price: e.target.value,
                          },
                        }))
                      }
                      className="w-full p-3 border rounded-lg outline-none focus:border-fuchsia-400 bg-white"
                    />
                  </div>

                  <div className="flex flex-col gap-2 rounded-lg border border-fuchsia-100 bg-white p-3">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                      O que pode personalizar
                    </span>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.personalization?.allowName)}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            personalization: {
                              ...(prev.personalization || {}),
                              allowName: e.target.checked,
                            },
                          }))
                        }
                        className="w-4 h-4 rounded border-fuchsia-300 text-fuchsia-600"
                      />
                      Nome
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.personalization?.allowNumber)}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            personalization: {
                              ...(prev.personalization || {}),
                              allowNumber: e.target.checked,
                            },
                          }))
                        }
                        className="w-4 h-4 rounded border-fuchsia-300 text-fuchsia-600"
                      />
                      Número
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Observações da personalização
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Ex: Nome até 20 caracteres. Número até 3 dígitos."
                      value={formData.personalization?.details || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          personalization: {
                            ...(prev.personalization || {}),
                            details: e.target.value,
                          },
                        }))
                      }
                      className="w-full p-3 border rounded-lg outline-none focus:border-fuchsia-400 bg-white"
                    />
                  </div>
                </div>
              )}
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
                <select
                  value={selectedSizeTableId}
                  onChange={(e) => setSelectedSizeTableId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold"
                >
                  {availableSizeTables.length === 0 ? (
                    <option value="">Sem tabela cadastrada</option>
                  ) : (
                    availableSizeTables.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))
                  )}
                </select>
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
            className="bg-slate-900 hover:bg-slate-700 transition text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 cursor-pointer"
          >
            <Upload size={18} />
            <span className="hidden sm:inline">Cadastro Massivo</span>
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 hover:bg-indigo-700 transition text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 cursor-pointer"
          >
            <Plus size={18} />{" "}
            <span className="hidden sm:inline">Novo Produto</span>
          </button>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row gap-3">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-sm font-semibold text-slate-700">
                {selectedIds.size} selecionado(s)
              </span>
              <button
                onClick={exportCsvSelected}
                className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition cursor-pointer"
              >
                <Download size={16} />
                Exportar Selecionados
              </button>
              <button
                onClick={() => setBulkDeleteConfirm(true)}
                className="px-3 py-2 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium flex items-center gap-2 transition cursor-pointer"
              >
                <Trash2 size={16} />
                Excluir Selecionados
              </button>
            </div>
          )}
          <div className="flex-1" />
          <div className="flex-1">
            <input
              type="text"
              placeholder="Buscar por nome, categoria ou subcategoria"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <button
            onClick={exportCsvAll}
            className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center gap-2 transition cursor-pointer"
          >
            <Download size={16} />
            Exportar Todos
          </button>
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
              <th className="p-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 cursor-pointer"
                />
              </th>
              <th className="p-4">Produto</th>
              <th className="p-4">Categoria</th>
              <th className="p-4">Subcategoria</th>
              <th className="p-4">Preço</th>
              <th className="p-4">Estoque</th>
              <th className="p-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedProducts.map((p) => (
              <tr
                key={p.id}
                className={`hover:bg-slate-50 transition-colors ${
                  selectedIds.has(p.id) ? "bg-indigo-50" : ""
                }`}
              >
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="rounded border-slate-300 cursor-pointer"
                  />
                </td>
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
                  <div className="min-w-0">
                    <span className="line-clamp-1 block">{p.name}</span>
                    {normalizeProductPersonalization(p).enabled && (
                      <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-700 text-[10px] font-bold border border-fuchsia-200">
                        Personalizável
                      </span>
                    )}
                  </div>
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
                      className="text-indigo-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                      title="Editar Produto"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleClone(p)}
                      className="text-sky-500 hover:text-sky-700 p-2 hover:bg-sky-50 rounded transition-colors cursor-pointer"
                      title="Clonar Produto"
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      onClick={() => handleCopyShareLink(p)}
                      className="text-emerald-500 hover:text-emerald-700 p-2 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                      title="Copiar link de compartilhamento"
                    >
                      <Share2 size={18} />
                    </button>
                    <button
                      onClick={() => setProductToDelete(p)}
                      className="text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded transition-colors cursor-pointer"
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
                <td colSpan="7" className="p-8 text-center text-slate-400">
                  Nenhum produto encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium cursor-pointer"
            >
              Anterior
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 text-sm rounded-lg font-medium transition cursor-pointer ${
                  currentPage === page
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium cursor-pointer"
            >
              Próximo
            </button>

            <span className="text-sm text-slate-600 ml-4">
              Mostrando {(currentPage - 1) * itemsPerPage + 1} até{" "}
              {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de{" "}
              {filteredProducts.length}
            </span>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={bulkDeleteConfirm}
        title="Excluir Produtos Selecionados"
        message={`Você está prestes a excluir ${selectedIds.size} produto(s). Esta ação não poderá ser desfeita.`}
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
        confirmText="Excluir Produtos"
        cancelText="Cancelar"
        confirmStyle="bg-rose-600 hover:bg-rose-700"
      />

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
      normalizeForSearch(c.name).includes(
        normalizeForSearch(customerSearchTerm),
      ) ||
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
    normalizeForSearch(p.name).includes(normalizeForSearch(searchTerm)),
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
        orderNumber: await generateNextOrderNumber(),
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

function OrdersList({ orders, showToast, storeSettings, quickFilter = "all" }) {
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [trackingDrafts, setTrackingDrafts] = useState({});
  const [costDrafts, setCostDrafts] = useState({});
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [orderToRefund, setOrderToRefund] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const stockReturnStatuses = new Set(["estornado", "cancelado"]);
  const pickupMapUrl = resolvePickupMapUrl(storeSettings?.pickupMapUrl);

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
    aguardando_retirada: {
      label: "Aguardando Retirada",
      color: "bg-cyan-100 text-cyan-700",
    },
    enviado: { label: "Enviado", color: "bg-indigo-100 text-indigo-700" },
    entregue: { label: "Entregue", color: "bg-emerald-100 text-emerald-700" },
    pago: {
      label: "Pago",
      color: "bg-emerald-100 text-emerald-700",
    },
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
    const query = normalizeForSearch(searchTerm).trim();

    return orders.filter((order) => {
      const status = getOrderStatus(order);
      const type = normalizeForSearch(order?.type);
      const orderRef = normalizeForSearch(order?.id);
      const orderNumber = normalizeForSearch(order?.orderNumber);
      const orderDisplay = normalizeForSearch(formatOrderDisplayId(order));
      const customer = normalizeForSearch(
        order?.customerName || order?.address?.recebedorNome || "",
      );
      const email = normalizeForSearch(order?.customerEmail);
      const phone = normalizeForSearch(
        order?.customerPhone || order?.address?.recebedorTelefone || "",
      );
      const tracking = normalizeForSearch(order?.trackingCode);
      const paymentMethod = normalizeForSearch(order?.paymentMethod);

      const matchesQuery =
        !query ||
        orderNumber.includes(query) ||
        orderDisplay.includes(query) ||
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
      if (isPickupOrder(order)) {
        return [
          "pendente_pagamento",
          "pago",
          "aguardando_retirada",
          "concluido",
          "estornado",
          "cancelado",
        ];
      }

      return [
        "pendente_pagamento",
        "pago",
        "separacao",
        "enviado",
        "entregue",
        "estornado",
        "cancelado",
      ];
    }
    return [
      "pendente_pagamento",
      "pago",
      "concluido",
      "estornado",
      "cancelado",
    ];
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

    if (isPickupOrder(order)) {
      return showToast(
        "Pedidos de retirada não precisam de código de rastreio.",
        "error",
      );
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

  const getOrderCost = (order) => {
    const raw =
      order?.cost !== undefined && order?.cost !== null
        ? order.cost
        : order?.orderCost;
    const parsed = Number(raw || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getOrderProfit = (order) => {
    const total = Number(order?.total || 0);
    const cost = getOrderCost(order);
    return total - cost;
  };

  const handleSaveCost = async (order) => {
    if (!order?.id) return;

    const rawDraft =
      costDrafts[order.id] !== undefined
        ? costDrafts[order.id]
        : getOrderCost(order);
    const normalizedValue =
      typeof rawDraft === "string" ? rawDraft.replace(",", ".") : rawDraft;
    const cost = Number(normalizedValue);

    if (!Number.isFinite(cost) || cost < 0) {
      return showToast(
        "Informe um custo válido (maior ou igual a zero)",
        "error",
      );
    }

    const profit = Number(order?.total || 0) - cost;

    setSavingOrderId(order.id);
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "orders", order.id),
        {
          cost,
          profit,
          profitUpdatedAt: serverTimestamp(),
        },
      );
      setCostDrafts((prev) => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
      showToast("Custo do pedido salvo e lucro recalculado!");
    } catch (error) {
      console.error("Erro ao salvar custo do pedido:", error);
      showToast("Erro ao salvar custo do pedido", "error");
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

  // Estados para paginação e seleção
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const itemsPerPage = 10;

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((o) => selectedIds.has(o.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          deleteDoc(
            doc(db, "artifacts", appId, "public", "data", "orders", id),
          ),
        ),
      );
      showToast(`${selectedIds.size} pedido(s) excluído(s).`);
      setSelectedIds(new Set());
    } catch (e) {
      showToast("Erro ao excluir pedidos.", "error");
    } finally {
      setBulkDeleteConfirm(false);
    }
  };

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col lg:flex-row gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por número do pedido, cliente, e-mail, telefone ou rastreio"
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
            <option value="pago">Pago</option>
            <option value="aguardando_retirada">Aguardando Retirada</option>
            <option value="separacao">Em Separação</option>
            <option value="enviado">Enviado</option>
            <option value="entregue">Entregue</option>
            <option value="concluido">Concluído</option>
            <option value="estornado">Estornado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        {selectedIds.size > 0 && (
          <div className="px-4 py-3 border-b border-rose-200 bg-rose-50 flex items-center gap-3">
            <span className="text-sm font-semibold text-rose-700 flex-1">
              {selectedIds.size} pedido(s) selecionado(s)
            </span>
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
            >
              <Trash2 size={13} /> Excluir selecionados
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-rose-500 hover:text-rose-700 p-1"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <table className="w-full text-left text-sm min-w-[1360px]">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-4 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                />
              </th>
              <th className="p-4">Pedido</th>
              <th className="p-4">Data/Hora</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Cliente</th>
              <th className="p-4">Status</th>
              <th className="p-4">Rastreio</th>
              <th className="p-4">Método</th>
              <th className="p-4 text-right">Valor Total</th>
              <th className="p-4">Custo</th>
              <th className="p-4 text-right">Lucro Líquido</th>
              <th className="p-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedOrders.map((o) => {
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
              const isSelected = selectedIds.has(o.id);
              const costValue =
                costDrafts[o.id] !== undefined
                  ? costDrafts[o.id]
                  : getOrderCost(o);
              const orderProfit = getOrderProfit(o);

              return (
                <tr
                  key={o.id}
                  onClick={(e) => {
                    // não abre detalhes se clicou em checkbox, select, input ou botão
                    if (e.target.closest("input,select,button,a")) return;
                    setSelectedOrder(o);
                  }}
                  className={`align-top transition-colors cursor-pointer ${isSelected ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                >
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(o.id)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </td>
                  <td className="p-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                    <span title={String(o.orderNumber || o.id)}>
                      {formatOrderDisplayId(o)}
                    </span>
                  </td>
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
                    {o.type === "online" && !isPickupOrder(o) ? (
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
                    ) : o.type === "online" && isPickupOrder(o) ? (
                      <div className="text-xs text-slate-500">
                        <p className="font-semibold text-slate-700">
                          Retirada na loja
                        </p>
                        {pickupMapUrl && (
                          <a
                            href={pickupMapUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 mt-1 font-bold text-cyan-700 hover:text-cyan-800"
                          >
                            <MapPin size={12} /> Abrir localização
                          </a>
                        )}
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
                  <td className="p-4 min-w-[190px]">
                    <div className="space-y-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={costValue}
                        onChange={(e) =>
                          setCostDrafts((prev) => ({
                            ...prev,
                            [o.id]: e.target.value,
                          }))
                        }
                        placeholder="0,00"
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                        disabled={isSaving}
                      />
                      <button
                        onClick={() => handleSaveCost(o)}
                        disabled={isSaving}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold py-2 rounded-lg"
                      >
                        {isSaving ? "Salvando..." : "Salvar Custo"}
                      </button>
                    </div>
                  </td>
                  <td className="p-4 font-bold text-right text-base whitespace-nowrap">
                    <span
                      className={
                        Number(orderProfit) >= 0
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }
                    >
                      R$ {Number(orderProfit).toFixed(2)}
                    </span>
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
                        onClick={() => setSelectedOrder(o)}
                        className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold px-3 py-2 rounded-lg inline-flex items-center gap-1"
                      >
                        <Eye size={13} /> Detalhes
                      </button>
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
                <td colSpan="12" className="p-8 text-center text-slate-400">
                  Nenhuma venda encontrada com os filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Mostrando {(currentPage - 1) * itemsPerPage + 1} até{" "}
              {Math.min(currentPage * itemsPerPage, filteredOrders.length)} de{" "}
              {filteredOrders.length} pedidos
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-100"
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`px-3 py-2 text-xs font-bold rounded-lg ${
                    currentPage === i + 1
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-100"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Excluir {selectedIds.size} pedido(s)?
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Tem certeza que deseja excluir {selectedIds.size} pedido(s)
              selecionado(s)? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

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

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          statusCatalog={statusCatalog}
          getOrderStatus={getOrderStatus}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}

// Modal de Detalhe do Pedido
function OrderDetailModal({ order, statusCatalog, getOrderStatus, onClose }) {
  const status = getOrderStatus(order);
  const statusMeta = statusCatalog[status] || {
    label: status,
    color: "bg-slate-100 text-slate-700",
  };
  const items = Array.isArray(order?.items) ? order.items : [];
  const address = order?.address || {};
  const history = Array.isArray(order?.statusHistory)
    ? order.statusHistory
    : [];

  const subtotal = items.reduce(
    (s, i) => s + Number(i.price || 0) * Number(i.qty || 1),
    0,
  );
  const shippingCost = Number(order?.shipping?.price || 0);
  const discountAmount = Number(order?.discountAmount || 0);
  const shippingDiscount = Number(order?.shippingDiscount || 0);
  const total = Number(order?.total || 0);

  const formatDate = (ts) => {
    if (!ts) return "—";
    try {
      const d =
        typeof ts.toMillis === "function"
          ? new Date(ts.toMillis())
          : new Date(ts);
      return d.toLocaleString("pt-BR");
    } catch {
      return "—";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">
              Detalhes do Pedido
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {formatOrderDisplayId(order)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Status + Meta */}
          <div className="flex flex-wrap gap-3 items-center">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${statusMeta.color}`}
            >
              {statusMeta.label}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${order.type === "online" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}
            >
              {order.type === "online" ? "Online" : "Presencial"}
            </span>
            <span className="text-xs text-slate-400">
              {formatDate(order.createdAt)}
            </span>
          </div>

          {/* Cliente */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Cliente
            </h3>
            <div className="bg-slate-50 rounded-xl p-4 space-y-1 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Nome:</span>{" "}
                {order.customerName || address.recebedorNome || "—"}
              </p>
              {order.customerEmail && (
                <p>
                  <span className="font-semibold">E-mail:</span>{" "}
                  {order.customerEmail}
                </p>
              )}
              {(order.customerPhone || address.recebedorTelefone) && (
                <p>
                  <span className="font-semibold">Telefone:</span>{" "}
                  {order.customerPhone || address.recebedorTelefone}
                </p>
              )}
              {address.recebedorCpf && (
                <p>
                  <span className="font-semibold">CPF:</span>{" "}
                  {address.recebedorCpf}
                </p>
              )}
            </div>
          </section>

          {/* Endereço de entrega */}
          {order.type === "online" && (address.rua || address.logradouro) && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Endereço de Entrega
              </h3>
              <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 space-y-1">
                {address.recebedorNome && (
                  <p>
                    <span className="font-semibold">Recebedor:</span>{" "}
                    {address.recebedorNome}
                    {address.recebedorTelefone && (
                      <span className="text-slate-400">
                        {" "}
                        — {address.recebedorTelefone}
                      </span>
                    )}
                  </p>
                )}
                {address.recebedorCpf && (
                  <p>
                    <span className="font-semibold">CPF:</span>{" "}
                    {address.recebedorCpf}
                  </p>
                )}
                <p>
                  <span className="font-semibold">Endereço:</span>{" "}
                  {address.rua || address.logradouro}
                  {address.numero ? `, ${address.numero}` : ""}
                  {address.complemento ? ` — ${address.complemento}` : ""}
                </p>
                {address.bairro && (
                  <p>
                    <span className="font-semibold">Bairro:</span>{" "}
                    {address.bairro}
                  </p>
                )}
                {(address.cidade || address.estado) && (
                  <p>
                    <span className="font-semibold">Cidade/UF:</span>{" "}
                    {[address.cidade, address.estado]
                      .filter(Boolean)
                      .join(" / ")}
                  </p>
                )}
                {address.cep && (
                  <p>
                    <span className="font-semibold">CEP:</span> {address.cep}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Itens */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Itens do Pedido
            </h3>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">
                      Produto
                    </th>
                    <th className="px-4 py-2 text-center font-semibold">Qtd</th>
                    <th className="px-4 py-2 text-right font-semibold">
                      Unit.
                    </th>
                    <th className="px-4 py-2 text-right font-semibold">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan="4"
                        className="px-4 py-3 text-center text-slate-400"
                      >
                        Sem itens
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const personalization = item?.selectedPersonalization;
                      const hasPersonalization =
                        personalization?.usePersonalization;
                      const variationMap =
                        item?.selectedVariationMap &&
                        typeof item.selectedVariationMap === "object"
                          ? Object.entries(item.selectedVariationMap)
                          : [];
                      const basePrice = Number(
                        item?.basePrice || item?.price || 0,
                      );
                      const personalizationPrice = Number(
                        item?.personalizationPrice || 0,
                      );

                      return (
                        <tr
                          key={idx}
                          className={`align-top ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}
                        >
                          <td className="px-4 py-3 text-slate-700">
                            {/* Nome do produto */}
                            <span className="font-semibold text-slate-800">
                              {item.name || "—"}
                            </span>

                            {/* Variações detalhadas */}
                            {variationMap.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {variationMap.map(([tipo, valor]) => (
                                  <span
                                    key={tipo}
                                    className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                  >
                                    <span className="text-slate-400">
                                      {tipo}:
                                    </span>{" "}
                                    {valor}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Variação (label legado, se não tiver mapa) */}
                            {!variationMap.length && item.selectedVariation && (
                              <span className="block mt-1 text-xs text-slate-500">
                                Variação: {item.selectedVariation}
                              </span>
                            )}

                            {/* Personalização */}
                            {hasPersonalization && (
                              <div className="mt-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 space-y-0.5">
                                <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                                  Personalização
                                </p>
                                {personalization.name && (
                                  <p className="text-xs text-indigo-800">
                                    <span className="font-semibold">Nome:</span>{" "}
                                    {personalization.name}
                                  </p>
                                )}
                                {personalization.number && (
                                  <p className="text-xs text-indigo-800">
                                    <span className="font-semibold">
                                      Número:
                                    </span>{" "}
                                    {personalization.number}
                                  </p>
                                )}
                                {personalizationPrice > 0 && (
                                  <p className="text-xs text-indigo-500">
                                    + R$ {personalizationPrice.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600 font-semibold">
                            {item.qty || 1}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap align-top">
                            <span>R$ {basePrice.toFixed(2)}</span>
                            {personalizationPrice > 0 && (
                              <span className="block text-[11px] text-indigo-400">
                                + R$ {personalizationPrice.toFixed(2)} pers.
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap align-top">
                            R${" "}
                            {(
                              Number(item.price || 0) * Number(item.qty || 1)
                            ).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Resumo financeiro */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Resumo Financeiro
            </h3>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm text-slate-700">
              <div className="flex justify-between">
                <span>Subtotal dos produtos</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Desconto (cupom)</span>
                  <span>− R$ {discountAmount.toFixed(2)}</span>
                </div>
              )}
              {shippingCost > 0 && (
                <div className="flex justify-between">
                  <span>
                    Frete
                    {order.shipping?.name ? ` (${order.shipping.name})` : ""}
                  </span>
                  <span>R$ {shippingCost.toFixed(2)}</span>
                </div>
              )}
              {shippingDiscount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Desconto no frete</span>
                  <span>− R$ {shippingDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-base text-indigo-700 border-t border-slate-200 pt-2 mt-1">
                <span>Total</span>
                <span>R$ {total.toFixed(2)}</span>
              </div>
              {order.paymentMethod && (
                <p className="text-xs text-slate-400 mt-1">
                  Forma de pagamento:{" "}
                  <span className="font-semibold text-slate-600">
                    {order.paymentMethod}
                  </span>
                </p>
              )}
              {Array.isArray(order.appliedCoupons) &&
                order.appliedCoupons.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-400 font-semibold mb-1">
                      Cupons aplicados:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {order.appliedCoupons.map((c, i) => (
                        <span
                          key={i}
                          className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full"
                        >
                          {c.code || c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </section>

          {/* Histórico de status */}
          {history.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Histórico de Status
              </h3>
              <ol className="relative border-l border-slate-200 ml-2 space-y-3">
                {history.map((h, i) => (
                  <li key={i} className="ml-4">
                    <span className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-indigo-400 border-2 border-white"></span>
                    <p className="text-xs text-slate-500">{formatDate(h.at)}</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {h.from} → {h.to}
                      {h.action ? (
                        <span className="text-xs text-slate-400 font-normal ml-1">
                          ({h.action})
                        </span>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// 2.X Aba Carrinhos Abandonados
function AbandonedCartsList({ carts, showToast }) {
  const [viewingCart, setViewingCart] = useState(null);
  const [cartToDelete, setCartToDelete] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

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

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allSelected =
    carts.length > 0 && carts.every((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(carts.map((c) => c.id)));
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          deleteDoc(
            doc(
              db,
              "artifacts",
              appId,
              "public",
              "data",
              "abandoned_carts",
              id,
            ),
          ),
        ),
      );
      showToast(`${selectedIds.size} carrinho(s) removido(s).`);
      setSelectedIds(new Set());
    } catch (e) {
      showToast("Erro ao remover carrinhos.", "error");
    } finally {
      setBulkDeleteConfirm(false);
    }
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
        {selectedIds.size > 0 && (
          <div className="p-4 border-b border-rose-200 bg-rose-50 flex items-center gap-3">
            <span className="text-sm font-semibold text-rose-700 flex-1">
              {selectedIds.size} selecionado(s)
            </span>
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
            >
              <Trash2 size={13} /> Excluir selecionados
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-rose-500 hover:text-rose-700 p-1"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <table className="w-full text-left text-sm min-w-[800px]">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-4 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                />
              </th>
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
              const isSelected = selectedIds.has(cart.id);

              return (
                <tr
                  key={cart.id}
                  className={`transition-colors ${isSelected ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                >
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(cart.id)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </td>
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
                <td colSpan="6" className="p-8 text-center text-slate-400">
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

      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Excluir {selectedIds.size} carrinho(s)?
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Tem certeza que deseja excluir {selectedIds.size} carrinho(s)
              selecionado(s)? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

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
                        {item.selectedPersonalizationLabel && (
                          <p className="text-xs text-fuchsia-700 mt-0.5">
                            Personalização: {item.selectedPersonalizationLabel}
                          </p>
                        )}
                        <p className="text-sm text-indigo-600 font-bold mt-1">
                          {formatCurrencyBRL(getCartItemUnitPrice(item))}
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

function ProductInterestLeads({ leads, showToast }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const filteredLeads = useMemo(() => {
    const query = normalizeForSearch(searchTerm).trim();

    if (!query) return leads;

    return leads.filter((lead) => {
      const name = normalizeForSearch(lead?.customerName);
      const email = normalizeForSearch(lead?.customerEmail);
      const phone = normalizeForSearch(lead?.customerPhone);
      const product = normalizeForSearch(lead?.productName);
      const category = normalizeForSearch(lead?.productCategory);

      return (
        name.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        product.includes(query) ||
        category.includes(query)
      );
    });
  }, [leads, searchTerm]);

  const buildLeadContactHref = (lead) => {
    const digits = normalizePhoneDigits(lead?.customerPhone || "");
    if (digits.length < 10) return "";

    const productName = String(lead?.productName || "produto").trim();
    const text = `Olá! Vi que você se interessou por ${productName}. Posso te enviar uma oferta especial com desconto?`;
    return `https://wa.me/55${digits}?text=${encodeURIComponent(text)}`;
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allSelected =
    filteredLeads.length > 0 &&
    filteredLeads.every((lead) => selectedIds.has(lead.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredLeads.map((lead) => lead.id)));
  };

  const handleDeleteLead = async (id) => {
    setDeletingId(id);
    try {
      await deleteDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "product_interest_leads",
          id,
        ),
      );
      showToast("Lead excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir lead:", error);
      showToast("Erro ao excluir lead", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        [...selectedIds].map((id) =>
          deleteDoc(
            doc(
              db,
              "artifacts",
              appId,
              "public",
              "data",
              "product_interest_leads",
              id,
            ),
          ),
        ),
      );
      showToast(`${selectedIds.size} lead(s) excluído(s).`);
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Erro ao excluir leads:", error);
      showToast("Erro ao excluir leads", "error");
    } finally {
      setBulkDeleteConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-800">
          Interesse em Produtos
        </h2>
        <p className="text-sm text-slate-500 max-w-3xl">
          Lista de usuários que clicaram em produtos. Use esses contatos para
          remarketing e ofertas personalizadas.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, telefone, e-mail ou produto"
            className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          />
        </div>

        {selectedIds.size > 0 && (
          <div className="px-4 py-3 border-b border-rose-200 bg-rose-50 flex items-center gap-3">
            <span className="text-sm font-semibold text-rose-700 flex-1">
              {selectedIds.size} lead(s) selecionado(s)
            </span>
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
            >
              <Trash2 size={13} /> Excluir selecionados
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-rose-500 hover:text-rose-700 p-1"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <table className="w-full text-left text-sm min-w-[980px]">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-4 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-indigo-600 cursor-pointer"
                />
              </th>
              <th className="p-4">Último Clique</th>
              <th className="p-4">Cliente</th>
              <th className="p-4">Produto de Interesse</th>
              <th className="p-4 text-center">Cliques</th>
              <th className="p-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLeads.map((lead) => {
              const contactHref = buildLeadContactHref(lead);
              const hasEmail = Boolean(
                String(lead?.customerEmail || "").trim(),
              );
              const clickCount = Number(lead?.clickCount || 0);
              const isSelected = selectedIds.has(lead.id);

              return (
                <tr
                  key={lead.id}
                  className={`transition-colors ${isSelected ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                >
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(lead.id)}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </td>
                  <td className="p-4 text-slate-700 font-medium whitespace-nowrap">
                    {lead?.lastClickedAt
                      ? new Date(lead.lastClickedAt.toMillis()).toLocaleString()
                      : "Recente"}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">
                        {lead.customerName || "Visitante"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {lead.customerPhone || "Telefone não disponível"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {lead.customerEmail || "E-mail não disponível"}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg border border-slate-100 bg-slate-50 overflow-hidden shrink-0">
                        {lead.productImage ? (
                          <img
                            src={normalizeExternalImageUrl(lead.productImage)}
                            alt={lead.productName || "Produto"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-full h-full p-2 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 line-clamp-1">
                          {lead.productName || "Produto"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {lead.productCategory || "Sem categoria"}
                          {Number.isFinite(Number(lead.productPrice)) &&
                          Number(lead.productPrice) > 0
                            ? ` • ${formatCurrencyBRL(lead.productPrice)}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-black">
                      {clickCount}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      {contactHref ? (
                        <a
                          href={contactHref}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-xs font-bold px-3 py-2 rounded-lg inline-flex items-center gap-1"
                        >
                          <MessageCircle size={13} /> WhatsApp
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Sem WhatsApp
                        </span>
                      )}
                      {hasEmail && (
                        <button
                          onClick={() => {
                            navigator.clipboard
                              .writeText(String(lead.customerEmail || ""))
                              .then(() => showToast("E-mail copiado!"))
                              .catch(() =>
                                showToast(
                                  "Não foi possível copiar o e-mail",
                                  "error",
                                ),
                              );
                          }}
                          className="bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold px-3 py-2 rounded-lg"
                        >
                          Copiar e-mail
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteLead(lead.id)}
                        disabled={deletingId === lead.id}
                        className="bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:bg-slate-100 disabled:text-slate-400 text-xs font-bold px-3 py-2 rounded-lg"
                      >
                        {deletingId === lead.id ? "..." : "Excluir"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredLeads.length === 0 && (
              <tr>
                <td colSpan="6" className="p-8 text-center text-slate-400">
                  Nenhum registro de interesse encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Excluir {selectedIds.size} lead(s)?
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              Tem certeza que deseja excluir {selectedIds.size} lead(s)
              selecionado(s)? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductNotFoundRequestsList({
  requests,
  showToast,
  storeSettings = {},
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    const nextDrafts = {};
    requests.forEach((request) => {
      nextDrafts[request.id] = {
        status: request.status || "produto_nao_encontrado",
        adminLink: request.adminLink || "",
        adminMessage: request.adminMessage || "",
      };
    });
    setDrafts(nextDrafts);
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const query = normalizeForSearch(searchTerm).trim();
    if (!query) return requests;

    return requests.filter((request) => {
      const createdAtLabel = request?.createdAt?.toMillis
        ? new Date(request.createdAt.toMillis()).toLocaleString("pt-BR")
        : "";

      return [
        request.id,
        request.productName,
        request.category,
        request.brand,
        request.customerName,
        request.customerEmail,
        request.customerPhone,
        request.requestedSearchTerm,
        request.adminMessage,
        createdAtLabel,
      ]
        .map((item) => normalizeForSearch(item))
        .some((item) => item.includes(query));
    });
  }, [requests, searchTerm]);

  const handleDraftChange = (id, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }));
  };

  const handleSendWhatsApp = (request, draft) => {
    const phone = String(request.customerPhone || "").replace(/\D/g, "");
    if (!phone) {
      showToast("Telefone do cliente não informado", "error");
      return;
    }
    const storeName = storeSettings.storeName || "nossa loja";
    const firstName = (request.customerName || "cliente").split(" ")[0];
    const productName = request.productName || "o produto solicitado";
    const link = draft.adminLink || request.adminLink || "";
    const extraMessage = (
      draft.adminMessage ||
      request.adminMessage ||
      ""
    ).trim();

    // emojis como percent-encoding UTF-8 para evitar problemas de codificacao de arquivo
    const EM = {
      smile: "%F0%9F%98%8A",
      party: "%F0%9F%8E%89",
      point: "%F0%9F%91%89",
      pray: "%F0%9F%99%8F",
    };

    const enc = (s) => encodeURIComponent(s);
    const nl = "%0A";

    const parts = [
      `Ol${enc("\u00e1")}, ${enc(firstName)}! ${EM.smile}`,
      ``,
      `Temos uma ${enc("\u00f3tima not\u00edcia")} para voc${enc("\u00ea")}! ${EM.party}`,
      enc(
        `Localizamos *${productName}* que voc\u00ea solicitou em ${storeName}.`,
      ),
      ``,
      enc(
        `Aqui est\u00e1 o link com todas as informa\u00e7\u00f5es e op\u00e7\u00f5es de compra:`,
      ),
      `${EM.point} ${enc(link)}`,
    ];

    if (extraMessage) {
      parts.push(``);
      parts.push(enc(extraMessage));
    }

    parts.push(``);
    parts.push(
      `Qualquer d${enc("\u00favida")}, ${enc("\u00e9 s\u00f3 chamar. Estamos \u00e0 disposi\u00e7\u00e3o")}! ${EM.pray}`,
    );
    parts.push(enc(`Att, equipe ${storeName}`));

    const text = parts.join(nl);
    const whatsappNumber = phone.startsWith("55") ? phone : `55${phone}`;
    window.open(`https://wa.me/${whatsappNumber}?text=${text}`, "_blank");
  };

  const handleSave = async (requestId) => {
    const draft = drafts[requestId] || {};
    setSavingId(requestId);
    try {
      const payload = {
        status: String(draft.status || "produto_nao_encontrado"),
        adminLink: String(draft.adminLink || "").trim(),
        adminMessage: String(draft.adminMessage || "").trim(),
        updatedAt: serverTimestamp(),
      };

      if (payload.status === "link_disponivel") {
        payload.resolvedAt = serverTimestamp();
      }

      await updateDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "product_not_found_requests",
          requestId,
        ),
        payload,
      );

      showToast("Solicitação atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar solicitação:", error);
      showToast("Erro ao atualizar solicitação", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h2 className="text-2xl font-black text-slate-800">
          Solicitações de Produto Não Encontrado
        </h2>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por produto, cliente, telefone, data ou texto da busca"
          className="w-full md:w-[420px] p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-300"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="p-4">Solicitação</th>
              <th className="p-4">Cliente</th>
              <th className="p-4">Produto</th>
              <th className="p-4">Descrição</th>
              <th className="p-4">Status</th>
              <th className="p-4">Resposta / Link</th>
              <th className="p-4 text-center">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRequests.map((request) => {
              const draft = drafts[request.id] || {};

              return (
                <tr key={request.id} className="hover:bg-slate-50">
                  <td className="p-4 whitespace-nowrap">
                    <p className="font-bold text-slate-800">
                      #{request.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-slate-500">
                      {request.createdAt
                        ? new Date(request.createdAt.toMillis()).toLocaleString(
                            "pt-BR",
                          )
                        : "Recente"}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="font-semibold text-slate-800">
                      {request.customerName || "Cliente"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {request.customerEmail || "E-mail não informado"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {request.customerPhone || "Telefone não informado"}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="font-semibold text-slate-800">
                      {request.productName || "Produto não informado"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {request.category || "Sem categoria"}
                      {request.brand ? ` • ${request.brand}` : ""}
                    </p>
                    {request.requestedSearchTerm && (
                      <p className="text-xs text-indigo-600 mt-1">
                        Busca: "{request.requestedSearchTerm}"
                      </p>
                    )}
                  </td>
                  <td className="p-4 max-w-[260px]">
                    <p className="text-xs text-slate-700 leading-relaxed line-clamp-4">
                      {request.description || "Sem descrição."}
                    </p>
                  </td>
                  <td className="p-4">
                    <select
                      value={draft.status || "produto_nao_encontrado"}
                      onChange={(e) =>
                        handleDraftChange(request.id, "status", e.target.value)
                      }
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-300"
                    >
                      <option value="produto_nao_encontrado">
                        Produto não encontrado
                      </option>
                      <option value="em_analise">Em análise</option>
                      <option value="link_disponivel">Link disponível</option>
                      <option value="nao_disponivel">Não disponível</option>
                    </select>
                  </td>
                  <td className="p-4 min-w-[280px]">
                    <input
                      type="url"
                      value={draft.adminLink || ""}
                      onChange={(e) =>
                        handleDraftChange(
                          request.id,
                          "adminLink",
                          e.target.value,
                        )
                      }
                      placeholder="https://... link do produto"
                      className="w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <textarea
                      rows={2}
                      value={draft.adminMessage || ""}
                      onChange={(e) =>
                        handleDraftChange(
                          request.id,
                          "adminMessage",
                          e.target.value,
                        )
                      }
                      placeholder="Mensagem para o cliente"
                      className="mt-2 w-full p-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                    />
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => handleSave(request.id)}
                        disabled={savingId === request.id}
                        className="w-full px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold transition cursor-pointer"
                      >
                        {savingId === request.id ? "Salvando..." : "Salvar"}
                      </button>
                      {(draft.adminLink || request.adminLink) && (
                        <button
                          onClick={() => handleSendWhatsApp(request, draft)}
                          className="w-full px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                          title="Enviar link ao cliente via WhatsApp"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="w-3.5 h-3.5 fill-current"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          Enviar ao cliente
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan="7" className="p-8 text-center text-slate-400">
                  Nenhuma solicitação encontrada para os filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerFeedbackModerationList({ feedbacks, showToast }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const feedbackStats = useMemo(() => {
    const pending = feedbacks.filter(
      (item) => String(item?.status || "pending") === "pending",
    ).length;
    const approved = feedbacks.filter(
      (item) => String(item?.status || "pending") === "approved",
    ).length;
    const rejected = feedbacks.filter(
      (item) => String(item?.status || "pending") === "rejected",
    ).length;

    return { pending, approved, rejected };
  }, [feedbacks]);

  const filteredFeedbacks = useMemo(() => {
    const statusFiltered =
      statusFilter === "all"
        ? feedbacks
        : feedbacks.filter(
            (item) => String(item?.status || "pending") === statusFilter,
          );

    const query = String(searchTerm || "")
      .trim()
      .toLowerCase();

    if (!query) return statusFiltered;

    return statusFiltered.filter((item) =>
      [item.customerName, item.customerEmail, item.customerPhone, item.message]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(query)),
    );
  }, [feedbacks, searchTerm, statusFilter]);

  const updateStatus = async (feedbackId, status) => {
    setSavingId(feedbackId);
    try {
      await updateDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "customer_feedbacks",
          feedbackId,
        ),
        {
          status,
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      );

      if (status === "approved") {
        showToast("Feedback aprovado e publicado no site.");
      } else if (status === "rejected") {
        showToast("Feedback reprovado e ocultado do site.");
      } else {
        showToast("Feedback movido para pendente.");
      }
    } catch (error) {
      console.error("Erro ao atualizar feedback:", error);
      showToast("Erro ao atualizar feedback", "error");
    } finally {
      setSavingId(null);
    }
  };

  const deleteFeedback = async (feedbackId) => {
    setDeletingId(feedbackId);
    try {
      await deleteDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "customer_feedbacks",
          feedbackId,
        ),
      );
      showToast("Feedback excluído com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir feedback:", error);
      showToast("Erro ao excluir feedback", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-800">
            Feedbacks de Clientes
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Aprove somente os feedbacks que deseja mostrar no site público.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
            Pendentes: {feedbackStats.pending}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
            Aprovados: {feedbackStats.approved}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
            Reprovados: {feedbackStats.rejected}
          </span>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 md:p-5 flex flex-col md:flex-row gap-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nome, e-mail, telefone ou mensagem"
          className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="md:w-52 p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        >
          <option value="all">Todos os status</option>
          <option value="pending">Pendentes</option>
          <option value="approved">Aprovados</option>
          <option value="rejected">Reprovados</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[1020px] text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="p-4">Cliente</th>
              <th className="p-4">Feedback</th>
              <th className="p-4">Nota</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredFeedbacks.map((item) => {
              const status = String(item?.status || "pending");
              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="p-4 align-top min-w-[220px]">
                    <p className="font-bold text-slate-800">
                      {item.customerName || "Cliente"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.customerEmail || "E-mail não informado"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.customerPhone || "Telefone não informado"}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {item.createdAt?.toDate?.()
                        ? item.createdAt.toDate().toLocaleString("pt-BR")
                        : "Recente"}
                    </p>
                  </td>
                  <td className="p-4 align-top max-w-[420px]">
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {item.message || "Sem mensagem"}
                    </p>
                  </td>
                  <td className="p-4 align-top">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <Star
                          key={`${item.id}-${starIndex}`}
                          size={14}
                          className={
                            starIndex < (Number(item.stars) || 0)
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-300"
                          }
                        />
                      ))}
                    </div>
                  </td>
                  <td className="p-4 align-top">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        status === "approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : status === "rejected"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {status === "approved"
                        ? "Aprovado"
                        : status === "rejected"
                          ? "Reprovado"
                          : "Pendente"}
                    </span>
                  </td>
                  <td className="p-4 align-top text-center">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => updateStatus(item.id, "approved")}
                        disabled={savingId === item.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-xs font-bold disabled:opacity-50"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => updateStatus(item.id, "rejected")}
                        disabled={savingId === item.id}
                        className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 text-xs font-bold disabled:opacity-50"
                      >
                        Reprovar
                      </button>
                      <button
                        onClick={() => updateStatus(item.id, "pending")}
                        disabled={savingId === item.id}
                        className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 text-xs font-bold disabled:opacity-50"
                      >
                        Ocultar
                      </button>
                      <button
                        onClick={() => deleteFeedback(item.id)}
                        disabled={deletingId === item.id}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredFeedbacks.length === 0 && (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-400">
                  Nenhum feedback encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CouponManager({ coupons, showToast, products = [] }) {
  const [form, setForm] = useState({
    code: "",
    type: "percent",
    value: "",
    minOrderValue: "",
    usageLimit: "",
    usagePerUser: "",
    firstPurchaseOnly: false,
    expiresAt: "",
    active: true,
    restrictToProducts: false,
    restrictedProductIds: [],
  });
  const [productSearch, setProductSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const filteredProductOptions = products.filter((p) => {
    const q = productSearch.toLowerCase();
    return (
      !q ||
      (p.name || "").toLowerCase().includes(q) ||
      (p.brand || "").toLowerCase().includes(q)
    );
  });

  const handleEdit = (coupon) => {
    setForm({
      code: coupon.code || "",
      type: coupon.type || "percent",
      value: coupon.value || "",
      minOrderValue: coupon.minOrderValue || "",
      usageLimit: coupon.usageLimit || "",
      usagePerUser: coupon.usagePerUser || "",
      firstPurchaseOnly: coupon.firstPurchaseOnly === true,
      expiresAt: coupon.expiresAt
        ? (() => {
            const d =
              coupon.expiresAt?.toDate?.() || new Date(coupon.expiresAt);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          })()
        : "",
      active: coupon.active ?? true,
      restrictToProducts:
        Array.isArray(coupon.restrictedProductIds) &&
        coupon.restrictedProductIds.length > 0,
      restrictedProductIds: coupon.restrictedProductIds || [],
    });
    setProductSearch("");
    setEditingId(coupon.id);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setProductSearch("");
    setForm({
      code: "",
      type: "percent",
      value: "",
      minOrderValue: "",
      usageLimit: "",
      usagePerUser: "",
      firstPurchaseOnly: false,
      expiresAt: "",
      active: true,
      restrictToProducts: false,
      restrictedProductIds: [],
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code) {
      showToast("Código é obrigatório", "error");
      return;
    }
    if (form.type !== "free_shipping" && !form.value) {
      showToast("Valor é obrigatório para este tipo de cupom", "error");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        code: String(form.code).toUpperCase().trim(),
        type: form.type,
        value: form.type === "free_shipping" ? 0 : Number(form.value),
        minOrderValue: Number(form.minOrderValue) || 0,
        usageLimit: Number(form.usageLimit) || 0,
        usagePerUser: Number(form.usagePerUser) || 0,
        firstPurchaseOnly: form.firstPurchaseOnly === true,
        expiresAt: form.expiresAt
          ? new Date(form.expiresAt + "T23:59:59").toISOString()
          : null,
        active: form.active,
        restrictedProductIds: form.restrictToProducts
          ? form.restrictedProductIds
          : [],
      };

      if (editingId) {
        await updateDoc(
          doc(db, "artifacts", appId, "public", "data", "coupons", editingId),
          payload,
        );
        showToast("Cupom atualizado com sucesso!");
        handleCancelEdit();
      } else {
        payload.usageCount = 0;
        payload.createdAt = serverTimestamp();
        await addDoc(
          collection(db, "artifacts", appId, "public", "data", "coupons"),
          payload,
        );
        showToast("Cupom criado com sucesso!");
        setProductSearch("");
        setForm({
          code: "",
          type: "percent",
          value: "",
          minOrderValue: "",
          usageLimit: "",
          usagePerUser: "",
          firstPurchaseOnly: false,
          expiresAt: "",
          active: true,
          restrictToProducts: false,
          restrictedProductIds: [],
        });
      }
    } catch (error) {
      console.error("Erro ao salvar cupom:", error);
      showToast("Erro ao salvar cupom", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (coupon) => {
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "coupons", coupon.id),
        { active: !coupon.active },
      );
      showToast(coupon.active ? "Cupom desativado!" : "Cupom ativado!");
    } catch (error) {
      console.error("Erro ao ativar/desativar cupom:", error);
      showToast("Erro ao ativar/desativar cupom", "error");
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteDoc(
        doc(db, "artifacts", appId, "public", "data", "coupons", id),
      );
      showToast("Cupom excluído com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir cupom:", error);
      showToast("Erro ao excluir cupom", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-800">
          Cupons de Desconto
        </h1>
        <p className="text-sm text-slate-500">
          Gerenciar códigos de desconto para seus clientes
        </p>
      </div>

      {/* Formulário de Criação */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-800">
            {editingId ? "Editar Cupom" : "Criar Novo Cupom"}
          </h2>
          {editingId && (
            <button
              onClick={handleCancelEdit}
              className="text-sm font-semibold text-slate-600 hover:text-slate-800 px-3 py-1.5 hover:bg-slate-100 rounded-lg transition"
            >
              Cancelar Edição
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Código do Cupom*
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                }
                placeholder="EX: DESCONTO10"
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Tipo de Desconto*
              </label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((p) => ({ ...p, type: e.target.value }))
                }
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <optgroup label="Desconto nos Produtos">
                  <option value="percent">Percentual (%)</option>
                  <option value="fixed">Fixo (R$)</option>
                </optgroup>
                <optgroup label="Desconto no Frete">
                  <option value="shipping_percent">% no Frete</option>
                  <option value="shipping_fixed">R$ no Frete</option>
                  <option value="free_shipping">Frete Grátis</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Valor do Desconto{form.type !== "free_shipping" ? "*" : ""}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.value}
                onChange={(e) =>
                  setForm((p) => ({ ...p, value: e.target.value }))
                }
                placeholder={
                  form.type === "free_shipping"
                    ? "Não aplicável"
                    : form.type === "percent" ||
                        form.type === "shipping_percent"
                      ? "10"
                      : "50.00"
                }
                disabled={form.type === "free_shipping"}
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Valor Mínimo (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.minOrderValue}
                onChange={(e) =>
                  setForm((p) => ({ ...p, minOrderValue: e.target.value }))
                }
                placeholder="0 = sem mínimo"
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Limite de Usos
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.usageLimit}
                onChange={(e) =>
                  setForm((p) => ({ ...p, usageLimit: e.target.value }))
                }
                placeholder="0 = ilimitado"
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Limite por Usuário
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.usagePerUser}
                onChange={(e) =>
                  setForm((p) => ({ ...p, usagePerUser: e.target.value }))
                }
                placeholder="0 = sem limite"
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Data de Validade
              </label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) =>
                  setForm((p) => ({ ...p, expiresAt: e.target.value }))
                }
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.firstPurchaseOnly === true}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      firstPurchaseOnly: e.target.checked,
                    }))
                  }
                  className="mt-1 w-4 h-4 accent-indigo-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-700">
                    Cupom de primeira compra
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Válido apenas se o e-mail do cliente ainda não tiver pedido
                    anterior.
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Restrição por produtos */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.restrictToProducts}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    restrictToProducts: e.target.checked,
                    restrictedProductIds: e.target.checked
                      ? p.restrictedProductIds
                      : [],
                  }))
                }
                className="mt-1 w-4 h-4 accent-indigo-600"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-700">
                  Restringir a produtos específicos
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Se ativado, o desconto só se aplica aos produtos selecionados
                  abaixo.
                </span>
              </span>
            </label>

            {form.restrictToProducts && (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Buscar produto pelo nome ou marca..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
                />

                {form.restrictedProductIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.restrictedProductIds.map((pid) => {
                      const prod = products.find((p) => p.id === pid);
                      return (
                        <span
                          key={pid}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold"
                        >
                          {prod ? prod.name : pid}
                          <button
                            type="button"
                            onClick={() =>
                              setForm((p) => ({
                                ...p,
                                restrictedProductIds:
                                  p.restrictedProductIds.filter(
                                    (id) => id !== pid,
                                  ),
                              }))
                            }
                            className="hover:text-rose-600 transition"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100">
                  {filteredProductOptions.length === 0 && (
                    <p className="p-3 text-sm text-slate-400 text-center">
                      Nenhum produto encontrado.
                    </p>
                  )}
                  {filteredProductOptions.map((prod) => {
                    const selected = form.restrictedProductIds.includes(
                      prod.id,
                    );
                    return (
                      <label
                        key={prod.id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition ${selected ? "bg-indigo-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setForm((p) => ({
                              ...p,
                              restrictedProductIds: selected
                                ? p.restrictedProductIds.filter(
                                    (id) => id !== prod.id,
                                  )
                                : [...p.restrictedProductIds, prod.id],
                            }))
                          }
                          className="w-4 h-4 accent-indigo-600"
                        />
                        {prod.image && (
                          <img
                            src={prod.image}
                            alt={prod.name}
                            className="w-8 h-8 rounded-lg object-cover shrink-0"
                          />
                        )}
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-slate-800 truncate">
                            {prod.name}
                          </span>
                          {prod.brand && (
                            <span className="block text-xs text-slate-400">
                              {prod.brand}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex items-center gap-2 bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold px-6 py-3 rounded-xl transition"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl disabled:opacity-50 transition"
            >
              {editingId ? (
                <>
                  <Edit size={18} />
                  {isSaving ? "Atualizando..." : "Atualizar Cupom"}
                </>
              ) : (
                <>
                  <Plus size={18} />
                  {isSaving ? "Salvando..." : "Criar Cupom"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de cupons */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <p className="font-semibold text-slate-700">
            {coupons.length === 0
              ? "Nenhum cupom cadastrado"
              : `${coupons.length} cupom${coupons.length > 1 ? "s" : ""} cadastrado${coupons.length > 1 ? "s" : ""}`}
          </p>
        </div>
        {coupons.length > 0 && (
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-4">Código</th>
                <th className="p-4">Desconto</th>
                <th className="p-4">Mínimo</th>
                <th className="p-4">Usos</th>
                <th className="p-4">Por Usuário</th>
                <th className="p-4">Validade</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coupons.map((coupon) => {
                const isExpired =
                  coupon.expiresAt &&
                  (coupon.expiresAt?.toDate?.() || new Date(coupon.expiresAt)) <
                    new Date();
                const limitReached =
                  coupon.usageLimit > 0 &&
                  coupon.usageCount >= coupon.usageLimit;

                return (
                  <tr
                    key={coupon.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="p-4">
                      <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg text-sm">
                        {coupon.code || coupon.id}
                      </span>
                      {coupon.firstPurchaseOnly === true && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-fuchsia-100 text-fuchsia-700 text-[11px] font-bold uppercase tracking-wide">
                            1a compra
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-semibold text-slate-800">
                      {coupon.type === "free_shipping" ? (
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-sm font-bold">
                          Frete Grátis
                        </span>
                      ) : coupon.type === "percent" ||
                        coupon.type === "shipping_percent" ? (
                        <span>
                          {coupon.value}%{" "}
                          {coupon.type === "shipping_percent" ? "(Frete)" : ""}
                        </span>
                      ) : (
                        <span>
                          R$ {Number(coupon.value).toFixed(2)}
                          {coupon.type === "shipping_fixed" ? " (Frete)" : ""}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-slate-600">
                      {Number(coupon.minOrderValue) > 0
                        ? `R$ ${Number(coupon.minOrderValue).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="p-4 text-slate-600">
                      {Number(coupon.usageCount) || 0}
                      {coupon.usageLimit > 0 ? `/${coupon.usageLimit}` : ""}
                    </td>
                    <td className="p-4 text-slate-600">
                      {coupon.usagePerUser > 0 ? coupon.usagePerUser : "—"}
                    </td>
                    <td className="p-4 text-slate-600">
                      {coupon.expiresAt
                        ? (() => {
                            const d =
                              coupon.expiresAt?.toDate?.() ||
                              new Date(coupon.expiresAt);
                            return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
                          })()
                        : "Sem validade"}
                    </td>
                    <td className="p-4 text-center">
                      {isExpired || limitReached ? (
                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">
                          {isExpired ? "Expirado" : "Esgotado"}
                        </span>
                      ) : coupon.active ? (
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-bold">
                          Ativo
                        </span>
                      ) : (
                        <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded-full text-xs font-bold">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(coupon)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => toggleActive(coupon)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${coupon.active ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
                        >
                          {coupon.active ? "Desativar" : "Ativar"}
                        </button>
                        <button
                          onClick={() => handleDelete(coupon.id)}
                          disabled={deletingId === coupon.id}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 transition cursor-pointer"
                        >
                          {deletingId === coupon.id ? "..." : "Excluir"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AdminSettings({ showToast, storeSettings }) {
  const [config, setConfig] = useState({
    storeName: "",
    storeTagline: "",
    heroTitle: "Seu Estilo, Sua Vitrine",
    heroDescription:
      "Filtros rapidos, categorias inteligentes e colecoes em destaque para facilitar a compra no celular e no desktop.",
    logo: "",
    banners: [],
    announcementMessages: [],
    footerDescription: "",
    faqItems: [],
    customerHighlights: [],
    complimentsAndQuestionsContact: "",
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
    pickupMapUrl: "",
    storeAddress: {
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
    },
    catalog: DEFAULT_PRODUCT_CATALOG,
    shipping: {
      pickupEnabled: true,
      localCities: [],
      separationDays: 2,
      pacEnabled: true,
      pacRate: 25.0,
      pacDeliveryDays: "5 a 10",
      sedexEnabled: true,
      sedexRate: 37.5,
      sedexDeliveryDays: "2 a 4",
      localDeliveryTime: "mesmo dia",
      pickupTime: "1 dia útil",
    },
  });
  const [isUploading, setIsUploading] = useState(false);
  const [newFaq, setNewFaq] = useState({ question: "", answer: "" });
  const [newCustomerHighlight, setNewCustomerHighlight] = useState({
    author: "",
    stars: 5,
    text: "",
  });
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
  const [newSizeTable, setNewSizeTable] = useState({
    name: "",
    content: "",
  });
  const [editingSizeTableId, setEditingSizeTableId] = useState("");
  const [editSizeTableDraft, setEditSizeTableDraft] = useState({
    id: "",
    name: "",
    content: "",
  });
  const [announcementMessagesDraft, setAnnouncementMessagesDraft] =
    useState("");
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
      pickupMapUrl: String(sourceConfig.pickupMapUrl || "").trim(),
      storeAddress: normalizeStoreAddress(sourceConfig.storeAddress),
      announcementMessages: normalizeAnnouncementMessages(
        sourceConfig.announcementMessages,
      ),
      contactPhones: normalizePhoneList(sourceConfig.contactPhones),
      socialLinks: normalizeSocialLinks(sourceConfig.socialLinks),
      faqItems: normalizeFaqItems(sourceConfig.faqItems),
      customerHighlights: normalizeCustomerHighlights(
        sourceConfig.customerHighlights,
      ),
      complimentsAndQuestionsContact: String(
        sourceConfig.complimentsAndQuestionsContact || "",
      ).trim(),
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
          announcementMessages: normalizeAnnouncementMessages(
            storeSettings.announcementMessages,
          ),
          catalog: normalizeCatalog(storeSettings.catalog),
          socialLinks: normalizeSocialLinks(storeSettings.socialLinks),
          contactPhones: normalizePhoneList(storeSettings.contactPhones),
          faqItems: normalizeFaqItems(storeSettings.faqItems),
          customerHighlights: normalizeCustomerHighlights(
            storeSettings.customerHighlights,
          ),
          complimentsAndQuestionsContact: String(
            storeSettings.complimentsAndQuestionsContact || "",
          ).trim(),
          storeAddress: normalizeStoreAddress(storeSettings.storeAddress),
          shipping: storeSettings.shipping || {
            pickupEnabled: true,
            localCities: [],
            separationDays: 2,
            pacEnabled: true,
            pacRate: 25.0,
            pacDeliveryDays: "5 a 10",
            sedexEnabled: true,
            sedexRate: 37.5,
            sedexDeliveryDays: "2 a 4",
            localDeliveryTime: "mesmo dia",
            pickupTime: "1 dia útil",
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
      setAnnouncementMessagesDraft(
        normalizeAnnouncementMessages(storeSettings.announcementMessages).join(
          "\n",
        ),
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

  const handleAddFaq = () => {
    const question = String(newFaq.question || "").trim();
    const answer = String(newFaq.answer || "").trim();

    if (!question || !answer) {
      showToast("Preencha pergunta e resposta do FAQ", "error");
      return;
    }

    setConfig((prev) => ({
      ...prev,
      faqItems: [...normalizeFaqItems(prev.faqItems), { question, answer }],
    }));
    setNewFaq({ question: "", answer: "" });
  };

  const handleRemoveFaq = (index) => {
    setConfig((prev) => ({
      ...prev,
      faqItems: normalizeFaqItems(prev.faqItems).filter(
        (_, idx) => idx !== index,
      ),
    }));
  };

  const handleAddCustomerHighlight = () => {
    const author = String(newCustomerHighlight.author || "").trim();
    const text = String(newCustomerHighlight.text || "").trim();
    const stars = Math.max(
      1,
      Math.min(5, Math.round(Number(newCustomerHighlight.stars) || 5)),
    );

    if (!author || !text) {
      showToast("Preencha nome e comentário do cliente", "error");
      return;
    }

    setConfig((prev) => ({
      ...prev,
      customerHighlights: [
        ...normalizeCustomerHighlights(prev.customerHighlights),
        { author, stars, text },
      ],
    }));
    setNewCustomerHighlight({ author: "", stars: 5, text: "" });
  };

  const handleRemoveCustomerHighlight = (index) => {
    setConfig((prev) => ({
      ...prev,
      customerHighlights: normalizeCustomerHighlights(
        prev.customerHighlights,
      ).filter((_, idx) => idx !== index),
    }));
  };

  const handleStoreAddressCepChange = async (value) => {
    const maskedCep = maskCEP(value);
    setConfig((prev) => ({
      ...prev,
      storeAddress: {
        ...normalizeStoreAddress(prev.storeAddress),
        cep: maskedCep,
      },
    }));

    const cleanCep = maskedCep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();

      if (data?.erro) {
        showToast("CEP da loja não localizado", "error");
        return;
      }

      setConfig((prev) => ({
        ...prev,
        storeAddress: {
          ...normalizeStoreAddress(prev.storeAddress),
          cep: maskedCep,
          rua: data.logradouro || prev.storeAddress?.rua || "",
          bairro: data.bairro || prev.storeAddress?.bairro || "",
          cidade: data.localidade || prev.storeAddress?.cidade || "",
          estado: data.uf || prev.storeAddress?.estado || "",
        },
      }));
      showToast("Endereço da loja preenchido via CEP", "success");
    } catch (error) {
      console.error("Erro ao buscar CEP da loja:", error);
      showToast("Erro ao buscar CEP da loja", "error");
    }
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

  const handleAddSizeTable = () => {
    const name = String(newSizeTable.name || "").trim();
    const content = String(newSizeTable.content || "").trim();

    if (!name) {
      return showToast("Informe o nome da tabela de medidas", "error");
    }

    const html = buildSizeTableHtmlFromText(content);
    if (!html) {
      return showToast(
        "Não foi possível montar a tabela. Verifique o formato dos dados.",
        "error",
      );
    }

    const alreadyExists = (config.catalog?.sizeTables || []).some(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );

    if (alreadyExists) {
      return showToast("Já existe uma tabela com esse nome", "error");
    }

    setConfig((prev) => ({
      ...prev,
      catalog: {
        ...normalizeCatalog(prev.catalog),
        sizeTables: [
          ...(prev.catalog?.sizeTables || []),
          { id: createCatalogSizeTableId(), name, html },
        ],
      },
    }));

    setNewSizeTable({ name: "", content: "" });
    showToast("Tabela de medidas adicionada!");
  };

  const handleRemoveSizeTable = (sizeTableId) => {
    setConfig((prev) => ({
      ...prev,
      catalog: {
        ...normalizeCatalog(prev.catalog),
        sizeTables: (prev.catalog?.sizeTables || []).filter(
          (item) => item.id !== sizeTableId,
        ),
      },
    }));

    if (editingSizeTableId === sizeTableId) {
      setEditingSizeTableId("");
      setEditSizeTableDraft({ id: "", name: "", content: "" });
    }
  };

  const handleStartEditSizeTable = (sizeTable) => {
    setEditingSizeTableId(sizeTable.id);
    setEditSizeTableDraft({
      id: sizeTable.id,
      name: sizeTable.name,
      content: buildSizeTableTextFromHtml(sizeTable.html),
    });
  };

  const handleCancelEditSizeTable = () => {
    setEditingSizeTableId("");
    setEditSizeTableDraft({ id: "", name: "", content: "" });
  };

  const handleSaveSizeTableEdit = () => {
    const nextName = String(editSizeTableDraft.name || "").trim();
    const nextContent = String(editSizeTableDraft.content || "").trim();

    if (!nextName) {
      return showToast("Nome da tabela é obrigatório", "error");
    }

    const html = buildSizeTableHtmlFromText(nextContent);
    if (!html) {
      return showToast(
        "Não foi possível montar a tabela. Verifique os dados informados.",
        "error",
      );
    }

    const hasDuplicatedName = (config.catalog?.sizeTables || []).some(
      (item) =>
        item.name.toLowerCase() === nextName.toLowerCase() &&
        item.id !== editingSizeTableId,
    );

    if (hasDuplicatedName) {
      return showToast("Já existe outra tabela com esse nome", "error");
    }

    setConfig((prev) => ({
      ...prev,
      catalog: {
        ...normalizeCatalog(prev.catalog),
        sizeTables: (prev.catalog?.sizeTables || []).map((item) =>
          item.id === editingSizeTableId
            ? { ...item, name: nextName, html }
            : item,
        ),
      },
    }));

    handleCancelEditSizeTable();
    showToast("Tabela de medidas atualizada!");
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
                Título da Hero Section
              </label>
              <input
                type="text"
                value={config.heroTitle || ""}
                onChange={(e) =>
                  setConfig({ ...config, heroTitle: e.target.value })
                }
                placeholder="Ex: Seu Estilo, Sua Vitrine"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                Descrição da Hero Section
              </label>
              <textarea
                rows={3}
                value={config.heroDescription || ""}
                onChange={(e) =>
                  setConfig({ ...config, heroDescription: e.target.value })
                }
                placeholder="Ex: Filtros rápidos, categorias inteligentes e coleções em destaque..."
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Esses textos aparecem no destaque principal logo abaixo dos
                banners da loja.
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                Barra de anúncios do topo
              </label>
              <textarea
                rows={5}
                value={announcementMessagesDraft}
                onChange={(e) => {
                  const draft = e.target.value;
                  setAnnouncementMessagesDraft(draft);
                  setConfig((prev) => ({
                    ...prev,
                    announcementMessages: normalizeAnnouncementMessages(draft),
                  }));
                }}
                placeholder={
                  "Digite uma mensagem por linha\nFrete grátis acima de R$ 299\nCupom JNPRIMEIRA para novos clientes"
                }
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                A tarja só aparece no site quando houver pelo menos uma mensagem
                cadastrada.
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

        <div className="space-y-4">
          <h4 className="text-sm font-black uppercase tracking-wider text-slate-600">
            Tabelas de Medidas
          </h4>
          <p className="text-sm text-slate-500">
            Cadastre modelos para inserir automaticamente na descrição do
            produto. Formato esperado por linha: Tamanho, Peito e Comprimento.
            Exemplo: M (54x75) 54 cm 75 cm
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <input
              placeholder="Nome do modelo (ex: Camisetas Adulto)"
              className="p-2.5 border rounded-lg text-sm outline-none"
              value={newSizeTable.name}
              onChange={(e) =>
                setNewSizeTable((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
            />
            <button
              onClick={handleAddSizeTable}
              className="bg-slate-900 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-lg"
            >
              Adicionar Tabela
            </button>
            <textarea
              rows={4}
              placeholder={
                "P (50x70) 50 cm 70 cm\nM (54x75) 54 cm 75 cm\nG (58x78) 58 cm 78 cm"
              }
              className="lg:col-span-2 p-2.5 border rounded-lg text-sm outline-none"
              value={newSizeTable.content}
              onChange={(e) =>
                setNewSizeTable((prev) => ({
                  ...prev,
                  content: e.target.value,
                }))
              }
            />
          </div>

          <div className="overflow-auto border border-slate-200 rounded-xl bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Prévia</th>
                  <th className="text-right p-3">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(config.catalog?.sizeTables || []).length === 0 ? (
                  <tr>
                    <td colSpan="3" className="p-4 text-sm text-slate-500">
                      Nenhuma tabela de medidas cadastrada ainda.
                    </td>
                  </tr>
                ) : (
                  (config.catalog?.sizeTables || []).map((sizeTable) => (
                    <tr key={sizeTable.id}>
                      <td className="p-3 align-top font-semibold text-slate-700">
                        {editingSizeTableId === sizeTable.id ? (
                          <input
                            value={editSizeTableDraft.name}
                            onChange={(e) =>
                              setEditSizeTableDraft((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none"
                          />
                        ) : (
                          sizeTable.name
                        )}
                      </td>
                      <td className="p-3 align-top text-slate-600">
                        {editingSizeTableId === sizeTable.id ? (
                          <textarea
                            rows={4}
                            value={editSizeTableDraft.content}
                            onChange={(e) =>
                              setEditSizeTableDraft((prev) => ({
                                ...prev,
                                content: e.target.value,
                              }))
                            }
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none"
                          />
                        ) : (
                          <div className="max-w-xl overflow-x-auto border border-slate-200 rounded-lg p-2 bg-slate-50">
                            <div
                              className="prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{
                                __html: sanitizeDescriptionHtml(sizeTable.html),
                              }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="p-3 align-top">
                        <div className="flex items-center justify-end gap-2">
                          {editingSizeTableId === sizeTable.id ? (
                            <>
                              <button
                                onClick={handleSaveSizeTableEdit}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={handleCancelEditSizeTable}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() =>
                                  handleStartEditSizeTable(sizeTable)
                                }
                                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() =>
                                  handleRemoveSizeTable(sizeTable.id)
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
                  ))
                )}
              </tbody>
            </table>
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

            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700">
                Canal de dúvidas e elogios (WhatsApp, e-mail ou link)
              </label>
              <input
                type="text"
                value={config.complimentsAndQuestionsContact || ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    complimentsAndQuestionsContact: e.target.value,
                  })
                }
                placeholder="11999999999 ou contato@loja.com"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Exibe o botão "Enviar dúvida/elogios" no FAQ do rodapé.
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4 border rounded-xl p-4 bg-slate-50">
            <h4 className="font-bold text-slate-700">FAQ do Rodapé</h4>
            <div className="space-y-3">
              <input
                type="text"
                value={newFaq.question}
                onChange={(e) =>
                  setNewFaq((prev) => ({ ...prev, question: e.target.value }))
                }
                placeholder="Pergunta"
                className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <textarea
                rows={3}
                value={newFaq.answer}
                onChange={(e) =>
                  setNewFaq((prev) => ({ ...prev, answer: e.target.value }))
                }
                placeholder="Resposta"
                className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddFaq}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold"
              >
                Adicionar FAQ
              </button>
            </div>

            <div className="space-y-2">
              {normalizeFaqItems(config.faqItems).length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nenhuma pergunta configurada. O FAQ não será exibido no
                  rodapé.
                </p>
              ) : (
                normalizeFaqItems(config.faqItems).map((item, index) => (
                  <div
                    key={`${item.question}-${index}`}
                    className="rounded-lg border bg-white p-3"
                  >
                    <p className="text-sm font-semibold text-slate-700">
                      {item.question}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">{item.answer}</p>
                    <button
                      type="button"
                      onClick={() => handleRemoveFaq(index)}
                      className="mt-2 text-xs font-bold text-rose-600 hover:text-rose-700"
                    >
                      Remover
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4 border rounded-xl p-4 bg-slate-50">
            <h4 className="font-bold text-slate-700">Avaliações de Clientes</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={newCustomerHighlight.author}
                onChange={(e) =>
                  setNewCustomerHighlight((prev) => ({
                    ...prev,
                    author: e.target.value,
                  }))
                }
                placeholder="Nome do cliente"
                className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 sm:col-span-2"
              />
              <input
                type="number"
                min="1"
                max="5"
                value={newCustomerHighlight.stars}
                onChange={(e) =>
                  setNewCustomerHighlight((prev) => ({
                    ...prev,
                    stars: e.target.value,
                  }))
                }
                className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-500 self-center">
                Nota de 1 a 5
              </span>
              <textarea
                rows={3}
                value={newCustomerHighlight.text}
                onChange={(e) =>
                  setNewCustomerHighlight((prev) => ({
                    ...prev,
                    text: e.target.value,
                  }))
                }
                placeholder="Comentário do cliente"
                className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 sm:col-span-2"
              />
              <button
                type="button"
                onClick={handleAddCustomerHighlight}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold sm:col-span-2"
              >
                Adicionar Avaliação
              </button>
            </div>

            <div className="space-y-2">
              {normalizeCustomerHighlights(config.customerHighlights).length ===
              0 ? (
                <p className="text-xs text-slate-500">
                  Nenhuma avaliação cadastrada. A seção não será exibida no
                  rodapé.
                </p>
              ) : (
                normalizeCustomerHighlights(config.customerHighlights).map(
                  (item, index) => (
                    <div
                      key={`${item.author}-${index}`}
                      className="rounded-lg border bg-white p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-700">
                          {item.author}
                        </p>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, starIndex) => (
                            <Star
                              key={`${item.author}-${index}-${starIndex}`}
                              size={13}
                              className={
                                starIndex < item.stars
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-300"
                              }
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{item.text}</p>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomerHighlight(index)}
                        className="mt-2 text-xs font-bold text-rose-600 hover:text-rose-700"
                      >
                        Remover
                      </button>
                    </div>
                  ),
                )
              )}
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
                Link da localização da loja (Mapa)
              </label>
              <input
                type="text"
                value={config.pickupMapUrl || ""}
                onChange={(e) =>
                  setConfig({ ...config, pickupMapUrl: e.target.value })
                }
                placeholder="Ex: https://maps.app.goo.gl/..."
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-2">
                Esse link será exibido nos pedidos de retirada para abrir o mapa
                com a localização da loja.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-semibold text-slate-700">
                Endereço da loja para retirada
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    CEP
                  </label>
                  <input
                    value={config.storeAddress?.cep || ""}
                    onChange={(e) =>
                      handleStoreAddressCepChange(e.target.value)
                    }
                    placeholder="00000-000"
                    maxLength={9}
                    className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Cidade
                  </label>
                  <input
                    value={config.storeAddress?.cidade || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        storeAddress: {
                          ...normalizeStoreAddress(prev.storeAddress),
                          cidade: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Estado (UF)
                  </label>
                  <input
                    value={config.storeAddress?.estado || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        storeAddress: {
                          ...normalizeStoreAddress(prev.storeAddress),
                          estado: e.target.value.toUpperCase(),
                        },
                      }))
                    }
                    maxLength={2}
                    className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Bairro
                  </label>
                  <input
                    value={config.storeAddress?.bairro || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        storeAddress: {
                          ...normalizeStoreAddress(prev.storeAddress),
                          bairro: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Rua / Logradouro
                  </label>
                  <input
                    value={config.storeAddress?.rua || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        storeAddress: {
                          ...normalizeStoreAddress(prev.storeAddress),
                          rua: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Número
                  </label>
                  <input
                    value={config.storeAddress?.numero || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        storeAddress: {
                          ...normalizeStoreAddress(prev.storeAddress),
                          numero: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Complemento
                  </label>
                  <input
                    value={config.storeAddress?.complemento || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        storeAddress: {
                          ...normalizeStoreAddress(prev.storeAddress),
                          complemento: e.target.value,
                        },
                      }))
                    }
                    className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Prazo de Separação / Postagem */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-amber-800 mb-1">
                  ⏱ Prazo de Separação / Postagem
                </h4>
                <p className="text-xs text-amber-700">
                  Quantos dias úteis você precisa para separar o pedido e postar
                  antes que a transportadora inicie a entrega. Esse prazo será
                  somado ao prazo de entrega e exibido ao cliente.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dias úteis para separação/postagem
                </label>
                <input
                  type="number"
                  min="0"
                  value={config.shipping.separationDays ?? 2}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      shipping: {
                        ...config.shipping,
                        separationDays: e.target.value,
                      },
                    })
                  }
                  className="w-32 p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Correios PAC */}
            <div className="bg-white border rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    📦 Correios (PAC)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Envio via Correios PAC para cidades sem entrega local
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.shipping.pacEnabled !== false}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        shipping: {
                          ...config.shipping,
                          pacEnabled: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4"
                  />
                  Ativo
                </label>
              </div>
              {config.shipping.pacEnabled !== false && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Taxa (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.shipping.pacRate ?? 25}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          shipping: {
                            ...config.shipping,
                            pacRate: e.target.value,
                          },
                        })
                      }
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Prazo de entrega (ex: "5 a 10")
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="5 a 10"
                        value={config.shipping.pacDeliveryDays ?? "5 a 10"}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            shipping: {
                              ...config.shipping,
                              pacDeliveryDays: e.target.value,
                            },
                          })
                        }
                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <span className="text-xs text-slate-500 shrink-0">
                        dias úteis
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Correios Sedex */}
            <div className="bg-white border rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    🚀 Correios (Sedex)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Envio expresso via Correios Sedex para cidades sem entrega
                    local
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.shipping.sedexEnabled !== false}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        shipping: {
                          ...config.shipping,
                          sedexEnabled: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4"
                  />
                  Ativo
                </label>
              </div>
              {config.shipping.sedexEnabled !== false && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Taxa (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={config.shipping.sedexRate ?? 37.5}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          shipping: {
                            ...config.shipping,
                            sedexRate: e.target.value,
                          },
                        })
                      }
                      className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Prazo de entrega (ex: "2 a 4")
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="2 a 4"
                        value={config.shipping.sedexDeliveryDays ?? "2 a 4"}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            shipping: {
                              ...config.shipping,
                              sedexDeliveryDays: e.target.value,
                            },
                          })
                        }
                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <span className="text-xs text-slate-500 shrink-0">
                        dias úteis
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Retirada na loja */}
            <div className="bg-white border rounded-xl p-5 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  🏪 Retirada na Loja (Pickup)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Prazo estimado até o pedido estar disponível para retirada
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Prazo para disponibilizar para retirada
                </label>
                <input
                  type="text"
                  placeholder="1 dia útil"
                  value={config.shipping.pickupTime ?? "1 dia útil"}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      shipping: {
                        ...config.shipping,
                        pickupTime: e.target.value,
                      },
                    })
                  }
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Entrega local */}
            <div className="bg-white border rounded-xl p-5 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  🛵 Entrega Local (Motoboy)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Prazo de entrega após separação/postagem
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Prazo de entrega local
                </label>
                <input
                  type="text"
                  placeholder="mesmo dia"
                  value={config.shipping.localDeliveryTime ?? "mesmo dia"}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      shipping: {
                        ...config.shipping,
                        localDeliveryTime: e.target.value,
                      },
                    })
                  }
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
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
