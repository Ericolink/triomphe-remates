const request = require('supertest');
const app = require('../../app');
const { sequelize, User } = require('../models/index');
const { hashPassword } = require('../utils/helpers');

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

  afterAll(async () => {
    await User.destroy({ where: {}, force: true });
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
});
