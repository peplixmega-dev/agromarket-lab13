import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import App from './App';
import { products, account } from './test/handlers';
import { server } from './test/server';
import { renderWithProviders as render } from './test/utils';

describe('Каталог и сессия — MSW', () => {
  test('показывает загрузку, затем товары из правильного API', async () => {
    const requests = [];
    server.use(http.get('*/api/products', async ({ request }) => {
      requests.push(request.url);
      await delay(50);
      return HttpResponse.json(products);
    }));
    render(<App />);
    expect(screen.getByText('Загрузка товаров...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: products[0].name })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: products[1].name })).toBeInTheDocument();
    expect(screen.queryByText('Загрузка товаров...')).not.toBeInTheDocument();
    expect(requests).toHaveLength(2); // Каталог и список товаров формы заявки.
    expect(requests.every((url) => new URL(url).pathname === '/api/products')).toBe(true);
  });
  test('показывает пустой каталог', async () => {
    server.use(http.get('*/api/products', () => HttpResponse.json([])));
    render(<App />);
    expect(await screen.findByText('Товаров пока нет')).toBeInTheDocument();
    expect(screen.queryByTestId('product-card')).not.toBeInTheDocument();
  });
  test('показывает ошибку 500', async () => {
    server.use(http.get('*/api/products', () => HttpResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })));
    render(<App />);
    expect(await screen.findByText(/Ошибка загрузки товаров:/)).toHaveAttribute('role', 'alert');
    expect(screen.queryByText('Товаров пока нет')).not.toBeInTheDocument();
  });
  test('обрабатывает обрыв сети', async () => {
    server.use(http.get('*/api/products', () => HttpResponse.error()));
    render(<App />);
    expect(await screen.findByText(/Ошибка загрузки товаров:/)).toBeInTheDocument();
  });
  test('ищет товары и сообщает об отсутствии совпадений', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: products[0].name });
    await user.type(screen.getByRole('searchbox'), 'пшеница');
    expect(screen.queryByRole('heading', { name: products[0].name })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: products[1].name })).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox'), 'нет');
    expect(screen.getByText('По вашему запросу ничего не найдено')).toBeInTheDocument();
  });
  test('передаёт товар в заявку, сохраняя введённое имя', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: products[0].name });
    const form = within(screen.getByRole('form', { name: 'Оптовая заявка' }));
    await user.type(form.getByLabelText('Имя'), 'Покупатель');
    await user.click(within(screen.getAllByTestId('product-card')[0]).getByRole('button', { name: 'В корзину' }));
    expect(screen.getByRole('link', { name: 'Корзина (1)' })).toBeInTheDocument();
    expect(form.getByRole('combobox')).toHaveValue('1');
    expect(form.getByLabelText('Имя')).toHaveValue('Покупатель');
  });
  test('гостю на /admin отказано', async () => {
    render(<App />, { route: '/admin' });
    await screen.findByRole('heading', { name: products[0].name });
    expect(screen.getByRole('alert')).toHaveTextContent('Нет доступа');
    expect(screen.queryByRole('heading', { name: 'Заявки покупателей' })).not.toBeInTheDocument();
  });
  test('восстанавливает профиль с JWT, выход удаляет сессию', async () => {
    localStorage.setItem('token', 'test-token');
    render(<App />);
    expect(await screen.findByText(account.name)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Выйти' }));
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(screen.getByRole('form', { name: 'Вход' })).toBeInTheDocument();
  });
  test('401 профиля сбрасывает старую сессию', async () => {
    localStorage.setItem('token', 'expired');
    localStorage.setItem('user', JSON.stringify(account));
    render(<App />);
    expect(await screen.findByRole('form', { name: 'Вход' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });
  test('успешный вход сохраняет token и user', async () => {
    const user = userEvent.setup();
    render(<App />, { route: '/login' });
    const form = within(screen.getByRole('form', { name: 'Вход' }));
    await user.type(form.getByLabelText('Email'), account.email);
    await user.type(form.getByLabelText('Пароль'), 'secret123');
    await user.click(form.getByRole('button', { name: 'Войти', exact: true }));
    await waitFor(() => expect(localStorage.getItem('token')).toBe('test-token'));
    expect(JSON.parse(localStorage.getItem('user')).name).toBe(account.name);
    expect(window.location.pathname).toBe('/');
  });
  test('после регистрации и выхода открывается вход', async () => {
    const user = userEvent.setup();
    render(<App />, { route: '/register' });
    const form = within(screen.getByRole('form', { name: 'Регистрация' }));
    await user.type(form.getByLabelText('Имя'), 'Покупатель');
    await user.type(form.getByLabelText('Email'), 'buyer@example.test');
    await user.type(form.getByLabelText('Пароль'), 'secret123');
    await user.click(form.getByRole('button', { name: 'Зарегистрироваться' }));
    await user.click(await screen.findByRole('button', { name: 'Выйти' }));
    expect(screen.getByRole('form', { name: 'Вход' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});

test('администратор удаляет выбранный товар с JWT через интерфейс', async () => {
  localStorage.setItem('token', 'test-token');
  server.use(http.get('*/api/auth/me', () => HttpResponse.json({ ...account, role: 'admin' })));
  let removedId, authorization;
  server.use(http.delete('*/api/products/:id', ({ request, params }) => {
    removedId = params.id;
    authorization = request.headers.get('Authorization');
    return new HttpResponse(null, { status: 204 });
  }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('form', { name: 'Новый товар' });
  const card = screen.getAllByTestId('product-card')[0];
  await user.click(within(card).getByRole('button', { name: 'В корзину' }));
  await user.click(within(card).getByRole('button', { name: 'Удалить товар' }));
  await waitFor(() => expect(screen.queryByRole('link', { name: products[0].name })).not.toBeInTheDocument());
  expect(removedId).toBe('1');
  expect(authorization).toBe('Bearer test-token');
  expect(screen.getByRole('link', { name: products[1].name })).toBeInTheDocument();
});

test('продавец меняет остаток своего товара, карточка учитывает новый остаток сразу', async () => {
  localStorage.setItem('token', 'test-token');
  const seller = { ...account, role: 'admin' };
  const own = { ...products[0], stock: 0, farmer_id: seller.id };
  const other = { ...products[1], farmer_id: seller.id + 1 };
  let sent;
  server.use(http.get('*/api/auth/me', () => HttpResponse.json(seller)),
    http.get('*/api/products', () => HttpResponse.json([own, other])),
    http.patch('*/api/products/1', async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json({ ...own, ...sent });
    }));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('form', { name: 'Новый товар' });
  await screen.findByRole('heading', { name: own.name });
  const [mine, theirs] = screen.getAllByTestId('product-card').map((card) => within(card));
  expect(mine.getByRole('button', { name: 'Нет в наличии' })).toBeDisabled();
  expect(theirs.queryByText('Изменить остаток')).not.toBeInTheDocument();
  await user.click(mine.getByText('Изменить остаток'));
  const stock = mine.getByRole('spinbutton', { name: 'Остаток' });
  await user.clear(stock);
  await user.type(stock, '9');
  await user.click(mine.getByRole('button', { name: 'Сохранить остаток' }));
  expect(await mine.findByText('Остаток: 9 кг')).toBeInTheDocument();
  expect(mine.getByRole('button', { name: 'В корзину' })).toBeEnabled();
  expect(sent).toEqual({ stock: 9 });
});
