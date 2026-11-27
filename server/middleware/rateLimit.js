import { rateLimit } from 'express-rate-limit';

// Общий бюджет на вход и регистрацию: 10 запросов с IP за 15 минут.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Слишком много попыток. Попробуйте через 15 минут' },
});
