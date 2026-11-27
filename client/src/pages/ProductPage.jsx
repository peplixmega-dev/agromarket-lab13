import { useEffect, useState } from 'react';
import AddToCartButton from '../components/AddToCartButton';
import { apiFetch } from '../api';

export default function ProductPage({ id, onAdd }) {
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    apiFetch(`/api/products/${id}`)
      .then((res) => res.json())
      .then((data) => { if (active) setProduct(data); })
      .catch((err) => { if (active) setError(err.status === 404 ? 'Товар не найден' : 'Не удалось загрузить товар'); });
    return () => { active = false; };
  }, [id]);
  return <section className="catalog product-detail" aria-label="Страница товара">
    <a href="/">← В каталог</a>
    {error ? <p role="alert">{error}</p> : !product ? <p role="status">Загрузка товара...</p> : <>
      <h1>{product.name}</h1>
      {product.image && <img src={product.image} alt={product.name} />}
      <p>{product.price} тенге / {product.unit}</p>
      <p>Категория: {product.category}</p>
      {product.stock != null && <p>Остаток: {product.stock} {product.unit}</p>}
      <AddToCartButton product={product} onAdd={onAdd} />
      <a href="#contact">Оформить заявку</a>
    </>}
  </section>;
}
