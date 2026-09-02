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

// PUT /api/users/:id es la otra ruta (además de PUT /api/auth/change-password) por la que
// un usuario puede cambiar su propia contraseña — ver usersController.js. Comparte el mismo
// riesgo: un 401 por "contraseña actual incorrecta" no debe traducirse en un cierre de
// sesión forzado por el interceptor global de axios, así que debe usar el mismo `code`
// estable ('INVALID_CURRENT_PASSWORD') que authController.changePassword.
describe('PUT /api/users/:id — cambio de la propia contraseña', () => {
  let token;
  let userId;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    await User.destroy({ where: {}, force: true });
    const admin = await User.create({
      name: 'Admin de prueba',
      email: 'selfedit-admin@triomphe.test',
      password: await hashPassword('Password123'),
      role: 'admin',
      isActive: true,
    });
    userId = admin.id;

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'selfedit-admin@triomphe.test', password: 'Password123' });
    token = login.body.token;
  });

  afterAll(async () => {
    await User.destroy({ where: {}, force: true });
    await AuditLog.destroy({ where: {}, force: true });
    await sequelize.close();
  });

  test('contraseña actual incorrecta al auto-editarse: 401 con code INVALID_CURRENT_PASSWORD', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .field('currentPassword', 'esta-no-es')
      .field('newPassword', 'NuevaPassword456');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  test('ese mismo intento fallido queda registrado en Audit Log con result:failed', async () => {
    const row = await waitForAuditLog({
      action: 'update',
      resource: 'user',
      resourceId: userId,
      result: 'failed',
    });
    expect(row).not.toBeNull();
    expect(JSON.parse(row.detail).event).toBe('change_password_failed');
  });
});
