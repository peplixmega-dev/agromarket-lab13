import { useState } from "react";
import ValidationErrors from "./ValidationErrors";
import { apiFetch } from "../api";

export default function LoginForm({ onLogin, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [error, setError] = useState("");
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setDetails([]);
    const data = Object.fromEntries(new FormData(e.target));
    data.email = data.email.trim();
    if (!data.email || !data.password || (mode === 'register' && !data.name.trim())) {
      setError('Заполните обязательные поля.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      setError('Введите корректный email.');
      return;
    }
    if (data.password.length < 8) {
      setError('Пароль должен содержать не менее 8 символов.');
      return;
    }
    setLoading(true);

    try {
      // /auth/login или /auth/register — оба возвращают { user, token }
      const res = await apiFetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      onLogin(result.user, result.token);
    } catch (err) {
      setError(err.message);
      setDetails(err.details || []);
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <form aria-label={isLogin ? 'Вход' : 'Регистрация'} className="login-form" onSubmit={handleSubmit} noValidate>
      <h3>{isLogin ? "Вход" : "Регистрация"}</h3>

      {!isLogin && <><label htmlFor="auth-name">Имя</label><input id="auth-name" name="name" autoComplete="name" placeholder="Имя" required /></>}
      <label htmlFor="auth-email">Email</label>
      <input id="auth-email" name="email" type="email" autoComplete="email" placeholder="Email" required />
      <label htmlFor="auth-password">Пароль</label>
      <input
        id="auth-password"
        autoComplete={isLogin ? 'current-password' : 'new-password'}
        name="password"
        type="password"
        placeholder="Пароль (от 8 символов)"
        required
        minLength={8}
      />

      {error && <p className="error" role="alert">{error}</p>}
      <ValidationErrors details={details} />

      <button type="submit" disabled={loading}>
        {loading ? "Подождите…" : isLogin ? "Войти" : "Зарегистрироваться"}
      </button>
      <button
        type="button"
        disabled={loading}
        onClick={() => { setMode(isLogin ? "register" : "login"); setError(''); setDetails([]); }}
      >
        {isLogin ? "Нет аккаунта? Регистрация" : "Уже есть аккаунт? Войти"}
      </button>
    </form>
  );
}
