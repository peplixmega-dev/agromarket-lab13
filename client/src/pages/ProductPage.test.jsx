import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import App from '../App';
import { renderWithProviders as render } from '../test/utils';
import { server } from '../test/server';
import { products } from '../test/handlers';

test('прямая ссылка загружает товар, цену и единицу измерения', async () => {
  render(<App />, { route: '/products/1' });
  expect(screen.getByText('Загрузка товара...')).toBeInTheDocument();
  expect(await screen.findByRole('heading', { level: 1, name: products[0].name })).toBeInTheDocument();
  expect(screen.getByText('3500 тенге / кг')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '← В каталог' })).toHaveAttribute('href', '/');
  await userEvent.setup().click(screen.getByRole('button', { name: 'В корзину' }));
  expect(screen.getByRole('link', { name: 'Корзина (1)' })).toBeInTheDocument();
  expect(within(screen.getByRole('form', { name: 'Оптовая заявка' })).getByRole('combobox')).toHaveValue('1');
});
test('несуществующий товар показывает 404', async () => {
  render(<App />, { route: '/products/999' });
  expect(await screen.findByRole('alert')).toHaveTextContent('Товар не найден');
});
test('500 на странице товара показывает ошибку', async () => {
  server.use(http.get('*/api/products/:id', () => HttpResponse.json({ error: 'Internal' }, { status: 500 })));
  render(<App />, { route: '/products/1' });
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить товар');
});
