import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import LoginForm from './LoginForm';

async function credentials(user, password = 'secret123') {
  await user.type(screen.getByLabelText('Email'), 'farmer@example.test');
  await user.type(screen.getByLabelText('Пароль'), password);
}
describe('Форма входа — MSW', () => {
  test('поля связаны с подписями и принимают ввод', async () => {
    render(<LoginForm onLogin={vi.fn()} />);
    await userEvent.setup().type(screen.getByLabelText('Email'), 'farmer@example.test');
    expect(screen.getByLabelText('Email')).toHaveValue('farmer@example.test');
    expect(screen.getByLabelText('Пароль')).toHaveAttribute('type', 'password');
  });
  test('отправляет введённые поля и возвращает сессию', async () => {
    let sent;
    server.use(http.post('*/api/auth/login', async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json({ user: { id: 7 }, token: 'jwt-test' });
    }));
    const onLogin = vi.fn();
    const user = userEvent.setup();
    render(<LoginForm onLogin={onLogin} />);
    await credentials(user);
    await user.click(screen.getByRole('button', { name: 'Войти', exact: true }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith({ id: 7 }, 'jwt-test'));
    expect(sent).toEqual({ email: 'farmer@example.test', password: 'secret123' });
  });
  test.each([['', '', /заполните/i], ['wrong-email', 'secret123', /корректный email/i], ['farmer@example.test', 'short', /не менее 8/i]])(
    'не отправляет невалидный ввод (%s)', async (email, password, message) => {
      const requests = vi.fn(() => HttpResponse.json({}));
      server.use(http.post('*/api/auth/login', requests));
      const user = userEvent.setup();
      render(<LoginForm onLogin={vi.fn()} />);
      if (email) await user.type(screen.getByLabelText('Email'), email);
      if (password) await user.type(screen.getByLabelText('Пароль'), password);
      await user.click(screen.getByRole('button', { name: 'Войти', exact: true }));
      expect(screen.getByRole('alert')).toHaveTextContent(message);
      expect(requests).not.toHaveBeenCalled();
    });
  test('401 показывает текст сервера и не создаёт сессию', async () => {
    const onLogin = vi.fn();
    const user = userEvent.setup();
    render(<LoginForm onLogin={onLogin} />);
    await credentials(user, 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Войти', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный email или пароль');
    expect(onLogin).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBeNull();
  });
  test('регистрация отправляет имя', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);
    await user.click(screen.getByRole('button', { name: 'Нет аккаунта? Регистрация' }));
    await user.type(screen.getByLabelText('Имя'), 'Фермер');
    await credentials(user);
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(expect.objectContaining({ name: 'Фермер', role: 'user' }), 'new-token'));
  });
  test('пока API отвечает, повторный клик не создаёт второй запрос', async () => {
    let finish;
    const gate = new Promise((resolve) => { finish = resolve; });
    const requests = vi.fn(async () => {
      await gate;
      return HttpResponse.json({ user: { id: 1 }, token: 'token' });
    });
    server.use(http.post('*/api/auth/login', requests));
    const onLogin = vi.fn();
    const user = userEvent.setup();
    render(<LoginForm onLogin={onLogin} />);
    await credentials(user);
    await user.click(screen.getByRole('button', { name: 'Войти', exact: true }));
    await waitFor(() => expect(requests).toHaveBeenCalledTimes(1));
    const submit = screen.getByRole('button', { name: 'Подождите…' });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(requests).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1));
  });
});
