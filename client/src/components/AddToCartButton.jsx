import { maxLines, maxQuantity, useCart } from '../context/cart';

export default function AddToCartButton({ product, onAdd }) {
  const { items, add } = useCart();
  const quantity = items.find((line) => line.productId === product.id)?.quantity ?? 0;
  const full = !quantity && items.length >= maxLines;
  return <>
    <button className="card-button" type="button" disabled={quantity >= maxQuantity(product.stock) || full}
      onClick={() => { add(product); onAdd?.(product); }}>
      {product.stock === 0 ? 'Нет в наличии' : 'В корзину'}
    </button>
    {quantity > 0 && <span>В корзине: {quantity}</span>}
    {full && <span>В одном заказе до {maxLines} разных товаров</span>}
  </>;
}
