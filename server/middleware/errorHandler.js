export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Тело запроса превышает 100 КБ' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' });
  if (err.code === '22003') return res.status(409).json({ error: 'Значение остатка выходит за допустимый диапазон' });
  if (err.code === '23503') return res.status(409).json({ error: 'Запись связана с другими данными и недоступна для изменения' });
  if (err.status && status < 500) return res.status(status).json({ error: err.message, details: err.details });
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  const isProd = process.env.NODE_ENV === "production";
  res.status(status).json({
    error: status >= 500 && isProd ? "Внутренняя ошибка сервера" : err.message,
  });
}
