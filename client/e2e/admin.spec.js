import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { externalURL } from './environment';

test.skip(!!externalURL, 'Товары изменяются только в локальной временной базе');
test.beforeEach(async ({ page }) => {
  if (!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD) throw new Error('Нужны переменные E2E_ADMIN_EMAIL и E2E_ADMIN_PASSWORD');
  await page.goto('/login');
  const form = page.getByRole('form', { name: 'Вход', exact: true });
  await form.getByLabel('Email', { exact: true }).fill(process.env.E2E_ADMIN_EMAIL);
  await form.getByLabel('Пароль', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD);
  await form.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
});

test('администратор создаёт товар и удаляет его через интерфейс', async ({ page }) => {
  const name = `Тестовый мёд ${randomUUID()}`;
  const form = page.getByRole('form', { name: 'Новый товар' });
  await form.getByLabel('Название', { exact: true }).fill(name);
  await form.getByLabel('Категория', { exact: true }).fill('Мёд');
  await form.getByLabel('Цена, ₸', { exact: true }).fill('3500');
  await form.getByLabel('Остаток', { exact: true }).fill('4');
  const created = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/products' && res.request().method() === 'POST');
  await form.getByRole('button', { name: 'Добавить' }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const { id, stock } = await response.json();
  expect(stock).toBe(4);
  const card = page.getByTestId('product-card').filter({ has: page.getByRole('link', { name, exact: true }) });
  try {
    await expect(card).toBeVisible();
    await page.reload();
    await expect(card).toBeVisible();
  } finally {
    // Удаляем исключительно созданный в этом тесте товар, через пользовательский интерфейс.
    const deleted = page.waitForResponse((res) => new URL(res.url()).pathname === `/api/products/${id}` && res.request().method() === 'DELETE');
    page.once('dialog', (dialog) => dialog.accept());
    await card.getByRole('button', { name: 'Удалить товар' }).click();
    expect((await deleted).status()).toBe(204);
    await expect(card).toHaveCount(0);
  }
  await page.reload();
  await expect(card).toHaveCount(0);
});

test('цена -500 блокируется браузером, сервер тоже отвечает 400 при обходе формы', async ({ page }) => {
  const form = page.getByRole('form', { name: 'Новый товар' });
  const sent = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/products') sent.push(request);
  });
  await form.getByLabel('Название', { exact: true }).fill('Невалидный товар E2E');
  await form.getByLabel('Категория', { exact: true }).fill('Мёд');
  await form.getByLabel('Цена, ₸', { exact: true }).fill('-500');
  await form.getByRole('button', { name: 'Добавить' }).click();
  await expect(form.getByRole('alert')).toHaveText(/Цена должна быть больше 0/);
  expect(await form.getByLabel('Цена, ₸', { exact: true }).evaluate((input) => input.validity.rangeUnderflow)).toBe(true);
  expect(sent).toHaveLength(0);
  // Реальный API: запрос в обход HTML-валидации должен быть отвергнут Zod.
  const result = await page.evaluate(async () => {
    const res = await fetch('/api/products', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ name: 'Невалидный товар E2E', category: 'Мёд', price: -500 }),
    });
    return { status: res.status, body: await res.json() };
  });
  expect(result.status).toBe(400);
  expect(result.body.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'price' })]));
});
