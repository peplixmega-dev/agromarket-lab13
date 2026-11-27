import { useState } from 'react';

function ProductCard({ product, onAdd, onDelete, featured = false }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (!window.confirm(`Удалить товар «${product.name}»?`)) return;
    setDeleting(true);
    setError('');
    try { await onDelete(product); }
    catch (err) { setError(err.message || 'Не удалось удалить товар'); }
    finally { setDeleting(false); }
  }
  return (
    <article data-testid="product-card" className={featured ? "card card--featured" : "card"}>
      {featured && <span className="badge">мега товары</span>}
      <img src={product.image} alt={product.name} />
      <div className="card-body">
        <h3><a href={`/products/${product.id}`}>{product.name}</a></h3>
        <p className="card-price">{product.price} тенге</p>
        {product.category && <p>{product.category}</p>}
        <button className="card-button" type="button" onClick={() => onAdd?.(product)}>В корзину</button>
        {product.unit && <p>Единица: {product.unit}</p>}
        {onDelete && <button type="button" disabled={deleting} onClick={remove}>
          {deleting ? 'Удаление…' : 'Удалить товар'}
        </button>}
        {error && <p role="alert">{error}</p>}
      </div>
    </article>
  );
}
export default ProductCard;
