import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import ContactForm from './ContactForm';
import { products } from '../test/handlers';
import { server } from '../test/server';

async function fillOrder(user) {
  await screen.findByRole('option', { name: products[0].name });
  await user.selectOptions(screen.getByLabelText('Выберите товар'), '1');
  await user.type(screen.getByLabelText('Имя'), 'Покупатель');
  await user.type(screen.getByLabelText('Email'), 'buyer@example.test');
  await user.type(screen.getByLabelText('объём заказа, кг'), '10');
}
describe('Оптовая заявка — MSW', () => {
  test('передаёт JWT, товар и данные, очищает успешную форму', async () => {
    localStorage.setItem('token', 'test-token');
    let sent, authorization;
    const requests = vi.fn(async ({ request }) => {
      sent = await request.json();
      authorization = request.headers.get('Authorization');
      return HttpResponse.json({ id: 42 }, { status: 201 });
    });
    server.use(http.post('*/api/orders', requests));
    const user = userEvent.setup();
    render(<ContactForm />);
    await fillOrder(user);
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Заявка №42 принята!');
    expect(requests).toHaveBeenCalledTimes(1);
    expect(authorization).toBe('Bearer test-token');
    expect(sent).toMatchObject({ product_id: 1, name: 'Покупатель', email: 'buyer@example.test', quantity: '10' });
    expect(screen.getByLabelText('Имя')).toHaveValue('');
  });
  test('401 сохраняет ввод и просит войти заново', async () => {
    server.use(http.post('*/api/orders', () => HttpResponse.json({ error: 'Invalid token' }, { status: 401 })));
    const user = userEvent.setup();
    render(<ContactForm />);
    await fillOrder(user);
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Войдите заново');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Имя')).toHaveValue('Покупатель');
  });
  test('объём меньше 10 кг не отправляется', async () => {
    const requests = vi.fn(() => HttpResponse.json({ id: 42 }));
    server.use(http.post('*/api/orders', requests));
    const user = userEvent.setup();
    render(<ContactForm />);
    await fillOrder(user);
    await user.clear(screen.getByLabelText('объём заказа, кг'));
    await user.type(screen.getByLabelText('объём заказа, кг'), '9');
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    expect(screen.getByLabelText('объём заказа, кг')).toBeInvalid();
    expect(requests).not.toHaveBeenCalled();
  });
  test('обрабатывает обрыв сети при отправке', async () => {
    server.use(http.post('*/api/orders', () => HttpResponse.error()));
    const user = userEvent.setup();
    render(<ContactForm />);
    await fillOrder(user);
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Сервер недоступен');
    expect(screen.getByRole('button', { name: 'Отправить заявку' })).toBeEnabled();
  });
});
