// asesor_ventas ahora SÍ puede crear prospectos (excepción explícita del dueño del negocio
// a la regla original) — pero siempre quedan auto-asignados a él mismo, nunca a quien el
// body intente inyectar. Ver leadController.createLead.
const request = require('supertest');
const app = require('../../app');
const { sequelize, User, Lead } = require('../models/index');
const { createUser, authToken } = require('./helpers/factories');

describe('POST /api/leads — asesor_ventas puede crear prospectos, auto-asignados a sí mismo', () => {
  let admin, asesor, otroAsesor;
  let adminToken, asesorToken;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    asesor = await createUser({ role: 'asesor_ventas' });
    otroAsesor = await createUser({ role: 'asesor_ventas' });
    adminToken = authToken(admin);
    asesorToken = authToken(asesor);
  });

  afterEach(async () => {
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: [admin.id, asesor.id, otroAsesor.id] }, force: true });
    await sequelize.close();
  });

  // createLead responde solo { data: { id } } (mensaje pensado para el formulario público,
  // ver leadController.js:545-548) — hay que pedir el lead completo con GET para verificar
  // los campos reales que quedaron guardados.
  const authed = (token) => (req) => req.set('Authorization', `Bearer ${token}`);

  test('el asesor crea un prospecto (201) y queda auto-asignado a él mismo', async () => {
    const created = await authed(asesorToken)(
      request(app).post('/api/leads')
    ).send({ name: 'Prospecto de prueba', phone: '6561112233' });
    expect(created.status).toBe(201);

    const res = await authed(asesorToken)(
      request(app).get(`/api/leads/${created.body.data.id}`)
    );
    expect(res.status).toBe(200);
    expect(res.body.data.assignedToUserId).toBe(asesor.id);
    expect(res.body.data.createdByUserId).toBe(asesor.id);
    expect(res.body.data.assignedAt).not.toBeNull();
  });

  test('si el asesor intenta inyectar assignedToUserId de otro usuario, se ignora — igual queda asignado a él mismo', async () => {
    const created = await authed(asesorToken)(
      request(app).post('/api/leads')
    ).send({ name: 'Prospecto inyectado', phone: '6561112234', assignedToUserId: otroAsesor.id });
    expect(created.status).toBe(201);

    const res = await authed(asesorToken)(
      request(app).get(`/api/leads/${created.body.data.id}`)
    );
    expect(res.body.data.assignedToUserId).toBe(asesor.id);
    expect(res.body.data.assignedToUserId).not.toBe(otroAsesor.id);
  });

  test('admin puede ver el lead creado por el asesor y quién lo creó (createdByUser)', async () => {
    const created = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${asesorToken}`)
      .send({ name: 'Prospecto visible para admin', phone: '6561112236' });

    const res = await request(app)
      .get(`/api/leads/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.createdByUser?.name).toBe(asesor.name);
    expect(res.body.data.assignedUser?.name).toBe(asesor.name);
  });

  test('regresión: admin creando un lead con assignedToUserId explícito sigue funcionando igual que antes', async () => {
    const created = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Prospecto asignado por admin', phone: '6561112237', assignedToUserId: asesor.id });
    expect(created.status).toBe(201);

    const res = await request(app)
      .get(`/api/leads/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.assignedToUserId).toBe(asesor.id);
  });

  // Bug real reportado por el dueño del negocio: un prospecto capturado desde el formulario
  // público "Contactar asesor" apareció auto-asignado a un asesor. Causa raíz #1 (frontend):
  // el cliente adjunta el JWT de localStorage a TODA request (incluidas las públicas, ver
  // interceptor de api.js) — si ese asesor tenía una pestaña de /admin abierta en el mismo
  // navegador, su token viajaba sin querer en el POST público. Corrección: createPublicLead
  // en leadService.js usa skipAuth. Causa raíz #2 (backend, hallada al escribir esta prueba):
  // el chequeo `assignedToUserId && req.user && !canAssignLeads(req.user)` cortocircuitaba a
  // `false` en cuanto NO había req.user — una request sin token con `assignedToUserId` en el
  // body pasaba de largo sin ningún chequeo, así que CUALQUIERA sin sesión podía preasignar
  // un prospecto público a cualquier usuario con solo mandarlo en el body. Ahora se rechaza.
  test('sin token (formulario público), un assignedToUserId inyectado en el body se rechaza (403)', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Prospecto público', phone: '6561112239', assignedToUserId: asesor.id });
    expect(res.status).toBe(403);

    // No debe haber creado el lead a medias.
    const leads = await Lead.findAll({ where: { phone: '6561112239' } });
    expect(leads).toHaveLength(0);
  });

  test('sin token (formulario público) y sin assignedToUserId en el body, el lead se crea sin asignar ni creador', async () => {
    const created = await request(app)
      .post('/api/leads')
      .send({ name: 'Prospecto público', phone: '6561112240' });
    expect(created.status).toBe(201);

    const res = await authed(adminToken)(request(app).get(`/api/leads/${created.body.data.id}`));
    expect(res.body.data.assignedToUserId).toBeNull();
    expect(res.body.data.createdByUserId).toBeNull();
  });

  test('extremo a extremo: el asesor crea un lead y de inmediato le agenda una cita', async () => {
    const created = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${asesorToken}`)
      .send({ name: 'Prospecto con cita', phone: '6561112238' });
    expect(created.status).toBe(201);

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const apptRes = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${asesorToken}`)
      .send({ leadId: created.body.data.id, scheduledAt: tomorrow });

    expect(apptRes.status).toBe(201);
    expect(apptRes.body.data.leadId).toBe(created.body.data.id);
  });
});
