import { useEffect, useState } from "react";
import ProductCard from "./components/ProductCart";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ContactForm from "./components/ContactForm";
import { apiFetch } from "./api";
import AddProductForm from "./components/PoductForm";
import ProductPage from "./pages/ProductPage";
import CartPage from "./pages/CartPage";
import OrdersPage from "./pages/OrdersPage";
import AdminOrders from "./components/AdminOrders";

function App() {
  const [path, setPath] = useState(window.location.pathname);
  const shoppingPage = ['/cart', '/orders', '/orders/incoming'].includes(path);
  const productId = path.match(/^\/products\/([^/]+)\/?$/)?.[1];
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [user, setUser] = useState(() => {
    if (!localStorage.getItem("token")) return null;
    const savedUser = localStorage.getItem("user");
    try { return savedUser ? JSON.parse(savedUser) : null; } catch { return null; }
  });

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function navigate(url, replace = false) {
    if (replace) window.history.replaceState({}, '', url);
    else window.history.pushState({}, '', url);
    setPath(window.location.pathname);
  }

  function handleLogin(user, token) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    if (['/login', '/register'].includes(window.location.pathname)) {
      const next = new URLSearchParams(window.location.search).get('next');
      navigate(next === 'cart' ? '/cart' : '/', true);
    }
    setUser(user);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    let active = true;
    const current = () => active && localStorage.getItem("token") === token;
    (async () => {
      try {
        const res = await apiFetch(`/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const userData = await res.json();
        if (!current()) return;
        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);
      } catch (err) {
        if (!current() || err.status !== 401) return;
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      }
    })();
    return () => { active = false; };
  }, []);

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase().trim()));

  useEffect(() => {
    if (productId || shoppingPage) return;
    let active = true;
    apiFetch("/api/products")
      .then((res) => res.json())
      .then((data) => { if (active) setProducts(data); })
      .catch((err) => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId, shoppingPage]);

  function updateProduct(updated) {
    setProducts((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  async function deleteProduct(product) {
    await apiFetch(`/api/products/${product.id}`, { method: 'DELETE' });
    setProducts((current) => current.filter((item) => item.id !== product.id));
    if (selectedProduct?.id === product.id) setSelectedProduct(null);
  }

  function ordersView() {
    if (!localStorage.getItem('token')) {
      return <p className="order-page"><a href="/login">Войдите</a>, чтобы посмотреть заказы.</p>;
    }
    const incoming = path === '/orders/incoming';
    if (incoming && user && user.role !== 'admin') return <p role="alert" className="order-page">Нет доступа к заказам продавца.</p>;
    return <OrdersPage key={`${user?.id ?? ''}-${path}`} incoming={incoming} />;
  }

  let content;
  if (path === '/cart') {
    content = <CartPage onCreated={(id) => navigate(`/orders?created=${id}`)}
      onExpired={() => { handleLogout(); navigate('/login?next=cart'); }} />;
  } else if (path === '/orders' || path === '/orders/incoming') {
    content = ordersView();
  } else {
    content = <>
      {path === '/admin' && user?.role !== 'admin' &&
        <p role="alert">Нет доступа. Войдите с учётной записью администратора.</p>}
      {productId ? <ProductPage key={productId} id={productId} onAdd={setSelectedProduct} /> : <section id="catalog" className="catalog">
        <div className="catalog-toolbar">
          <h2>Каталог</h2>
          <input
            aria-label="Поиск товара по каталогу"
            type="search"
            placeholder="Поиск товара по каталогу..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="product-grid">
          {filteredProducts.map((product) => {
            const canManage = user?.role === 'admin' && (product.farmer_id == null || product.farmer_id === user.id);
            return <ProductCard
              key={product.id}
              product={product}
              featured={product.id === 1}
              onAdd={setSelectedProduct}
              onDelete={canManage ? deleteProduct : undefined}
              onStockSaved={canManage ? updateProduct : undefined}
            />;
          })}
        </div>
        {loading && <p className="status-message">Загрузка товаров...</p>}
        {error && <p role="alert" className="status-message">Ошибка загрузки товаров: {String(error)}</p>}
        {!loading && !error && filteredProducts.length === 0 &&
          <p>{products.length === 0 ? 'Товаров пока нет' : 'По вашему запросу ничего не найдено'}</p>}
      </section>}
      <aside id="delivery" className="sidebar">
        <h3>Доставка</h3>
        <ul>
          <li>Астана — на следующий день</li>
          <li>Не Астана - Долговато</li>
          <li>Бесплатно от много тг</li>
        </ul>
      </aside>
      <ContactForm selectedProductId={selectedProduct?.id} />
      {!productId && user?.role === "admin" && (
        <section className="admin-panel">
          <h2>Админка</h2>
          <AddProductForm onAdded={(product) => setProducts((current) => [...current, product])} />
          <AdminOrders />
        </section>
      )}
    </>;
  }

  return <>
    <Header user={user} onLogin={handleLogin} handleLogout={handleLogout} />
    <main className={shoppingPage ? "page checkout-layout" : "page"}>{content}</main>
    <Footer />
  </>;
}

export default App;
