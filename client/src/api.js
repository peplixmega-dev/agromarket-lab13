const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000/api")
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem("token");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(res.status === 401 && !/\/auth\/(login|register)$/.test(path)
      ? 'Сессия истекла. Войдите заново.'
      : body.error || `Ошибка HTTP ${res.status}`);
    error.status = res.status;
    error.details = Array.isArray(body.details) ? body.details.filter((item) =>
      item && ((typeof item.field === 'string' && typeof item.message === 'string') ||
        (Number.isInteger(item.productId) && typeof item.name === 'string' && Number.isInteger(item.available)))) : [];
    throw error;
  }
  return res;
}
