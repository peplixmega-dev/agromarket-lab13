import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import { money } from '../money';

const statuses = { new: 'Новый', confirmed: 'Подтверждён', shipped: 'Отгружен', cancelled: 'Отменён' };

function BuyerOrder({ order, onCancelled }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`/api/orders/${order.id}/cancel`, { method: 'POST' });
      const { status } = await response.json();
      onCancelled(order.id, status);
    } catch (err) {
      setError(err.status ? err.message : 'Не удалось отменить заказ. Проверьте соединение.');
    } finally { setBusy(false); }
  }

  return <article>
    <h2>Заказ №{order.id}</h2>
    <p>{statuses[order.status] ?? order.status}</p>
    <ul>{order.items.map((item) => <li key={item.productId}>
      <span>{item.name}</span> · {item.quantity} × {money(item.price)}
    </li>)}</ul>
    <p>Итого: {money(order.total)}</p>
    <p>Доставка: {order.address}</p>
    {order.status === 'new' && <button type="button" onClick={cancel} disabled={busy}>{busy ? 'Отменяем…' : 'Отменить'}</button>}
    {error && <p role="alert">{error}</p>}
  </article>;
}

export default function OrdersPage({ incoming = false }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const created = new URLSearchParams(window.location.search).get('created');
  useEffect(() => {
    let active = true;
    apiFetch(incoming ? '/api/orders/incoming' : '/api/orders/my')
      .then((res) => res.json())
      .then((data) => { if (active) setOrders(data); })
      .catch((err) => { if (active) setError(err.status ? err.message : 'Нет связи с сервером'); });
    return () => { active = false; };
  }, [incoming]);

  function markCancelled(id, status) {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, status } : order));
  }

  return <section className="order-page">
    <h1>{incoming ? 'Заказы на мои товары' : 'Мои заказы'}</h1>
    {!incoming && /^[1-9]\d*$/.test(created ?? '') && <p role="status">Заказ №{created} оформлен</p>}
    {error ? <p role="alert">{error}</p> : orders === null ? <p>Загрузка заказов…</p> :
      orders.length === 0 ? <p>Заказов пока нет</p> :
      incoming ? <ul className="incoming-list">{orders.map((item, index) => <li key={`${item.orderId}-${index}`}>
        <h2>Заказ №{item.orderId}</h2>
        <p>{statuses[item.status] ?? item.status}</p>
        <p>{item.product} · {item.quantity} × {money(item.price)}</p>
        <p>{item.buyerName} · {item.address}</p>
      </li>)}</ul> : orders.map((order) => <BuyerOrder key={order.id} order={order} onCancelled={markCancelled} />)}
  </section>;
}
