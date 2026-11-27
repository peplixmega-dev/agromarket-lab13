import request from 'supertest';
import { vi, afterEach } from 'vitest';
import app from '../app.js';
import { pool } from '../db/pool.js';
import { getAdminToken, uniqueEmail } from './helpers.js';

let token;
const product = { name: 'Мёд', price: 3500, category: 'Мёд', unit: 'кг' };
beforeAll(async () => { token = await getAdminToken(); });
afterEach(() => vi.unstubAllEnvs());
const create = (data) => request(app).post('/api/products').auth(token, { type: 'bearer' }).send(data);

describe('Валидация ЛР11', () => {
  test('ошибка email содержит details', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Тест', email: 'не-почта', password: '12345678' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toContain('email');
  });
  test('нельзя присвоить role через регистрацию; email и имя нормализуются', async () => {
    const email = uniqueEmail('role');
    const res = await request(app).post('/api/auth/register').send({ name: '  Тест  ', email: ` ${email.toUpperCase()} `, password: '12345678', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ role: 'user', name: 'Тест', email });
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [res.body.user.id]);
    expect(rows[0].role).toBe('user');
  });
  test.each(['1234567', 'x'.repeat(73), 'я'.repeat(37)])('отклоняет длину пароля %s', async (password) => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Тест', email: uniqueEmail(), password });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toContain('password');
  });
  test('bcrypt получает допустимый пароль ровно 72 байта', async () => {
    const email = uniqueEmail();
    const password = 'я'.repeat(36);
    expect((await request(app).post('/api/auth/register').send({ name: 'Тест', email, password })).status).toBe(201);
    expect((await request(app).post('/api/auth/login').send({ email, password })).status).toBe(200);
  });
  test.each([-500, 0, 1.5, 10000001, true, null, ''])('отклоняет цену %s', async (price) => {
    const res = await create({ ...product, price });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toContain('price');
    if (price === -500) expect(res.body.details).toContainEqual({ field: 'price', message: 'Цена должна быть больше 0' });
  });
  test('принимает строковую цену формы и убирает лишние поля', async () => {
    const res = await create({ ...product, price: '3500', name: '  Мёд  ', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Мёд', price: 3500 });
    expect(res.body.role).toBeUndefined();
  });
  test('слишком длинное название и пустая категория → 400', async () => {
    const res = await create({ ...product, name: 'x'.repeat(201), category: ' ' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toEqual(expect.arrayContaining(['name', 'category']));
  });
  test.each(['abc', '-1', '0', '1.5', '2147483648', '1e2'])('GET с id=%s → 400', async (id) => {
    expect((await request(app).get(`/api/products/${id}`)).status).toBe(400);
  });
  test('id проверяется также при изменении и удалении', async () => {
    for (const method of ['put', 'patch', 'delete']) {
      const res = await request(app)[method]('/api/products/abc').auth(token, { type: 'bearer' }).send(product);
      expect(res.status).toBe(400);
    }
    expect((await request(app).delete('/api/orders/abc').auth(token, { type: 'bearer' })).status).toBe(400);
  });
  test.each([{}, { unexpected: 'ignored' }])('пустое PATCH-обновление отклоняется', async (body) => {
    const res = await request(app).patch('/api/products/1').auth(token, { type: 'bearer' }).send(body);
    expect(res.status).toBe(400);
  });
  test('PATCH изменяет только переданные поля', async () => {
    const created = await create(product);
    const res = await request(app).patch(`/api/products/${created.body.id}`).auth(token, { type: 'bearer' }).send({ price: '4000' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ...product, price: 4000 });
    expect((await request(app).patch('/api/products/2147483647').auth(token, { type: 'bearer' }).send({ price: 100 })).status).toBe(404);
  });
  test('тело больше 100 КБ → 413', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
  });
  test('сломанный JSON не отражается в сообщении ошибки', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"password":"private-value",');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('private-value');
  });
  test('плохие данные заявки → 400 вместо ошибки БД', async () => {
    const res = await request(app).post('/api/orders').send({ name: 'Тест', email: 'wrong', quantity: 'many', date: '2026-02-30' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toEqual(expect.arrayContaining(['email', 'quantity', 'date']));
  });
  test('общий лимит для login и register действует и в тесте, если явно включён', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post(i % 2 ? '/api/auth/register' : '/api/auth/login')
        .set('X-Forwarded-For', '192.0.2.90').send({});
      expect(res.status).toBe(400);
    }
    const res = await request(app).post('/api/auth/register').set('X-Forwarded-For', '192.0.2.90').send({});
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});
