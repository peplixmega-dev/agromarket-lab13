import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { externalURL } from './environment';

test.skip(!!externalURL, 'Покупка и отмена проверяются в локальной демобазе');

test('покупатель сохраняет корзину, оформляет и отменяет свой заказ', async ({ page, request }) => {
  await page.goto('/register');
  const registration = page.getByRole('form', { name: 'Регистрация', exact: true });
  await registration.getByLabel('Имя', { exact: true }).fill('Покупатель ЛР13');
  await registration.getByLabel('Email', { exact: true }).fill(`e2e+${randomUUID()}@agromarket.test`);
  await registration.getByLabel('Пароль', { exact: true }).fill('E2e-Checkout-123');
  await registration.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();

  const card = page.getByTestId('product-card').filter({
    has: page.getByRole('button', { name: 'В корзину', disabled: false }),
  }).first();
  const link = card.getByRole('link');
  const name = await link.innerText();
  const itemPath = `/api${await link.getAttribute('href')}`;
  async function readProduct() {
    const response = await request.get(itemPath);
    expect(response.ok()).toBe(true);
    return response.json();
  }
  const product = await readProduct();
  await card.getByRole('button', { name: 'В корзину' }).click();
  await page.getByRole('link', { name: 'Корзина (1)', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
  await page.getByLabel('Адрес доставки').fill('Астана, ул. Женис, 62');
  const response = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/orders' && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Оформить заказ' }).click();
  const created = await response;
  expect(created.status()).toBe(201);
  const order = await created.json();
  expect(order.total).toBe(product.price);
  await expect(page).toHaveURL(new RegExp(`/orders\\?created=${order.id}$`));
  await expect(page.getByText(`Заказ №${order.id} оформлен`, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Мои заказы' })).toBeVisible();
  await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Корзина (0)' })).toBeVisible();
  expect((await readProduct()).stock).toBe(product.stock - 1);

  page.once('dialog', (dialog) => dialog.accept());
  const cancellation = page.waitForResponse((res) => new URL(res.url()).pathname === `/api/orders/${order.id}/cancel` && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Отменить' }).click();
  expect((await cancellation).status()).toBe(200);
  await page.reload();
  await expect(page.getByText(/отменён/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отменить' })).toHaveCount(0);
  expect((await readProduct()).stock).toBe(product.stock);
});
