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
    await User.create({
      name: 'Admin desactivado',
      email: 'admin-inactivo@triomphe.test',
      password: await hashPassword('Password123'),
      role: 'admin',
      isActive: false,
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

  test('rechaza un usuario desactivado con el mismo status y mensaje que credenciales inválidas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin-inactivo@triomphe.test', password: 'Password123' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciales inválidas');
  });

  test('email inexistente, password incorrecta y usuario inactivo devuelven exactamente el mismo body (sin enumeración de cuentas)', async () => {
    const [noExiste, passwordMala, inactivo] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: 'otro-no-existe@triomphe.test', password: 'x' }),
      request(app).post('/api/auth/login').send({ email: 'admin-test@triomphe.test', password: 'wrong-password' }),
      request(app).post('/api/auth/login').send({ email: 'admin-inactivo@triomphe.test', password: 'Password123' }),
    ]);

    expect(noExiste.status).toBe(passwordMala.status);
    expect(passwordMala.status).toBe(inactivo.status);
    expect(noExiste.body).toEqual(passwordMala.body);
    expect(passwordMala.body).toEqual(inactivo.body);
  });

  test('protección contra timing attack: bcrypt.compare corre incluso si el email no existe o el usuario está inactivo', async () => {
    const bcrypt = require('bcryptjs');
    const spy = jest.spyOn(bcrypt, 'compare');

    await request(app).post('/api/auth/login').send({ email: 'no-existe-timing@triomphe.test', password: 'x' });
    expect(spy).toHaveBeenCalledTimes(1);

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin-inactivo@triomphe.test', password: 'Password123' });
    expect(spy).toHaveBeenCalledTimes(2);

    // Comparado siempre contra el hash dummy (nunca contra un hash real, no hay usuario) —
    // confirma que no se está tomando el atajo de "usuario no existe → skip bcrypt".
    expect(spy.mock.calls[0][1]).toMatch(/^\$2[aby]\$/);

    spy.mockRestore();
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
