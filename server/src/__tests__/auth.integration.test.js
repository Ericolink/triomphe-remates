const request = require('supertest');
const app = require('../../app');
const { sequelize, User, AuditLog } = require('../models/index');
const { hashPassword } = require('../utils/helpers');

async function waitForAuditLog(where, { retries = 25, delayMs = 40 } = {}) {
  for (let i = 0; i < retries; i++) {
    const row = await AuditLog.findOne({ where, order: [['id', 'DESC']] });
    if (row) return row;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    await User.destroy({ where: {}, force: true });
    await User.create({
      name: 'Admin de prueba',
      email: 'admin-test@triomphe.test',
      password: await hashPassword('Password123'),
      role: 'admin',
      isActive: true,
    });
  });

  afterEach(async () => {
    await AuditLog.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: {}, force: true });
    await AuditLog.destroy({ where: {}, force: true });
    await sequelize.close();
  });

  test('rechaza credenciales inválidas sin revelar si el email existe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin-test@triomphe.test', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('rechaza email inexistente con el mismo mensaje genérico', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-existe@triomphe.test', password: 'cualquier-cosa' });

    expect(res.status).toBe(401);
  });

  test('emite un JWT válido con credenciales correctas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin-test@triomphe.test', password: 'Password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
  });

  test('el JWT emitido autoriza una ruta admin protegida', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin-test@triomphe.test', password: 'Password123' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('admin-test@triomphe.test');
  });

  test('sin token, una ruta protegida responde 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('un login exitoso queda registrado en Audit Log con result:success', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin-test@triomphe.test', password: 'Password123' });

    const row = await waitForAuditLog({ action: 'login', result: 'success' });
    expect(row).not.toBeNull();
    expect(row.resource).toBe('user');
  });

  test('un login fallido (password incorrecta) queda registrado con result:failed', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin-test@triomphe.test', password: 'wrong-password' });

    const row = await waitForAuditLog({ action: 'login', result: 'failed' });
    expect(row).not.toBeNull();
    const detail = JSON.parse(row.detail);
    expect(detail.reason).toBe('invalid_password');
    expect(detail.emailAttempted).toBe('admin-test@triomphe.test');
  });

  test('un login fallido (email inexistente) queda registrado con result:failed y sin userId', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-existe@triomphe.test', password: 'cualquier-cosa' });

    const row = await waitForAuditLog({ action: 'login', result: 'failed', userId: null });
    expect(row).not.toBeNull();
    const detail = JSON.parse(row.detail);
    expect(detail.reason).toBe('user_not_found');
  });
});
