import { createContext, useContext } from 'react';

export const CartContext = createContext(null);
export const maxLines = 50;
export const maxQuantity = (stock) => Math.min(stock ?? 100, 100);

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error('Корзине нужен CartProvider');
  return cart;
}
