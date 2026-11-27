import { useState } from 'react';
import { apiFetch } from '../api';
import ValidationErrors from './ValidationErrors';

export default function AddProductForm({ onAdded }) {
  const [error, setError] = useState('');
  const [details, setDetails] = useState([]);
  const [sending, setSending] = useState(false);
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setDetails([]);
    const priceInput = e.target.elements.price;
    if (!priceInput.validity.valid || Number(priceInput.value) <= 0) {
      setError('Цена должна быть больше 0 и целым числом до 10 000 000');
      return;
    }
    setSending(true);
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    try {
      const res = await apiFetch('/api/products', { method: 'POST', body: JSON.stringify({ ...data, price: Number(data.price) }) });
      onAdded(await res.json());
      form.reset();
    } catch (err) {
      setError(err.message);
      setDetails(err.details || []);
    } finally { setSending(false); }
  }
  return <form aria-label="Новый товар" className="admin-form" onSubmit={handleSubmit}>
    <h3>Новый товар</h3>
    <label htmlFor="new-product-name">Название</label>
    <input id="new-product-name" name="name" minLength={2} maxLength={200} required />
    <label htmlFor="new-product-category">Категория</label>
    <input id="new-product-category" name="category" maxLength={50} required />
    <label htmlFor="new-product-price">Цена, ₸</label>
    <input onInvalid={() => setError('Цена должна быть больше 0 и целым числом до 10 000 000')} id="new-product-price" name="price" type="number" min="1" max="10000000" step="1" required />
    <label htmlFor="new-product-unit">Единица измерения</label>
    <input id="new-product-unit" name="unit" defaultValue="кг" maxLength={20} required />
    {error && <p className="error" role="alert">{error}</p>}
    <ValidationErrors details={details} />
    <button type="submit" disabled={sending}>{sending ? 'Добавление…' : 'Добавить'}</button>
  </form>;
}
