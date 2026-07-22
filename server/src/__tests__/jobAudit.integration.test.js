const request = require('supertest');
const app = require('../../app');
const { sequelize, JobPosition, AuditLog, User } = require('../models/index');
const { createUser, authToken } = require('./helpers/factories');

// AuditLog se escribe en logAudit() sin esperar la promesa (fire-and-forget) — se sondea
// brevemente en vez de asumir que ya está escrito justo después del response.
async function waitForAuditLog(where, { retries = 10, delayMs = 20 } = {}) {
  for (let i = 0; i < retries; i++) {
    const row = await AuditLog.findOne({ where, order: [['id', 'DESC']] });
    if (row) return row;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

describe('POST /api/jobs', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await AuditLog.destroy({ where: {}, force: true });
    await JobPosition.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  const authed = (req) => req.set('Authorization', `Bearer ${token}`);

  test('crea la vacante y responde 201', async () => {
    const res = await authed(request(app).post('/api/jobs')).send({
      title: 'Asesor inmobiliario',
      description: 'Descripción de la vacante',
      requirements: 'Requisitos de la vacante',
      city: 'juarez',
      type: 'por_comision',
    });

    expect(res.status).toBe(201);
    const position = await JobPosition.findByPk(res.body.data.id);
    expect(position).not.toBeNull();
  });

  test('registra la auditoría de creación con el mismo patrón que updatePosition/deletePosition', async () => {
    const res = await authed(request(app).post('/api/jobs')).send({
      title: 'Asesor senior',
      description: 'Descripción de la vacante',
      requirements: 'Requisitos de la vacante',
      city: 'chihuahua',
      type: 'por_comision',
    });

    const auditRow = await waitForAuditLog({ resource: 'job', resourceId: res.body.data.id });
    expect(auditRow).not.toBeNull();
    expect(auditRow.action).toBe('create');
    const detail = JSON.parse(auditRow.detail);
    expect(detail.title).toBe('Asesor senior');
    expect(detail.city).toBe('chihuahua');
  });
});
