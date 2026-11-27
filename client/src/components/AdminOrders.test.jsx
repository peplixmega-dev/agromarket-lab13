import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AdminOrders from './AdminOrders';
import { server } from '../test/server';

describe('Защищённый список заявок — MSW', () => {
  test('запрашивает заявки с JWT', async () => {
    localStorage.setItem('token', 'test-token');
    let authorization;
    server.use(http.get('*/api/orders', ({ request }) => {
      authorization = request.headers.get('Authorization');
      return HttpResponse.json([{ id: 7, name: 'Покупатель', quantity: 10, status: 'new', email: 'buyer@example.test' }]);
    }));
    render(<AdminOrders />);
    expect(await screen.findByRole('heading', { name: 'Заявка №7 — Покупатель' })).toBeInTheDocument();
    expect(authorization).toBe('Bearer test-token');
  });
  test('401 предлагает повторный вход', async () => {
    server.use(http.get('*/api/orders', () => HttpResponse.json({ error: 'Недействительный токен' }, { status: 401 })));
    render(<AdminOrders />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Войдите заново');
    expect(screen.queryByText('Заявок пока нет')).not.toBeInTheDocument();
  });
});
