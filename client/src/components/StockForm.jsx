import { useState } from 'react';
import { apiFetch } from '../api';

export default function StockForm({ product, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault();
    const stock = event.currentTarget.elements.stock.valueAsNumber;
    setSaving(true);
    setMessage('');
    try {
      const response = await apiFetch(`/api/products/${product.id}`, { method: 'PATCH', body: JSON.stringify({ stock }) });
      onSaved(await response.json());
      setMessage('Остаток сохранён');
    } catch (err) {
      setMessage(err.details?.[0]?.message || err.message);
    } finally { setSaving(false); }
  }
  return <details><summary>Изменить остаток</summary>
    <form className="stock-form" aria-label={`Остаток: ${product.name}`} onSubmit={submit}>
      <label>Остаток <input name="stock" type="number" min="0" step="1" max="2147483647" defaultValue={product.stock ?? 0} required /></label>
      <button type="submit" disabled={saving}>Сохранить остаток</button>
      {message && <span role="status">{message}</span>}
    </form>
  </details>;
}
