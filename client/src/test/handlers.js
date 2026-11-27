import { http, HttpResponse } from 'msw';

export const products = [
  { id: 1, name: 'Мёд гречишный', price: 3500, category: 'Мёд', unit: 'кг', image: '/honey.png' },
  { id: 2, name: 'Пшеница', price: 120, category: 'Зерно', unit: 'кг', image: '/wheat.png' },
];
export const account = { id: 7, name: 'Айгерим', email: 'farmer@example.test', role: 'user' };
export const handlers = [
  http.get('*/api/products', () => HttpResponse.json(products)),
  http.get('*/api/products/:id', ({ params }) => {
    const product = products.find((item) => item.id === Number(params.id));
    return product ? HttpResponse.json(product) : HttpResponse.json({ error: 'Товар не найден' }, { status: 404 });
  }),
  http.post('*/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json();
    return password === 'secret123'
      ? HttpResponse.json({ user: { ...account, email }, token: 'test-token' })
      : HttpResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
  }),
  http.post('*/api/auth/register', async ({ request }) => {
    const { name, email } = await request.json();
    return HttpResponse.json({ user: { ...account, name, email }, token: 'new-token' }, { status: 201 });
  }),
  http.get('*/api/auth/me', ({ request }) => request.headers.get('Authorization') === 'Bearer test-token'
    ? HttpResponse.json(account) : HttpResponse.json({ error: 'Недействительный токен' }, { status: 401 })),
  http.get('*/api/orders', () => HttpResponse.json([])),
  http.post('*/api/orders', async ({ request }) => HttpResponse.json({ ...(await request.json()), id: 42 }, { status: 201 })),
];
