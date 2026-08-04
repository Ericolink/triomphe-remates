const request = require('supertest');
const app = require('../../app');
const { sequelize, User } = require('../models/index');
const { hashPassword } = require('../utils/helpers');

describe('PUT /api/auth/change-password', () => {
  let user;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
  });

  beforeEach(async () => {
    await User.destroy({ where: {}, force: true });
    user = await User.create({
      name: 'Editor de prueba',
      email: 'change-password-test@triomphe.test',
      password: await hashPassword('OldPassword123'),
      role: 'editor',
      isActive: true,
    });
  });

  afterAll(async () => {
    await User.destroy({ where: {}, force: true });
    await sequelize.close();
  });

  const login = async () =>
    request(app)
      .post('/api/auth/login')
      .send({ email: 'change-password-test@triomphe.test', password: 'OldPassword123' });

  test('cambia la contraseña con las credenciales correctas y devuelve un token nuevo', async () => {
    const loginRes = await login();

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ currentPassword: 'OldPassword123', newPassword: 'NewPassword456' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.token).not.toBe(loginRes.body.token);

    const reLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'change-password-test@triomphe.test', password: 'NewPassword456' });
    expect(reLogin.status).toBe(200);
  });

  test('rechaza con 401 cuando la contraseña actual es incorrecta, sin modificar la contraseña', async () => {
    const loginRes = await login();

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ currentPassword: 'WrongPassword', newPassword: 'NewPassword456' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Contraseña actual incorrecta');

    const stillOld = await login();
    expect(stillOld.status).toBe(200);
  });

  test('rechaza con 400 una nueva contraseña menor a 8 caracteres', async () => {
    const loginRes = await login();

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ currentPassword: 'OldPassword123', newPassword: 'short' });

    expect(res.status).toBe(400);
  });

  test('rechaza sin token con 401', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .send({ currentPassword: 'OldPassword123', newPassword: 'NewPassword456' });

    expect(res.status).toBe(401);
  });

  test('el token emitido antes del cambio queda invalidado (tokenVersion) tras un cambio exitoso', async () => {
    const loginRes = await login();
    const oldToken = loginRes.body.token;

    await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: 'OldPassword123', newPassword: 'NewPassword456' });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`);
    expect(res.status).toBe(401);
  });
});
