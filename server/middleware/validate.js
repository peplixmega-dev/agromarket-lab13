export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Ошибка валидации',
      details: result.error.issues.map((issue) => ({
        field: issue.path.join('.'), message: issue.message,
      })),
    });
  }
  req.body = result.data;
  next();
};

export function idParam(req, res, next) {
  const raw = req.params.id;
  const id = Number(raw);
  // Колонки id в PostgreSQL имеют тип SERIAL (int32).
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(id) || id > 2147483647) {
    return res.status(400).json({ error: 'Некорректный id' });
  }
  req.params.id = id;
  next();
}
