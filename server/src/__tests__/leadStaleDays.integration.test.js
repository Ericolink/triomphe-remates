// GET /api/leads?staleDays=N — "sin actividad hace N+ días". Bug real reportado por el
// dueño del negocio: un prospecto sin seguimiento desde hace más de N días no aparecía
// porque Lead.updatedAt se había refrescado con una edición administrativa cualquiera (ej.
// completar un campo durante limpieza de datos), sin que eso fuera contacto real con el
// prospecto. staleSinceExpr() (pipelineHelpers.js) ya no incluye Lead.updatedAt — solo
// Activity.occurredAt / LeadNote.createdAt / Lead.createdAt cuentan como "actividad real".
const request = require('supertest');
const app = require('../../app');
const { sequelize, User, Lead, Activity, LeadNote } = require('../models/index');
const { createUser, authToken, createLead } = require('./helpers/factories');

describe('GET /api/leads?staleDays= — solo cuenta contacto real, no cualquier edición', () => {
  let admin, adminToken;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    adminToken = authToken(admin);
  });

  afterEach(async () => {
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  const staleReq = (days) =>
    request(app).get(`/api/leads?staleDays=${days}`).set('Authorization', `Bearer ${adminToken}`);

  test('un lead editado (updatedAt reciente) pero sin actividad/nota real desde hace tiempo SÍ cuenta como estancado', async () => {
    const lead = await createLead({ pipelineStage: 'nuevo' });
    await Lead.update({ createdAt: daysAgo(10) }, { where: { id: lead.id } });
    // Simula la edición administrativa que reportó el bug — un PUT que solo toca un campo
    // sin relación con dar seguimiento real, vía el mismo endpoint real (no un UPDATE directo
    // a la BD) para que también quede cubierto updatedAt = ahora, como en el caso real.
    await request(app)
      .put(`/api/leads/${lead.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ urgency: '1_3_meses' });

    const res = await staleReq(5);
    expect(res.status).toBe(200);
    expect(res.body.data.map((l) => l.id)).toContain(lead.id);
  });

  test('un lead con una Activity real reciente NO cuenta como estancado', async () => {
    const lead = await createLead({ pipelineStage: 'nuevo' });
    await Lead.update({ createdAt: daysAgo(10) }, { where: { id: lead.id } });
    await Activity.create({ leadId: lead.id, type: 'llamada', content: 'Llamada de seguimiento', occurredAt: daysAgo(1) });

    const res = await staleReq(5);
    expect(res.body.data.map((l) => l.id)).not.toContain(lead.id);
  });

  test('un lead con una LeadNote reciente NO cuenta como estancado', async () => {
    const lead = await createLead({ pipelineStage: 'nuevo' });
    await Lead.update({ createdAt: daysAgo(10) }, { where: { id: lead.id } });
    await LeadNote.create({ leadId: lead.id, content: 'Nota de seguimiento', authorName: admin.name });
    await LeadNote.update({ createdAt: daysAgo(1) }, { where: { leadId: lead.id } });

    const res = await staleReq(5);
    expect(res.body.data.map((l) => l.id)).not.toContain(lead.id);
  });

  test('un lead recién creado sin actividad/nota, más viejo que el umbral, cuenta como estancado', async () => {
    const lead = await createLead({ pipelineStage: 'nuevo' });
    await Lead.update({ createdAt: daysAgo(10) }, { where: { id: lead.id } });

    const res = await staleReq(5);
    expect(res.body.data.map((l) => l.id)).toContain(lead.id);
  });

  test('un lead reciente (dentro del umbral) NO cuenta como estancado', async () => {
    const lead = await createLead({ pipelineStage: 'nuevo' });

    const res = await staleReq(5);
    expect(res.body.data.map((l) => l.id)).not.toContain(lead.id);
  });

  test('un lead en etapa terminal nunca cuenta como estancado, aunque sea viejo', async () => {
    const lead = await createLead({ pipelineStage: 'no_interesado', closeReason: 'no_respondio' });
    await Lead.update({ createdAt: daysAgo(30) }, { where: { id: lead.id } });

    const res = await staleReq(5);
    expect(res.body.data.map((l) => l.id)).not.toContain(lead.id);
  });
});
