import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import LoginForm from './LoginForm';
import AddProductForm from './PoductForm';
import { server } from '../test/server';

async function credentials(user) {
  await user.type(screen.getByLabelText('Email'), 'buyer@example.test');
  await user.type(screen.getByLabelText('Пароль'), 'secret123');
}
test('429 показывает сообщение сервера', async () => {
  server.use(http.post('*/api/auth/login', () => HttpResponse.json({ error: 'Слишком много попыток. Попробуйте через 15 минут' }, { status: 429 })));
  const user = userEvent.setup();
  const onLogin = vi.fn();
  render(<LoginForm onLogin={onLogin} />);
  await credentials(user);
  await user.click(screen.getByRole('button', { name: 'Войти', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Слишком много попыток');
  expect(onLogin).not.toHaveBeenCalled();
});
test('регистрация показывает details email и очищает ошибки при смене режима', async () => {
  server.use(http.post('*/api/auth/register', () => HttpResponse.json({ error: 'Ошибка валидации', details: [{ field: 'email', message: 'Некорректный e-mail' }] }, { status: 400 })));
  const user = userEvent.setup();
  render(<LoginForm initialMode="register" onLogin={vi.fn()} />);
  await user.type(screen.getByLabelText('Имя'), 'Покупатель');
  await credentials(user);
  await user.click(screen.getByRole('button', { name: 'Зарегистрироваться', exact: true }));
  expect(await screen.findByRole('alert', { name: 'Ошибки полей' })).toHaveTextContent('Email: Некорректный e-mail');
  await user.click(screen.getByRole('button', { name: 'Уже есть аккаунт? Войти' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
async function fillProduct(user, price = '3500') {
  await user.type(screen.getByLabelText('Название'), 'Мёд');
  await user.type(screen.getByLabelText('Категория'), 'Мёд');
  await user.type(screen.getByLabelText('Цена, ₸'), price);
}
test('ошибка price из API отображается без потери данных', async () => {
  server.use(http.post('*/api/products', () => HttpResponse.json({ error: 'Ошибка валидации', details: [{ field: 'price', message: 'Цена должна быть больше 0' }] }, { status: 400 })));
  const user = userEvent.setup();
  const onAdded = vi.fn();
  render(<AddProductForm onAdded={onAdded} />);
  await fillProduct(user);
  await user.click(screen.getByRole('button', { name: 'Добавить' }));
  expect(await screen.findByRole('alert', { name: 'Ошибки полей' })).toHaveTextContent('Цена: Цена должна быть больше 0');
  expect(screen.getByLabelText('Название')).toHaveValue('Мёд');
  expect(onAdded).not.toHaveBeenCalled();
});
test('цена -500 не уходит в API даже при прямом событии submit', async () => {
  const requests = vi.fn(() => HttpResponse.json({ id: 1 }));
  server.use(http.post('*/api/products', requests));
  const user = userEvent.setup();
  render(<AddProductForm onAdded={vi.fn()} />);
  await fillProduct(user, '-500');
  await user.click(screen.getByRole('button', { name: 'Добавить' }));
  expect(screen.getByLabelText('Цена, ₸')).toBeInvalid();
  expect(screen.getByRole('alert')).toHaveTextContent('Цена должна быть больше 0');
  fireEvent.submit(screen.getByRole('form'));
  expect(requests).not.toHaveBeenCalled();
});
test('валидный товар отправляется с JWT и числовой ценой', async () => {
  localStorage.setItem('token', 'admin-token');
  let sent, authorization;
  server.use(http.post('*/api/products', async ({ request }) => {
    sent = await request.json();
    authorization = request.headers.get('Authorization');
    return HttpResponse.json({ ...sent, id: 55 }, { status: 201 });
  }));
  const user = userEvent.setup();
  const onAdded = vi.fn();
  render(<AddProductForm onAdded={onAdded} />);
  await fillProduct(user);
  await user.click(screen.getByRole('button', { name: 'Добавить' }));
  await waitFor(() => expect(onAdded).toHaveBeenCalledWith(expect.objectContaining({ id: 55, price: 3500 })));
  expect(sent.price).toBe(3500);
  expect(authorization).toBe('Bearer admin-token');
  expect(screen.getByLabelText('Название')).toHaveValue('');
});
