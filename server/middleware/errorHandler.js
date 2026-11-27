export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Тело запроса превышает 100 КБ' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON' });
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  const isProd = process.env.NODE_ENV === "production";
  res.status(status).json({
    error: status >= 500 && isProd ? "Внутренняя ошибка сервера" : err.message,
  });
}
