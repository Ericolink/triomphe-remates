const request = require('supertest');
const app = require('../../app');
const { sequelize, User, AuditLog } = require('../models/index');
const { hashPassword } = require('../utils/helpers');

async function waitForAuditLog(where, { retries = 10, delayMs = 20 } = {}) {
  for (let i = 0; i < retries; i++) {
    const row = await AuditLog.findOne({ where, order: [['id', 'DESC']] });
    if (row) return row;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

describe('PUT /api/auth/change-password', () => {
  beforeAll(async () => {
    await sequelize.sync({ alter: false });
  });

  beforeEach(async () => {
    await User.destroy({ where: {}, force: true });
    await AuditLog.destroy({ where: {}, force: true });
    await User.create({
      name: 'Editor de prueba',
      email: 'change-password-test@triomphe.test',
      password: await hashPassword('OldPassword123'),
      role: 'asistente_administrativo',
      isActive: true,
    });
  });

  afterAll(async () => {
    await User.destroy({ where: {}, force: true });
    await AuditLog.destroy({ where: {}, force: true });
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
    // `code` distingue este 401 de negocio de un 401 de sesión inválida (ver
    // authMiddleware.js) — es lo que consulta el interceptor global de axios en el
    // frontend (client/src/services/api.js) para no cerrar sesión en este caso.
    expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD');

    const stillOld = await login();
    expect(stillOld.status).toBe(200);
  });

  test('un cambio de contraseña exitoso queda registrado en Audit Log', async () => {
    const loginRes = await login();

    await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ currentPassword: 'OldPassword123', newPassword: 'NewPassword456' });

    const row = await waitForAuditLog({ action: 'update', resource: 'user', result: 'success' });
    expect(row).not.toBeNull();
    expect(JSON.parse(row.detail).event).toBe('change_password');
  });

  test('un intento fallido (contraseña actual incorrecta) queda registrado con result:failed', async () => {
    const loginRes = await login();

    await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ currentPassword: 'WrongPassword', newPassword: 'NewPassword456' });

    const row = await waitForAuditLog({ action: 'update', resource: 'user', result: 'failed' });
    expect(row).not.toBeNull();
    expect(JSON.parse(row.detail).event).toBe('change_password_failed');
    expect(row.detail).not.toContain('WrongPassword');
  });

  test('rechaza con 400 una nueva contraseña menor a 8 caracteres', async () => {
    const loginRes = await login();

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .send({ currentPassword: 'OldPassword123', newPassword: 'short' });

    expect(res.status).toBe(400);
  });

  test('rechaza sin token con 401 y code INVALID_SESSION', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .send({ currentPassword: 'OldPassword123', newPassword: 'NewPassword456' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_SESSION');
  });

  test('rechaza un token con firma inválida con 401 y code INVALID_SESSION', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', 'Bearer token.invalido.falsificado')
      .send({ currentPassword: 'OldPassword123', newPassword: 'NewPassword456' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_SESSION');
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
    expect(res.body.code).toBe('INVALID_SESSION');
  });
});
