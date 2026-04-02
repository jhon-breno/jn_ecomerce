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
} from "lucide-react";

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
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  setDoc,
  getDoc,
} from "firebase/firestore";

// Configuração apontando para .env (Ambiente Local/Vite)
// ATENÇÃO: No seu computador, descomente o bloco abaixo e apague a variável appConfig secundária.

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

// --- Main Application Component ---
export default function App() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [abandonedCarts, setAbandonedCarts] = useState([]); // NOVO ESTADO
  const [storeSettings, setStoreSettings] = useState({
    storeName: "NovaLoja",
    logo: "",
    banners: [],
    shipping: {
      pickupEnabled: true,
      correiosBaseRate: 25.0,
      localCities: [],
    },
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

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

  // Auth Initialization (Corrigido para não perder o login ao recarregar a página)
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
        <div
          className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white flex items-center gap-2 z-[100] transition-all animate-bounce print:hidden ${toast.type === "success" ? "bg-emerald-500" : "bg-red-500"}`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={20} />
          ) : (
            <X size={20} />
          )}
          {toast.message}
        </div>
      )}

      {/* Global & Print Styles */}
      <style>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
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

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedProduct, setSelectedProduct] = useState(null);

  const isRealUser = user && !user.isAnonymous;

  // Buscar perfil do utilizador para enviar nos carrinhos abandonados
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

  // Carregar carrinho salvo na primeira renderização
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

  // Sincronizar carrinho com a nuvem (Abandonado/Salvo) toda vez que ele mudar
  useEffect(() => {
    if (!user || !cartLoaded) return; // Espera carregar o carrinho antigo primeiro para não sobrescrever com um array vazio

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
      // Se o carrinho ficar vazio, deleta o registro de abandonado
      deleteDoc(cartRef).catch(() => {});
    }
  }, [cart, user, cartLoaded, cartTotal, userProfile]);

  const categories = [
    "Todas",
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ];

  const addToCart = (product, qty = 1) => {
    setCart((prev) => {
      const cartItemId = product.selectedVariation
        ? `${product.id}-${product.selectedVariation}`
        : product.id;
      const existing = prev.find(
        (item) => (item.cartItemId || item.id) === cartItemId,
      );
      if (existing)
        return prev.map((item) =>
          (item.cartItemId || item.id) === cartItemId
            ? { ...item, qty: item.qty + qty }
            : item,
        );
      return [...prev, { ...product, cartItemId: cartItemId, qty }];
    });
    showToast(`${product.name} adicionado!`);
  };

  const updateQty = (cartItemId, delta) => {
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
    <div className="relative min-h-[calc(100vh-36px)] pb-20 bg-slate-50/50">
      {/* Header */}
      <header className="bg-slate-100 sticky top-0 z-50 border-b border-slate-200 shadow-sm">
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
                  {product.image ? (
                    <img
                      src={product.image}
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
      {isCheckoutOpen && (
        <CheckoutFlow
          cart={cart}
          cartTotal={cartTotal}
          user={user}
          storeSettings={storeSettings}
          close={() => setIsCheckoutOpen(false)}
          showToast={showToast}
          clearCart={() => setCart([])} // O clearCart agora também forçará a limpeza do Firebase via useEffect
        />
      )}
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

  const [selectedVariation, setSelectedVariation] = useState(
    variations.length > 0 ? variations[0] : "",
  );
  const [qty, setQty] = useState(1);

  const handleAdd = () => {
    if (variations.length > 0 && !selectedVariation) return;
    addToCart({ ...product, selectedVariation }, qty);
    close();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row animate-slide-up relative">
        {/* Botão Fechar */}
        <button
          onClick={close}
          className="absolute top-4 right-4 z-10 bg-white/50 backdrop-blur-md p-2 rounded-full hover:bg-white transition-colors shadow-sm"
        >
          <X size={20} className="text-slate-600" />
        </button>

        {/* Imagem do Produto */}
        <div className="w-full md:w-1/2 bg-slate-100 relative aspect-square md:aspect-auto">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <ImageIcon size={64} />
            </div>
          )}
          {product.category && (
            <span className="absolute top-4 left-4 bg-white/90 backdrop-blur-md text-indigo-700 text-xs font-black px-3 py-1.5 rounded-xl border border-white shadow-sm uppercase tracking-wider">
              {product.category}
            </span>
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
                  onClick={() => setQty(qty + 1)}
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
        await signInWithEmailAndPassword(auth, email, password);
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

        // Salvar dados adicionais no banco de dados (Firestore)
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
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
    <div className="fixed inset-0 z-50 flex justify-end">
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
                  {item.image ? (
                    <img
                      src={item.image}
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
    try {
      const order = {
        type: "online",
        customerId: user.uid,
        customerEmail: user.email || "N/A",
        items: cart,
        subtotal: cartTotal,
        shipping: shippingOption,
        total: finalTotal,
        address: selectedAddress,
        paymentMethod,
        status: "pendente_pagamento",
        createdAt: serverTimestamp(),
      };
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "orders"),
        order,
      );
      clearCart();
      close();
      showToast("Pedido realizado! Aguardando pagamento.");
    } catch (error) {
      showToast("Erro ao criar pedido", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-up">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl shrink-0">
          <h2 className="text-xl font-bold text-slate-800">Finalizar Compra</h2>
          <button
            onClick={close}
            className="p-2 hover:bg-slate-200 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Step Indicators */}
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
                <CreditCard size={20} /> Pagamento Seguro
              </h3>
              <p className="text-sm text-slate-500">
                Selecione o método via Mercado Pago (Simulação).
              </p>

              <div className="grid gap-3">
                {["PIX", "Cartão de Crédito", "Boleto"].map((method) => (
                  <label
                    key={method}
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
                      <CreditCard size={18} className="mr-2 text-indigo-600" />
                    )}
                    <span className="font-semibold text-slate-700">
                      {method}
                    </span>
                  </label>
                ))}
              </div>

              {paymentMethod === "PIX" && (
                <div className="bg-teal-50 text-teal-800 p-4 rounded-xl border border-teal-200 text-sm flex items-center gap-3 mt-4">
                  <QrCode size={24} className="shrink-0" />
                  <p>
                    O código PIX será gerado após a finalização do pedido. Você
                    terá 15 minutos para pagar.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 md:p-6 border-t bg-slate-50 flex justify-between rounded-b-2xl shrink-0">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
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
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition"
          >
            {step < 3 ? "Avançar" : "Finalizar e Pagar"}
          </button>
        </div>
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
      <main className="flex-1 bg-slate-50 p-4 md:p-8 overflow-y-auto h-full print:p-0 print:bg-white print:overflow-visible">
        <div className="print:hidden">
          {activeTab === "dashboard" && (
            <AdminOverview
              products={products}
              orders={orders}
              abandonedCarts={abandonedCarts}
            />
          )}
          {activeTab === "products" && (
            <ProductManager products={products} showToast={showToast} />
          )}
          {activeTab === "pos" && (
            <PointOfSale products={products} showToast={showToast} />
          )}
          {activeTab === "orders" && <OrdersList orders={orders} />}
          {activeTab === "carts" && (
            <AbandonedCartsList carts={abandonedCarts} showToast={showToast} />
          )}
          {activeTab === "settings" && (
            <AdminSettings
              showToast={showToast}
              storeSettings={storeSettings}
            />
          )}
        </div>
        {/* Componente impresso apenas quando display block no CSS */}
        <div className="hidden print:block text-black bg-white p-4">
          {/* Area for Print View injected globally */}
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
  const [editingId, setEditingId] = useState(null); // NOVO
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    category: "",
    description: "",
    stock: "",
    image: "",
    variations: "",
  });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 500;
        let width = img.width,
          height = img.height;
        if (width > MAX_WIDTH) {
          height = height * (MAX_WIDTH / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        setFormData({
          ...formData,
          image: canvas.toDataURL("image/jpeg", 0.8),
        });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        ...formData,
        price: Number(formData.price),
        stock: Number(formData.stock),
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
      image: product.image || "",
      variations: product.variations || "",
    });
    setEditingId(product.id);
    setIsAdding(true);
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
      image: "",
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
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition relative overflow-hidden">
            {formData.image ? (
              <img
                src={formData.image}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-slate-400 text-sm font-medium">
                Clique para Adicionar Imagem
              </div>
            )}
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleImageChange}
            />
          </label>
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
                    {p.image && (
                      <img
                        src={p.image}
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
                      onClick={() =>
                        deleteDoc(
                          doc(
                            db,
                            "artifacts",
                            appId,
                            "public",
                            "data",
                            "products",
                            p.id,
                          ),
                        )
                      }
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
    </div>
  );
}

function PointOfSale({ products, showToast }) {
  const [currentSale, setCurrentSale] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerInfo, setCustomerInfo] = useState({ name: "", document: "" });
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro");
  const [lastReceipt, setLastReceipt] = useState(null);

  const addToSale = (product) => {
    if (Number(product.stock) <= 0) return showToast("Sem estoque!", "error");
    setCurrentSale((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing)
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item,
        );
      return [...prev, { ...product, qty: 1 }];
    });
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
      const order = {
        type: "presencial",
        items: currentSale,
        total: totalSale,
        status: "concluido",
        customerName: customerInfo.name || "Cliente Balcão",
        customerDoc: customerInfo.document,
        paymentMethod: paymentMethod,
        createdAt: serverTimestamp(),
        receiptId: Math.floor(100000 + Math.random() * 900000).toString(),
      };
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "orders"),
        order,
      );

      // Update stock
      for (const item of currentSale) {
        await updateDoc(
          doc(db, "artifacts", appId, "public", "data", "products", item.id),
          { stock: Math.max(0, item.stock - item.qty) },
        );
      }

      setLastReceipt(order);
      setCurrentSale([]);
      setCustomerInfo({ name: "", document: "" });
      showToast("Venda registrada!");
    } catch (error) {
      showToast("Erro", "error");
    }
  };

  const printReceipt = () => {
    window.print();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Visualização de Impressão (Oculta na tela normal, visível na impressão) */}
      {lastReceipt && (
        <div className="hidden print:block w-[80mm] text-xs font-mono text-black mx-auto bg-white p-4 absolute top-0 left-0 z-[9999]">
          <div className="text-center font-bold text-lg border-b border-black pb-2 mb-2">
            CUPOM NÃO FISCAL
          </div>
          <div className="mb-2">
            Data: {new Date().toLocaleString()}
            <br />
            Recibo: #{lastReceipt.receiptId}
            <br />
            Cliente: {lastReceipt.customerName}
            <br />
            Doc: {lastReceipt.customerDoc || "N/A"}
          </div>
          <div className="border-b border-black border-dashed mb-2 pb-2">
            {lastReceipt.items.map((i, idx) => (
              <div key={idx} className="flex justify-between">
                <span>
                  {i.qty}x {i.name.substring(0, 15)}
                </span>
                <span>R${(i.qty * i.price).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold text-base mb-1">
            <span>TOTAL</span>
            <span>R$ {lastReceipt.total.toFixed(2)}</span>
          </div>
          <div className="mb-4">Forma Pagto: {lastReceipt.paymentMethod}</div>
          <div className="text-center mt-4">Obrigado pela preferência!</div>
        </div>
      )}

      {/* Produtos */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b relative">
          <Search
            className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex-1 p-4 overflow-y-auto bg-slate-50 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 content-start">
          {availableProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => addToSale(p)}
              disabled={Number(p.stock) <= 0}
              className="bg-white p-3 rounded-xl border text-left hover:border-indigo-400 transition disabled:opacity-50 flex flex-col h-full"
            >
              <div className="w-full h-20 bg-slate-100 rounded-lg mb-2 overflow-hidden shrink-0">
                {p.image ? (
                  <img src={p.image} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-full h-full p-4 text-slate-300" />
                )}
              </div>
              <div className="text-sm font-bold line-clamp-2 leading-tight flex-grow">
                {p.name}
              </div>
              <div className="flex justify-between items-end mt-2">
                <div className="text-indigo-600 font-bold text-sm">
                  R$ {Number(p.price).toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 rounded">
                  {p.stock} un
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Caixa */}
      <div className="w-full lg:w-96 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col shrink-0">
        <div className="p-4 bg-slate-800 text-white rounded-t-2xl font-bold flex justify-between items-center">
          <span className="flex items-center gap-2">
            <Monitor size={20} /> Caixa PDV
          </span>
          {lastReceipt && (
            <button
              onClick={printReceipt}
              className="text-xs bg-indigo-500 hover:bg-indigo-400 px-3 py-1.5 rounded flex items-center gap-1 transition"
            >
              <Printer size={14} /> Imprimir Último
            </button>
          )}
        </div>

        {/* Info do Cliente & Pagamento */}
        <div className="p-4 border-b bg-slate-50 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <input
              placeholder="Nome Cliente (Opcional)"
              value={customerInfo.name}
              onChange={(e) =>
                setCustomerInfo({ ...customerInfo, name: e.target.value })
              }
              className="p-2 border border-slate-200 rounded outline-none focus:border-indigo-400"
            />
            <input
              placeholder="CPF/CNPJ (Opcional)"
              value={customerInfo.document}
              onChange={(e) =>
                setCustomerInfo({ ...customerInfo, document: e.target.value })
              }
              className="p-2 border border-slate-200 rounded outline-none focus:border-indigo-400"
            />
          </div>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded text-sm font-medium outline-none focus:border-indigo-400 bg-white"
          >
            <option value="Dinheiro">Dinheiro</option>
            <option value="Cartão de Crédito">
              Cartão de Crédito (Maquininha)
            </option>
            <option value="Cartão de Débito">
              Cartão de Débito (Maquininha)
            </option>
            <option value="PIX">PIX</option>
            <option value="Mercado Pago Integrado">
              Mercado Pago (Link/QR Code)
            </option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {currentSale.length === 0 ? (
            <p className="text-center text-slate-400 text-sm mt-10">
              Adicione itens para iniciar a venda.
            </p>
          ) : (
            currentSale.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center text-sm border-b border-slate-100 py-3 last:border-0"
              >
                <div className="flex-1 pr-2">
                  <div className="font-semibold text-slate-800 line-clamp-1">
                    {item.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {item.qty} un x R$ {item.price.toFixed(2)}
                  </div>
                </div>
                <div className="font-bold text-slate-700 flex items-center gap-3">
                  R$ {(item.qty * item.price).toFixed(2)}
                  <button
                    onClick={() =>
                      setCurrentSale((prev) =>
                        prev.filter((i) => i.id !== item.id),
                      )
                    }
                    className="text-rose-400 hover:bg-rose-50 hover:text-rose-600 p-1.5 rounded transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-5 border-t bg-slate-50 rounded-b-2xl">
          <div className="flex justify-between text-xl font-bold mb-4 items-center">
            <span className="text-slate-500 text-sm uppercase">
              Total a Pagar:
            </span>
            <span className="text-indigo-700 text-2xl">
              R$ {totalSale.toFixed(2)}
            </span>
          </div>
          <button
            onClick={finalizeSale}
            disabled={currentSale.length === 0}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-md transition disabled:bg-slate-300 flex justify-center items-center gap-2"
          >
            <CheckCircle2 size={20} /> Concluir Venda
          </button>
        </div>
      </div>
    </div>
  );
}

function OrdersList({ orders }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
      <table className="w-full text-left text-sm min-w-[700px]">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="p-4">Data/Hora</th>
            <th className="p-4">Tipo</th>
            <th className="p-4">Cliente</th>
            <th className="p-4">Método</th>
            <th className="p-4 text-right">Valor Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-slate-50">
              <td className="p-4 font-medium text-slate-700">
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
              <td className="p-4 text-slate-600">
                {o.customerName || o.customerEmail || "Cliente Anônimo"}
              </td>
              <td className="p-4 text-slate-500">{o.paymentMethod || "N/A"}</td>
              <td className="p-4 font-bold text-indigo-600 text-right text-base">
                R$ {Number(o.total).toFixed(2)}
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan="5" className="p-8 text-center text-slate-400">
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

  const handleDeleteCart = async (cartId) => {
    if (
      window.confirm("Tem certeza que deseja excluir este carrinho abandonado?")
    ) {
      try {
        await deleteDoc(
          doc(
            db,
            "artifacts",
            appId,
            "public",
            "data",
            "abandoned_carts",
            cartId,
          ),
        );
        showToast("Carrinho removido com sucesso!");
      } catch (error) {
        showToast("Erro ao remover carrinho.", "error");
      }
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
                        onClick={() => handleDeleteCart(cart.id)}
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
                        {item.image ? (
                          <img
                            src={item.image}
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
      </div>
    </div>
  );
}
