import LoginForm from "./LoginForm.jsx";

import { useCart } from '../context/cart';

function Header({ user, onLogin, handleLogout }) {
  const { count } = useCart();
  return (
    <header className="site-header">
      <a href="/#catalog" className="logo">Верити</a>
      <nav aria-label="Основная навигация">
        <ul className="nav-links">
          <li><a href="/#catalog">Каталог</a></li>
          <li><a href="/#delivery">Доставка</a></li>
          <li><a href="/#contact">Контакты</a></li>
          {user && <li><a href="/orders">Мои заказы</a></li>}
          {user?.role === 'admin' && <li><a href="/orders/incoming">Заказы на мои товары</a></li>}
        </ul>
      </nav>
      <div className="auth-bar">
        {user ? <><span>Вы вошли как <b>{user.name}</b> ({user.role})</span><button type="button" onClick={handleLogout}>Выйти</button></> : <LoginForm onLogin={onLogin} initialMode={window.location.pathname === '/register' ? 'register' : 'login'} />}
      </div>
      <a className="cart-badge" href="/cart">Корзина ({count})</a>
    </header>
  );
}
export default Header;
