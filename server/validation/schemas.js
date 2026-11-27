import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Некорректный email').max(254);
const password = z.string().max(72, 'Пароль — не более 72 байт UTF-8')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Пароль — не более 72 байт UTF-8');
const integer = (min, max, minMessage) => z.union([z.number(), z.string().trim().min(1)])
  .pipe(z.coerce.number().int('Требуется целое число').min(min, minMessage).max(max));
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Имя — минимум 2 символа').max(100),
  email,
  password: password.refine((value) => value.length >= 8, 'Пароль — минимум 8 символов'),
});
export const loginSchema = z.object({
  email,
  password: password.refine((value) => value.length >= 1, 'Введите пароль'),
});
export const productSchema = z.object({
  name: z.string().trim().min(2, 'Название — минимум 2 символа').max(200),
  price: integer(1, 10_000_000, 'Цена должна быть больше 0'),
  stock: z.number().int().min(0, 'Остаток не может быть отрицательным').max(2147483647).optional(),
  category: z.string().trim().min(1, 'Укажите категорию').max(50),
  unit: z.string().trim().min(1).max(20).optional(),
  image: z.string().trim().max(2048).url('Некорректный URL изображения')
    .refine((value) => /^https?:\/\//i.test(value), 'Изображение должно использовать HTTP или HTTPS')
    .nullable().optional(),
});
export const productUpdateSchema = productSchema.partial()
  .refine((data) => Object.keys(data).length > 0, 'Нет полей для обновления');
export const orderSchema = z.object({
  product_id: integer(1, 2147483647).nullable().optional(),
  name: z.string().trim().min(2).max(100),
  email,
  phone: z.string().trim().max(30).optional(),
  quantity: integer(10, 1_000_000),
  date: z.union([z.iso.date(), z.literal('')]).optional(),
  comment: z.string().trim().max(2000).optional(),
});

export const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive().max(2147483647),
    quantity: z.number().int().min(1, 'Количество — не меньше 1').max(100, 'Не больше 100 штук одного товара'),
  })).min(1, 'Корзина пуста').max(50),
  address: z.string().trim().min(5, 'Укажите адрес доставки').max(200),
}).superRefine(({ items }, ctx) => {
  const quantities = new Map();
  for (const { productId, quantity } of items) {
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }
  if ([...quantities.values()].some((quantity) => quantity > 100)) {
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'Не больше 100 штук одного товара' });
  }
});
