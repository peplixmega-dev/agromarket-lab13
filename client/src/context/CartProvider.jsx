import { useEffect, useState } from 'react';
import { CartContext, maxLines, maxQuantity } from './cart';

function loadCart() {
  try {
    const stored = JSON.parse(localStorage.getItem('cart'));
    if (!Array.isArray(stored)) return [];
    const seen = new Set();
    return stored.filter((line) => {
      if (!line || !Number.isSafeInteger(line.productId) || line.productId < 1 ||
          !Number.isSafeInteger(line.price) || line.price <= 0 || typeof line.name !== 'string' ||
          !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100 ||
          (line.stock != null && (!Number.isInteger(line.stock) || line.stock < 0)) ||
          seen.has(line.productId)) return false;
      seen.add(line.productId);
      return true;
    }).slice(0, maxLines);
  } catch {
    return [];
  }
}

export default function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);
  useEffect(() => {
    try { localStorage.setItem('cart', JSON.stringify(items)); }
    catch { /* Корзина продолжает работать в памяти, если хранилище недоступно. */ }
  }, [items]);

  function add(product) {
    setItems((current) => {
      const line = current.find((item) => item.productId === product.id);
      const quantity = (line?.quantity ?? 0) + 1;
      if (quantity > maxQuantity(product.stock) || (!line && current.length >= maxLines)) return current;
      const next = { productId: product.id, name: product.name, price: product.price, quantity, stock: product.stock };
      return line ? current.map((item) => item === line ? next : item) : [...current, next];
    });
  }

  function setQuantity(id, quantity) {
    setItems((current) => quantity === 0 ? current.filter((item) => item.productId !== id) :
      current.map((item) => item.productId === id && quantity > 0 && quantity <= maxQuantity(item.stock)
        ? { ...item, quantity } : item));
  }

  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return <CartContext.Provider value={{ items, add, setQuantity, count, total, clear: () => setItems([]) }}>
    {children}
  </CartContext.Provider>;
}
