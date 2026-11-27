import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import App from '../App';
import { account } from '../test/handlers';
import { server } from '../test/server';
import { renderWithProviders as render } from '../test/utils';

function openOrders(path = '/orders', role = 'user') {
  const user = { ...account, role };
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify(user));
  server.use(http.get('*/api/auth/me', () => HttpResponse.json(user)));
  render(<App />, { route: path });
}
const order = { id: 13, status: 'new', total: 70, address: 'Астана, Женис 62',
  items: [{ productId: 1, name: 'Лук', quantity: 2, price: 35 }] };

test('видны состояния загрузки и пустого списка, ссылка продавца скрыта', async () => {
  server.use(http.get('*/api/orders/my', async () => { await delay(20); return HttpResponse.json([]); }));
  openOrders();
  expect(screen.getByText('Загрузка заказов…')).toBeInTheDocument();
  expect(await screen.findByText('Заказов пока нет')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Заказы на мои товары' })).toBeNull();
});

test('ошибка загрузки заказов выводится покупателю', async () => {
  server.use(http.get('*/api/orders/my', () => HttpResponse.json({ error: 'Не удалось загрузить заказы' }, { status: 500 })));
  openOrders();
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить заказы');
});

test('новый заказ можно отменить, после ответа сервера кнопка исчезает', async () => {
  server.use(http.get('*/api/orders/my', () => HttpResponse.json([order])),
    http.post('*/api/orders/13/cancel', () => HttpResponse.json({ id: 13, status: 'cancelled' })));
  openOrders();
  expect(await screen.findByText('Лук')).toBeInTheDocument();
  expect(screen.getByText('Доставка: Астана, Женис 62')).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Отменить' }));
  expect(await screen.findByText('Отменён')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Отменить' })).toBeNull();
});

test('продавец видит покупателя, адрес и свои позиции во входящих заказах', async () => {
  server.use(http.get('*/api/orders/incoming', () => HttpResponse.json([{ orderId: 5, status: 'new', product: 'Овёс',
    price: 200, quantity: 1, buyerName: 'Покупатель', address: 'Астана, Женис 62' }])));
  openOrders('/orders/incoming', 'admin');
  expect(await screen.findByText('Покупатель · Астана, Женис 62')).toBeInTheDocument();
  expect(screen.getByText(/Овёс/)).toHaveTextContent('200 ₸');
  expect(screen.getByRole('link', { name: 'Заказы на мои товары' })).toHaveAttribute('href', '/orders/incoming');
});
