import { useEffect, useState } from "react";
import ProductCard from "./components/ProductCart";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ContactForm from "./components/ContactForm";
import { apiFetch } from "./api";
import AddProductForm from "./components/PoductForm";
import ProductPage from "./pages/ProductPage";
import AdminOrders from "./components/AdminOrders";

function App() {
  const productId = window.location.pathname.match(/^\/products\/([^/]+)\/?$/)?.[1];
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    try { return savedUser ? JSON.parse(savedUser) : null; } catch { return null; }
  });

  function handleLogin(user, token) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    if (['/login', '/register'].includes(window.location.pathname)) {
      window.history.replaceState({}, '', '/');
    }
    setUser(user);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    (async () => {
      try {
        const res = await apiFetch(`/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const userData = await res.json();
        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      }
    })();
  }, []);

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase().trim()));

  useEffect(() => {
    if (productId) return;
    let active = true;
    apiFetch("/api/products")
      .then((res) => res.json())
      .then((data) => { if (active) setProducts(data); })
      .catch((err) => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId]);

  function addToCart(product) {
    setCartCount((count) => count + 1);
    setSelectedProduct(product);
  }

  async function deleteProduct(product) {
    await apiFetch(`/api/products/${product.id}`, { method: 'DELETE' });
    setProducts((current) => current.filter((item) => item.id !== product.id));
    if (selectedProduct?.id === product.id) setSelectedProduct(null);
  }

  return (
    <>
      <Header
        cartCount={cartCount}
        user={user}
        onLogin={handleLogin}
        handleLogout={handleLogout}
      />
      <main className="page">
        {window.location.pathname === '/admin' && user?.role !== 'admin' &&
          <p role="alert">Нет доступа. Войдите с учётной записью администратора.</p>}
        {productId ? <ProductPage key={productId} id={productId} onAdd={addToCart} /> : <section id="catalog" className="catalog">
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
            {filteredProducts
              .map((product) => (
                <ProductCard
                  onAdd={addToCart}
                  onDelete={user?.role === 'admin' ? deleteProduct : undefined}
                  key={product.id}
                  featured={product.id === 1}
                  product={product}
                />
              ))}
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
      </main>

      <Footer />
    </>
  );
}

export default App;
