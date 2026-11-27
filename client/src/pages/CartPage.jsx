import { useState } from 'react';
import { apiFetch } from '../api';
import { maxQuantity, useCart } from '../context/cart';
import { money } from '../money';

export default function CartPage({ onCreated, onExpired }) {
  const { items, total, setQuantity, clear } = useCart();
  const [address, setAddress] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  async function checkout(event) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ address: address.trim(), items: items.map(({ productId, quantity }) => ({ productId, quantity })) }),
      });
      const order = await response.json();
      clear();
      onCreated(order.id);
    } catch (err) {
      if (err.status === 401) onExpired();
      else setError({ message: err.status ? err.message : 'Нет связи с сервером. Попробуйте ещё раз', details: err.details ?? [] });
    } finally { setSending(false); }
  }

  return <section className="order-page">
    <h1>Корзина</h1>
    {items.length === 0 ? <p>Корзина пуста. <a href="/">Перейти в каталог</a></p> : <>
      <div className="cart-table"><table>
        <thead><tr><th>Товар</th><th>Цена</th><th>Количество</th><th>Сумма</th><th aria-label="Действия" /></tr></thead>
        <tbody>{items.map((line) => <tr key={line.productId}>
          <td>{line.name}</td><td>{money(line.price)}</td>
          <td><div className="quantity">
            <button type="button" aria-label={`Меньше: ${line.name}`} disabled={sending || line.quantity <= 1}
              onClick={() => setQuantity(line.productId, line.quantity - 1)}>−</button>
            <span>{line.quantity}</span>
            <button type="button" aria-label={`Больше: ${line.name}`} disabled={sending || line.quantity >= maxQuantity(line.stock)}
              onClick={() => setQuantity(line.productId, line.quantity + 1)}>+</button>
          </div></td>
          <td>{money(line.price * line.quantity)}</td>
          <td><button type="button" disabled={sending} aria-label={`Удалить ${line.name}`}
            onClick={() => setQuantity(line.productId, 0)}>Удалить</button></td>
        </tr>)}</tbody>
      </table></div>
      <p>Итого: <strong data-testid="cart-total">{money(total)}</strong></p>
      {error && <div role="alert"><p>{error.message}</p>
        {error.details.length > 0 && <ul>{error.details.map((detail, index) => <li key={index}>
          {detail.message ?? `${detail.name}: в наличии ${detail.available} шт.`}
        </li>)}</ul>}
      </div>}
      {localStorage.getItem('token') ? <form onSubmit={checkout} className="checkout-form">
        <label htmlFor="address">Адрес доставки</label>
        <input id="address" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)}
          minLength={5} maxLength={200} required disabled={sending} />
        <button type="submit" disabled={sending}>{sending ? 'Отправляем…' : 'Оформить заказ'}</button>
      </form> : <p><a href="/login?next=cart">Войдите</a>, чтобы оформить заказ.</p>}
    </>}
  </section>;
}
