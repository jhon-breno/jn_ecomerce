import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Map,
  MessageCircle,
  Edit,
  Eye,
  UserPlus,
  FileText,
  AlertTriangle,
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

// URL do backend de pagamentos (defina a URL correta para produção)
const BACKEND_URL = "http://localhost:3000";

const createIdempotencyKey = (scope) =>
  `${scope}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
const appId = typeof __app_id !== "undefined" ? __app_id : "loja-virtual-app";

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
    logo: "",
    banners: [],
    mpPublicKey: "",
    pixKey: "",
    shipping: {
      pickupEnabled: true,
      correiosBaseRate: 25.0,
      localCities: [],
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
  const [currentRoute, setCurrentRoute] = useState(
    window.location.hash || "#/",
  );

  useEffect(() => {
    const handleHashChange = () =>
      setCurrentRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const isAdminRoute = currentRoute === "#/admin";

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
      ) : (
        <AdminDashboard
          products={products}
          orders={orders}
          abandonedCarts={abandonedCarts}
          showToast={showToast}
          storeSettings={storeSettings}
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
  const [selectedProduct, setSelectedProduct] = useState(null);

  const isRealUser = user && !user.isAnonymous;

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
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === "Todas" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
    <div className="relative min-h-[calc(100vh-36px)] pb-20 bg-slate-50/50 print:hidden">
      {/* Header */}
      <header className="bg-slate-100 sticky top-0 z-40 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-4 flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 md:gap-3">
            {storeSettings.logo ? (
              <img
                src={storeSettings.logo}
                alt="Logo da Loja"
                className="h-10 md:h-12 w-auto object-contain"
              />
            ) : (
              <div className="bg-indigo-200/50 w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center shrink-0">
                <ShoppingBag size={24} className="text-indigo-700" />
              </div>
            )}
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 truncate">
              {storeSettings.storeName || "Aucela Multimarcas"}
            </h1>
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
      </header>

      {/* Banners Carousel */}
      <BannerCarousel banners={storeSettings.banners} />

      {/* Hero / Search Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white py-16 px-4 text-center border-b-[6px] border-fuchsia-500 shadow-2xl">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="relative z-10">
          <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200 drop-shadow-2xl">
            Descubra Nossas Ofertas
          </h2>
          <div className="max-w-xl mx-auto relative mt-8">
            <Search
              className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-400"
              size={22}
            />
            <input
              type="text"
              placeholder="Buscar produtos pelo nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-14 pr-6 py-4 rounded-full bg-white/95 text-slate-900 font-bold focus:outline-none focus:ring-4 focus:ring-fuchsia-400/50 transition-all duration-300 shadow-2xl text-sm md:text-base border-2 border-transparent focus:border-fuchsia-300"
            />
          </div>
        </div>
      </div>

      {/* Category Filter Scroll */}
      {categories.length > 1 && (
        <div className="bg-white/70 backdrop-blur-md border-b sticky top-[73px] md:top-[81px] z-30 shadow-sm border-slate-200/50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex gap-3 overflow-x-auto hide-scrollbar items-center">
            <Filter
              size={18}
              className="text-indigo-400 shrink-0 mr-2 hidden sm:block drop-shadow-sm"
            />
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-6 py-2.5 rounded-full whitespace-nowrap text-sm font-bold transition-all duration-300 ${
                  selectedCategory === cat
                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 scale-105"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 hover:shadow-sm"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Product Grid */}
      <main className="max-w-[1400px] mx-auto px-4 py-8 md:py-12">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-24 bg-white/50 backdrop-blur rounded-3xl border border-slate-200/50 shadow-sm mt-8 max-w-2xl mx-auto">
            <Package
              size={64}
              className="mx-auto text-indigo-200 mb-6 drop-shadow-sm"
            />
            <h3 className="text-xl font-bold text-slate-600">
              Nenhum produto encontrado.
            </h3>
            <p className="text-slate-400 mt-2">
              Tente buscar por outro termo ou categoria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 md:gap-8">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-300/50 transition-all duration-500 group flex flex-col hover:-translate-y-2 relative cursor-pointer"
              >
                {/* Overlay de Hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10"></div>

                {/* Imagem Proporção Vertical (Moda/Geral) */}
                <div className="relative aspect-[4/5] overflow-hidden bg-slate-50">
                  {product.images?.[0] || product.image ? (
                    <img
                      src={product.images?.[0] || product.image}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-100/50">
                      <ImageIcon size={48} className="drop-shadow-sm" />
                    </div>
                  )}
                  {/* Etiqueta de Categoria */}
                  {product.category && (
                    <span className="absolute top-4 left-4 bg-white/90 backdrop-blur-md text-indigo-700 text-[10px] font-black px-3 py-1.5 rounded-xl border border-white shadow-sm uppercase tracking-wider z-20">
                      {product.category}
                    </span>
                  )}
                  {/* Etiqueta Esgotado */}
                  {Number(product.stock) <= 0 && (
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[4px] flex items-center justify-center z-20">
                      <span className="bg-rose-500 text-white px-4 py-2 rounded-full font-black text-xs shadow-xl uppercase tracking-widest border-2 border-white/50">
                        ESGOTADO
                      </span>
                    </div>
                  )}
                </div>

                {/* Informações do Produto */}
                <div className="p-5 md:p-6 flex flex-col flex-grow relative z-20 bg-white">
                  <h3 className="font-bold text-sm md:text-base text-slate-800 mb-2 line-clamp-2 leading-snug min-h-[2.75rem] group-hover:text-indigo-600 transition-colors">
                    {product.name}
                  </h3>

                  <div className="flex items-end justify-between mt-auto pt-4 border-t border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                        Por apenas
                      </span>
                      <span className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 leading-none">
                        R$ {Number(product.price).toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (product.variations) {
                          setSelectedProduct(product);
                        } else {
                          addToCart(product);
                        }
                      }}
                      disabled={Number(product.stock) <= 0}
                      className="bg-slate-900 group-hover:bg-gradient-to-r group-hover:from-indigo-500 group-hover:to-purple-500 disabled:bg-slate-100 disabled:text-slate-300 text-white w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-md hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-300 hover:scale-110 disabled:hover:scale-100 active:scale-95"
                    >
                      <Plus strokeWidth={3} className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

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
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 1.0.5 Product Details Modal
function ProductModal({ product, close, addToCart }) {
  // Converte a string de variedades (ex: "P, M, G") num array
  const variations = product.variations
    ? product.variations
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];

  const images =
    product.images?.length > 0
      ? product.images
      : product.image
        ? [product.image]
        : [];

  const [selectedVariation, setSelectedVariation] = useState(
    variations.length > 0 ? variations[0] : "",
  );
  const [qty, setQty] = useState(1);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const handleAdd = () => {
    if (variations.length > 0 && !selectedVariation) return;
    addToCart({ ...product, selectedVariation, image: images[0] || "" }, qty);
    close();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto print:hidden">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row animate-slide-up relative">
        {/* Botão Fechar */}
        <button
          onClick={close}
          className="absolute top-4 right-4 z-20 bg-white/80 backdrop-blur-md p-2 rounded-full hover:bg-white transition-colors shadow-sm"
        >
          <X size={20} className="text-slate-600" />
        </button>

        {/* Imagem do Produto e Galeria */}
        <div className="w-full md:w-1/2 bg-slate-100 relative flex flex-col">
          <div className="relative w-full aspect-square md:aspect-auto md:flex-1 bg-slate-50">
            {images.length > 0 ? (
              <img
                src={images[currentImgIndex]}
                alt={product.name}
                className="w-full h-full object-cover absolute inset-0"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300 absolute inset-0">
                <ImageIcon size={64} />
              </div>
            )}
            {product.category && (
              <span className="absolute top-4 left-4 bg-white/90 backdrop-blur-md text-indigo-700 text-xs font-black px-3 py-1.5 rounded-xl border border-white shadow-sm uppercase tracking-wider z-10">
                {product.category}
              </span>
            )}
          </div>

          {/* Miniaturas da Galeria */}
          {images.length > 1 && (
            <div className="flex gap-2 p-4 bg-white border-t border-slate-100 overflow-x-auto hide-scrollbar shrink-0">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImgIndex(idx)}
                  className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${currentImgIndex === idx ? "border-indigo-600 shadow-md" : "border-transparent opacity-70 hover:opacity-100"}`}
                >
                  <img
                    src={img}
                    className="w-full h-full object-cover"
                    alt={`Thumb ${idx}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalhes do Produto */}
        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col">
          <div className="flex-grow">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 leading-tight">
              {product.name}
            </h2>
            <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-6">
              R$ {Number(product.price).toFixed(2)}
            </div>

            <div className="prose prose-sm text-slate-600 mb-8">
              <p>
                {product.description ||
                  "Nenhuma descrição fornecida para este produto."}
              </p>
            </div>

            {/* Variedades (Tamanhos/Cores) */}
            {variations.length > 0 && (
              <div className="mb-6">
                <span className="block text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">
                  Selecione uma opção:
                </span>
                <div className="flex flex-wrap gap-2">
                  {variations.map((variation) => (
                    <button
                      key={variation}
                      onClick={() => setSelectedVariation(variation)}
                      className={`px-4 py-2 rounded-xl font-bold text-sm transition-all duration-200 border-2 ${
                        selectedVariation === variation
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm"
                          : "border-slate-200 text-slate-600 hover:border-indigo-300"
                      }`}
                    >
                      {variation}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantidade */}
            <div className="mb-8">
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
          </div>

          {/* Botão Adicionar */}
          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleAdd}
              disabled={Number(product.stock) <= 0}
              className="w-full py-4 rounded-2xl font-bold text-lg text-white shadow-lg transition-all duration-300 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-500/30 hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
            >
              <ShoppingBag size={22} />
              {Number(product.stock) > 0
                ? "Adicionar ao Carrinho"
                : "Produto Esgotado"}
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

  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, 5000); // Roda automaticamente a cada 5 segundos

    return () => clearInterval(interval);
  }, [banners]);

  const prevSlide = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? banners.length - 1 : prevIndex - 1,
    );
  };

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
  };

  if (!banners || banners.length === 0) return null;

  return (
    <div className="w-full h-40 sm:h-64 md:h-80 lg:h-96 bg-slate-900 relative group overflow-hidden">
      {/* Slides (Container com Transição Animada) */}
      <div
        className="flex w-full h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {banners.map((banner, index) => (
          <div key={index} className="min-w-full h-full relative shrink-0">
            <img
              src={banner}
              alt={`Banner ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
          </div>
        ))}
      </div>

      {/* Controles do Carrossel */}
      {banners.length > 1 && (
        <>
          {/* Botão Voltar */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 md:p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md shadow-lg"
          >
            <ChevronLeft size={24} />
          </button>

          {/* Botão Avançar */}
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 md:p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md shadow-lg"
          >
            <ChevronRight size={24} />
          </button>

          {/* Bolinhas Indicadoras (Dots) */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
            {banners.map((_, idx) => (
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
                      src={item.images?.[0] || item.image}
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
          showToast("CEP não encontrado", "error");
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
        const res = await fetch(`${BACKEND_URL}/api/pix`, {
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
        const res = await fetch(`${BACKEND_URL}/api/checkout/preference`, {
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
      showToast("Erro ao processar pedido", "error");
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
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl shadow-sm">
                <AlertTriangle size={24} className="shrink-0" />
                <p className="text-sm">
                  <strong>Aviso:</strong> Você está no ambiente de simulação da
                  interface. Nenhuma cobrança real será efetuada com o seu
                  cartão.
                </p>
              </div>

              <h3 className="text-lg font-bold flex items-center gap-2">
                <CreditCard size={20} /> Método de Pagamento
              </h3>

              <div className="grid gap-3">
                {["PIX", "Cartão de Crédito", "Boleto"].map((method) => (
                  <div key={method} className="flex flex-col">
                    <label
                      className={`flex items-center p-4 border rounded-xl cursor-pointer transition ${paymentMethod === method ? "border-indigo-500 bg-indigo-50 shadow-sm" : "hover:bg-slate-50"}`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        className="mr-3 w-4 h-4 text-indigo-600"
                        checked={paymentMethod === method}
                        onChange={() => setPaymentMethod(method)}
                      />
                      {method === "PIX" && (
                        <QrCode size={18} className="mr-2 text-teal-600" />
                      )}
                      {method === "Cartão de Crédito" && (
                        <CreditCard
                          size={18}
                          className="mr-2 text-indigo-600"
                        />
                      )}
                      {method === "Boleto" && (
                        <FileText size={18} className="mr-2 text-slate-600" />
                      )}
                      <span className="font-semibold text-slate-700">
                        {method}
                      </span>
                    </label>

                    {/* Formulário Visual para Cartão de Crédito */}
                    {paymentMethod === method &&
                      method === "Cartão de Crédito" && (
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
                Pedido Registado!
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

              {paymentMethod === "Boleto" && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 mt-6 text-left w-full shadow-sm mx-auto max-w-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-rose-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg z-10">
                    BOLETO DE TESTE
                  </div>
                  <h4 className="font-bold text-slate-800 mb-2 flex items-center justify-center gap-2">
                    <FileText className="text-slate-600" /> Boleto Bancário
                  </h4>
                  <p className="text-xs text-slate-500 mb-6 text-center">
                    Seu boleto vence em 3 dias úteis. A compensação pode demorar
                    até 48h.
                  </p>

                  <div className="w-full mb-6">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                      Linha Digitável
                    </label>
                    <div className="flex">
                      <input
                        readOnly
                        value="34191.09008 63571.277308 71444.640008 5 91000000000000"
                        className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-l-lg text-[10px] sm:text-xs font-mono outline-none text-slate-600 truncate"
                      />
                      <button
                        onClick={() => showToast("Código copiado!")}
                        className="bg-slate-800 text-white px-4 font-bold rounded-r-lg hover:bg-slate-900 transition"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => showToast("Abrindo boleto...")}
                    className="w-full py-3.5 bg-indigo-50 text-indigo-700 font-bold rounded-xl border border-indigo-200 hover:bg-indigo-100 transition flex items-center justify-center gap-2"
                  >
                    <Printer size={18} /> Visualizar Boleto (PDF)
                  </button>
                </div>
              )}

              {(paymentMethod === "Cartão de Crédito" ||
                paymentMethod === "credit_card" ||
                paymentMethod.toLowerCase().includes("cartão")) && (
                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 mt-6 text-left w-full mx-auto max-w-sm shadow-sm">
                  <h4 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
                    <CreditCard /> Pagamento Simulado
                  </h4>
                  <p className="text-sm text-emerald-700">
                    Seu cartão seria processado aqui e o pagamento confirmado
                    através do Backend. O pedido de simulação foi gravado.
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
}) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-slate-50 p-4 md:p-8 overflow-y-auto h-full print:p-0 print:bg-white print:overflow-visible relative">
        <div className={activeTab !== "dashboard" ? "print:hidden" : ""}>
          {activeTab === "dashboard" && (
            <AdminOverview
              products={products}
              orders={orders}
              abandonedCarts={abandonedCarts}
            />
          )}
        </div>
        <div className={activeTab !== "products" ? "print:hidden" : ""}>
          {activeTab === "products" && (
            <ProductManager products={products} showToast={showToast} />
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
            <OrdersList orders={orders} showToast={showToast} />
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

function AdminOverview({ products, orders, abandonedCarts }) {
  const totalRevenue = orders.reduce(
    (sum, order) => sum + (Number(order.total) || 0),
    0,
  );
  const totalOnline = orders.filter((o) => o.type === "online").length;
  const totalPresencial = orders.filter((o) => o.type === "presencial").length;

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

function StatCard({ title, value, icon, color }) {
  return (
    <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200/60 flex items-center gap-5 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-300">
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
      </div>
    </div>
  );
}

function ProductManager({ products, showToast }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null); // Estado para o modal de confirmação
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    category: "",
    description: "",
    stock: "",
    images: [],
    variations: "",
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        ...formData,
        price: Number(formData.price),
        stock: Number(formData.stock),
        image: formData.images?.[0] || "", // Mantém compatibilidade com dados antigos
      };

      if (editingId) {
        await updateDoc(
          doc(db, "artifacts", appId, "public", "data", "products", editingId),
          { ...productData, updatedAt: serverTimestamp() },
        );
        showToast("Produto atualizado com sucesso!");
      } else {
        await addDoc(
          collection(db, "artifacts", appId, "public", "data", "products"),
          { ...productData, createdAt: serverTimestamp() },
        );
        showToast("Produto salvo com sucesso!");
      }

      closeForm();
    } catch (error) {
      showToast("Erro ao salvar", "error");
    }
  };

  const handleEdit = (product) => {
    setFormData({
      name: product.name || "",
      price: product.price || "",
      category: product.category || "",
      description: product.description || "",
      stock: product.stock || "",
      images: product.images || (product.image ? [product.image] : []),
      variations: product.variations || "",
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
          productToDelete,
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
      category: "",
      description: "",
      stock: "",
      images: [],
      variations: "",
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
            <div className="flex flex-wrap gap-3">
              {(formData.images || []).map((imgBase64, idx) => (
                <div
                  key={idx}
                  className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden border border-slate-200 shadow-sm group"
                >
                  <img
                    src={imgBase64}
                    alt={`Upload ${idx}`}
                    className="w-full h-full object-cover"
                  />
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
              <input
                required
                placeholder="Categoria (ex: Camisetas)"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="p-3 border rounded-lg outline-none focus:border-indigo-400"
              />
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

            <div className="flex flex-col md:col-span-2">
              <input
                placeholder="Variedades (Tamanhos/Cores) - Separe por vírgula. Ex: P, M, G ou Azul, Preto"
                value={formData.variations}
                onChange={(e) =>
                  setFormData({ ...formData, variations: e.target.value })
                }
                className="p-3 border rounded-lg outline-none focus:border-indigo-400"
              />
            </div>

            <textarea
              placeholder="Descrição breve"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="md:col-span-2 p-3 border rounded-lg outline-none focus:border-indigo-400"
            />
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
        <button
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 hover:bg-indigo-700 transition text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
        >
          <Plus size={18} />{" "}
          <span className="hidden sm:inline">Novo Produto</span>
        </button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="border-b">
              <th className="p-4">Produto</th>
              <th className="p-4">Categoria</th>
              <th className="p-4">Preço</th>
              <th className="p-4">Estoque</th>
              <th className="p-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-medium flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded overflow-hidden shrink-0">
                    {(p.images?.[0] || p.image) && (
                      <img
                        src={p.images?.[0] || p.image}
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
                      onClick={() => setProductToDelete(p.id)}
                      className="text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded transition-colors"
                      title="Excluir Produto"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-400">
                  Nenhum produto cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!productToDelete}
        title="Excluir Produto"
        message="Tem certeza que deseja excluir este produto do catálogo? Esta ação não poderá ser desfeita."
        onConfirm={executeDeleteProduct}
        onCancel={() => setProductToDelete(null)}
        confirmText="Excluir Produto"
      />
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
          const res = await fetch(`${BACKEND_URL}/api/pix`, {
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
      showToast("Erro ao finalizar venda", "error");
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
                    src={p.images?.[0] || p.image}
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

function OrdersList({ orders, showToast }) {
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [trackingDrafts, setTrackingDrafts] = useState({});

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

  const handleStatusChange = async (order, nextStatus) => {
    if (!order?.id || !nextStatus) return;
    setSavingOrderId(order.id);
    try {
      const payload = {
        status: nextStatus,
        statusUpdatedAt: serverTimestamp(),
        statusHistory: statusHistoryPush(order, nextStatus, "status_update"),
      };

      if (nextStatus === "enviado" && !order.shippedAt) {
        payload.shippedAt = serverTimestamp();
      }
      if (nextStatus === "entregue") {
        payload.deliveredAt = serverTimestamp();
      }

      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "orders", order.id),
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

    const confirmed = window.confirm(
      "Confirmar estorno deste pedido? O status será alterado para ESTORNADO.",
    );
    if (!confirmed) return;

    setSavingOrderId(order.id);
    try {
      await updateDoc(
        doc(db, "artifacts", appId, "public", "data", "orders", order.id),
        {
          status: "estornado",
          refundedAt: serverTimestamp(),
          statusUpdatedAt: serverTimestamp(),
          refundRequestedBy: "painel_admin",
          statusHistory: statusHistoryPush(order, "estornado", "refund"),
        },
      );
      showToast("Pedido marcado como estornado.");
    } catch (error) {
      console.error("Erro ao estornar pedido:", error);
      showToast("Erro ao estornar pedido", "error");
    } finally {
      setSavingOrderId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
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
          {orders.map((o) => {
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
                </td>
              </tr>
            );
          })}
          {orders.length === 0 && (
            <tr>
              <td colSpan="8" className="p-8 text-center text-slate-400">
                Nenhuma venda registrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
    logo: "",
    banners: [],
    mpPublicKey: "",
    pixKey: "",
    shipping: {
      pickupEnabled: true,
      correiosBaseRate: 25.0,
      localCities: [],
    },
  });
  const [isUploading, setIsUploading] = useState(false);
  const [newCity, setNewCity] = useState({ name: "", state: "", rate: "" });

  // Carrega as configurações globais para o formulário local
  useEffect(() => {
    if (storeSettings) {
      setConfig((prev) => ({
        ...prev,
        ...storeSettings,
        shipping: storeSettings.shipping || {
          pickupEnabled: true,
          correiosBaseRate: 25.0,
          localCities: [],
        },
      }));
    }
  }, [storeSettings]);

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

  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      await setDoc(
        doc(db, "artifacts", appId, "public", "data", "settings", "config"),
        config,
        { merge: true },
      );
      showToast("Configurações salvas e aplicadas na loja!");
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
          Salvar Alterações
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
                    src={banner}
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
                      <Map size={16} className="text-slate-400" />
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
            placeholder="APP_USR-xxxx-xxxx..."
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
          />
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
