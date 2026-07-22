const request = require('supertest');
const app = require('../../app');
const { sequelize, Lead, Activity, AuditLog, User } = require('../models/index');
const { createUser, authToken, createLead } = require('./helpers/factories');

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

describe('POST /api/leads/:id/activities', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await Activity.destroy({ where: {}, force: true });
    await AuditLog.destroy({ where: {}, force: true });
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  const authed = (req) => req.set('Authorization', `Bearer ${token}`);

  test('crea la actividad y no rompe la respuesta si el log de auditoría se registra', async () => {
    const lead = await createLead();

    const res = await authed(request(app).post(`/api/leads/${lead.id}/activities`)).send({
      type: 'llamada',
      content: 'Se contactó al prospecto',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.leadId).toBe(lead.id);

    const activities = await Activity.findAll({ where: { leadId: lead.id } });
    expect(activities).toHaveLength(1);
  });

  test('registra la auditoría como update de lead con el id de la actividad creada', async () => {
    const lead = await createLead();

    const res = await authed(request(app).post(`/api/leads/${lead.id}/activities`)).send({
      type: 'nota',
      content: 'Seguimiento agendado',
    });

    const auditRow = await waitForAuditLog({ resource: 'lead', resourceId: lead.id });
    expect(auditRow).not.toBeNull();
    expect(auditRow.action).toBe('update');
    const detail = JSON.parse(auditRow.detail);
    expect(detail.addedActivity).toBe(res.body.data.id);
  });
});
