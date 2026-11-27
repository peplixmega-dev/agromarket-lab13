import { useEffect, useState } from "react";
import { apiFetch } from "../api";

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  async function loadOrders() {
    try {
      const res = await apiFetch("/api/orders");
      setOrders(await res.json());
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    let active = true;
    apiFetch("/api/orders")
      .then((res) => res.json())
      .then((data) => { if (active) setOrders(data); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  return (
    <section className="admin-orders">
      <h3>Заявки покупателей</h3>
      <button type="button" onClick={loadOrders}>Обновить заявки</button>
      {error && <p role="alert">{error}</p>}
      {!error && orders.length === 0 && <p>Заявок пока нет</p>}
      {orders.map((order) => (
        <article key={order.id}>
          <h4>Заявка №{order.id} — {order.name}</h4>
          <p>{order.product_name || "Без выбора товара"} · {order.quantity} кг · {order.status}</p>
          <p>{order.email}{order.phone ? ` · ${order.phone}` : ""}</p>
          {order.delivery_date && <p>Доставка: {order.delivery_date}</p>}
          {order.comment && <p>{order.comment}</p>}
        </article>
      ))}
    </section>
  );
}
