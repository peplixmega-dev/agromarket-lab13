import { test, expect } from '@playwright/test';

// Smoke имеет право только читать. Любая неожиданная запись блокируется и роняет тест.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
      throw new Error(`Smoke попытался выполнить запись: ${route.request().method()}`);
    }
    return route.continue();
  });
});
test('@smoke главная показывает каталог из API', async ({ page }) => {
  const products = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/products');
  await page.goto('/');
  expect((await products).status()).toBe(200);
  await expect(page).toHaveTitle(/Верити.*АгроМаркет/);
  await expect(page.getByTestId('product-card').first()).toBeVisible();
});
test('@smoke переход из каталога на товар и прямая ссылка работают', async ({ page }) => {
  await page.goto('/');
  const card = page.getByTestId('product-card').first();
  const link = card.getByRole('link');
  const name = await link.innerText();
  await link.click();
  await expect(page).toHaveURL(/\/products\/\d+$/);
  await expect(page.getByRole('heading', { name, level: 1, exact: true })).toBeVisible();
  const response = await page.reload();
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading', { name, level: 1, exact: true })).toBeVisible();
});
