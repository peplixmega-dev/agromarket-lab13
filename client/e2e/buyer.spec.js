import { test, expect } from '@playwright/test';
import { externalURL } from './environment';
test.skip(!!externalURL, 'Полные E2E разрешены только на автоматически созданной локальной базе');
import { randomUUID } from 'node:crypto';

test('прямая ссылка на /login не возвращает 404', async ({ page }) => {
  const response = await page.goto('/login');
  expect(response.status()).toBe(200);
  await expect(page.getByRole('form', { name: 'Вход', exact: true })).toBeVisible();
});

test('покупатель регистрируется, повторно входит и оформляет заявку', async ({ page }) => {
  const email = `e2e+${randomUUID()}@agromarket.test`;
  const password = 'E2e-Test-Password-123';
  await page.goto('/register');
  const registration = page.getByRole('form', { name: 'Регистрация', exact: true });
  await registration.getByLabel('Имя', { exact: true }).fill('E2E Покупатель');
  await registration.getByLabel('Email', { exact: true }).fill(email);
  await registration.getByLabel('Пароль', { exact: true }).fill(password);
  await registration.getByRole('button', { name: 'Зарегистрироваться', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  const login = page.getByRole('form', { name: 'Вход', exact: true });
  await login.getByLabel('Email', { exact: true }).fill(email);
  await login.getByLabel('Пароль', { exact: true }).fill(password);
  await login.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Выйти', exact: true })).toBeVisible();
  const card = page.getByTestId('product-card').first();
  const productName = await card.getByRole('heading').innerText();
  await card.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByText('Корзина 1', { exact: true })).toBeVisible();
  const order = page.getByRole('form', { name: 'Оптовая заявка' });
  await expect(order.getByRole('combobox').locator('option:checked')).toHaveText(productName);
  await order.getByLabel('Имя', { exact: true }).fill('E2E Покупатель');
  await order.getByLabel('Email', { exact: true }).fill(email);
  await order.getByLabel('объём заказа, кг', { exact: true }).fill('10');
  await order.getByLabel('комментарий', { exact: true }).fill('Автоматическая тестовая заявка ЛР12');
  const orderResponse = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/orders' && res.request().method() === 'POST');
  await order.getByRole('button', { name: 'Отправить заявку' }).click();
  const created = await orderResponse;
  expect(created.status()).toBe(201);
  const body = await created.json();
  expect(body.email).toBe(email);
  expect(body.product_id).toBeTruthy();
  await expect(order.getByRole('status')).toHaveText(`Заявка №${body.id} принята!`);
});

test('гость не получает доступ к /admin', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('alert').filter({ hasText: 'Нет доступа' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Заявки покупателей' })).toHaveCount(0);
});


test('неверный пароль показывает ошибку и оставляет страницу входа', async ({ page }) => {
  await page.goto('/login');
  const form = page.getByRole('form', { name: 'Вход', exact: true });
  await form.getByLabel('Email', { exact: true }).fill('nobody@agromarket.test');
  await form.getByLabel('Пароль', { exact: true }).fill('wrong-password');
  await form.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(form.getByRole('alert')).toHaveText(/Неверный email или пароль/);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Выйти' })).toHaveCount(0);
});
