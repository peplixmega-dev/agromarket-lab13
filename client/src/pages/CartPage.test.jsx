import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import App from '../App';
import { account } from '../test/handlers';
import { server } from '../test/server';
import { renderWithProviders as render } from '../test/utils';

const cart = [
  { productId: 1, name: 'Мёд', price: 3500, quantity: 2 },
  { productId: 2, name: 'Картофель', price: 250, quantity: 4 },
];
const buyerAddress = 'Астана, ул. Женис, 62';
function openCart({ items = cart, guest = false } = {}) {
  localStorage.setItem('cart', JSON.stringify(items));
  if (!guest) {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify(account));
  }
  return render(<App />, { route: '/cart' });
}
async function checkout() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Адрес доставки'), buyerAddress);
  await user.click(screen.getByRole('button', { name: 'Оформить заказ' }));
}

test('пустая корзина ведёт в каталог', () => {
  openCart({ items: [], guest: true });
  expect(screen.getByText(/Корзина пуста/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Перейти в каталог' })).toHaveAttribute('href', '/');
});

test('показываются цены, позиции и сумма', () => {
  openCart({ guest: true });
  expect(within(screen.getByRole('table')).getByRole('cell', { name: 'Мёд' })).toBeInTheDocument();
  expect(screen.getByTestId('cart-total')).toHaveTextContent('8 000 ₸');
});

test('покупатель может изменить количество и удалить позицию', async () => {
  const user = userEvent.setup();
  openCart({ guest: true });
  await user.click(screen.getByRole('button', { name: 'Больше: Картофель' }));
  expect(screen.getByTestId('cart-total')).toHaveTextContent('8 250 ₸');
  await user.click(screen.getByRole('button', { name: 'Меньше: Мёд' }));
  expect(screen.getByTestId('cart-total')).toHaveTextContent('4 750 ₸');
  expect(screen.getByRole('button', { name: 'Меньше: Мёд' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Удалить Картофель' }));
  expect(screen.getByTestId('cart-total')).toHaveTextContent('3 500 ₸');
});

test('успешное оформление отправляет только id, количества и адрес с JWT, очищает корзину и открывает заказ', async () => {
  let body, auth;
  server.use(http.post('*/api/orders', async ({ request }) => {
    body = await request.json();
    auth = request.headers.get('Authorization');
    return HttpResponse.json({ id: 42, status: 'new', total: 8000 }, { status: 201 });
  }));
  openCart();
  await checkout();
  expect(await screen.findByRole('heading', { name: 'Мои заказы' })).toBeInTheDocument();
  expect(screen.getByText('Заказ №42 оформлен')).toBeInTheDocument();
  expect(window.location.pathname + window.location.search).toBe('/orders?created=42');
  expect(auth).toBe('Bearer test-token');
  expect(body).toEqual({ address: buyerAddress, items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 4 }] });
  expect(JSON.parse(localStorage.getItem('cart'))).toEqual([]);
});

test('нехватка товара оставляет корзину и показывает остаток из 409', async () => {
  server.use(http.post('*/api/orders', () => HttpResponse.json({ error: 'Недостаточно товара',
    details: [{ productId: 2, name: 'Картофель', available: 1 }] }, { status: 409 })));
  openCart();
  await checkout();
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Недостаточно товара');
  expect(alert).toHaveTextContent('Картофель: в наличии 1 шт.');
  expect(JSON.parse(localStorage.getItem('cart'))).toEqual(cart);
  expect(screen.getByLabelText('Адрес доставки')).toHaveValue(buyerAddress);
});

test('во время отправки повторное оформление заблокировано', async () => {
  let finish;
  const release = new Promise((resolve) => { finish = resolve; });
  server.use(http.post('*/api/orders', async () => {
    await release;
    return HttpResponse.json({ id: 7 }, { status: 201 });
  }));
  openCart();
  await checkout();
  try { expect(screen.getByRole('button', { name: 'Отправляем…' })).toBeDisabled(); }
  finally { finish(); }
  expect(await screen.findByText('Заказ №7 оформлен')).toBeInTheDocument();
});

test('гостю предлагается вход с возвратом к корзине', () => {
  openCart({ guest: true });
  expect(screen.getByRole('link', { name: 'Войдите' })).toHaveAttribute('href', '/login?next=cart');
  expect(screen.queryByRole('button', { name: 'Оформить заказ' })).not.toBeInTheDocument();
});

test('истёкшая сессия направляет на вход и сохраняет корзину', async () => {
  server.use(http.post('*/api/orders', () => HttpResponse.json({}, { status: 401 })));
  openCart();
  await checkout();
  expect(await screen.findByRole('form', { name: 'Вход' })).toBeInTheDocument();
  expect(window.location.pathname + window.location.search).toBe('/login?next=cart');
  expect(JSON.parse(localStorage.getItem('cart'))).toEqual(cart);
  expect(localStorage.getItem('token')).toBeNull();
});
