// GET /api/crm/my-dashboard — dashboard personal de asesor_ventas. A diferencia de
// crmAnalyticsAccess.integration.test.js (que solo prueba que el acceso a los endpoints
// globales está bloqueado), aquí el foco es que los datos devueltos estén correctamente
// filtrados por fila — la prueba más crítica del ticket (PASO 12: un asesor NUNCA debe poder
// obtener datos de otro asesor, ni siquiera indirectamente vía este agregado).
const request = require('supertest');
const app = require('../../app');
const { sequelize, User, Lead, Activity } = require('../models/index');
const {
  createUser,
  authToken,
  createLead,
  createTask,
  createAppointment,
  createDeal,
} = require('./helpers/factories');

describe('GET /api/crm/my-dashboard', () => {
  let admin, asistente, coordinador, asesorA, asesorB;
  let adminToken, asistenteToken, coordinadorToken, asesorAToken, asesorBToken;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    asistente = await createUser({ role: 'asistente_administrativo' });
    coordinador = await createUser({ role: 'coordinador_ventas' });
    asesorA = await createUser({ role: 'asesor_ventas' });
    asesorB = await createUser({ role: 'asesor_ventas' });
    adminToken = authToken(admin);
    asistenteToken = authToken(asistente);
    coordinadorToken = authToken(coordinador);
    asesorAToken = authToken(asesorA);
    asesorBToken = authToken(asesorB);
  });

  afterEach(async () => {
    // Cascada (onDelete: 'CASCADE' en las asociaciones Lead->Activity/Appointment/Task/Deal,
    // ver models/index.js) — borrar los Lead ya limpia Task/Appointment/Deal/Activity.
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({
      where: { id: [admin.id, asistente.id, coordinador.id, asesorA.id, asesorB.id] },
      force: true,
    });
    await sequelize.close();
  });

  const authed = (token) => request(app).get('/api/crm/my-dashboard').set('Authorization', `Bearer ${token}`);

  describe('control de acceso', () => {
    test('admin recibe 403 (tiene su propio dashboard agregado, este es exclusivo de asesor_ventas)', async () => {
      const res = await authed(adminToken);
      expect(res.status).toBe(403);
      expect(res.body.data).toBeUndefined();
    });

    test('asistente_administrativo recibe 403', async () => {
      const res = await authed(asistenteToken);
      expect(res.status).toBe(403);
    });

    test('coordinador_ventas recibe 403 (sin acceso al CRM de leads)', async () => {
      const res = await authed(coordinadorToken);
      expect(res.status).toBe(403);
    });

    test('asesor_ventas recibe 200 con datos', async () => {
      const res = await authed(asesorAToken);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    test('sin token recibe 401', async () => {
      const res = await request(app).get('/api/crm/my-dashboard');
      expect(res.status).toBe(401);
      expect(res.body.data).toBeUndefined();
    });
  });

  describe('caso sin datos', () => {
    test('asesor sin leads asignados recibe 200 con ceros/arreglos vacíos, no un error', async () => {
      const res = await authed(asesorAToken);
      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d.prospectosActivos).toBe(0);
      expect(d.nuevos).toEqual({ hoy: 0, ultimos7dias: 0, esteMes: 0 });
      expect(d.seguimientosVencidos).toBe(0);
      expect(d.citasHoy).toEqual([]);
      expect(d.citasManana).toEqual([]);
      expect(d.citasProximas7Dias).toEqual([]);
      expect(d.requierenAtencion).toEqual([]);
      expect(d.propiedadesInteres).toEqual([]);
      expect(d.actividadReciente).toEqual([]);
      expect(d.conversion).toEqual({ rate: 0, convertidos: 0, gestionados: 0 });
      expect(d.pipeline).toHaveLength(10);
      expect(d.pipeline.every((p) => p.total === 0)).toBe(true);
    });
  });

  describe('aislamiento de datos entre asesores (PASO 12)', () => {
    let leadA, leadB;

    beforeEach(async () => {
      leadA = await createLead({ name: 'Prospecto de A', assignedToUserId: asesorA.id, assignedAt: new Date() });
      leadB = await createLead({ name: 'Prospecto de B', assignedToUserId: asesorB.id, assignedAt: new Date() });

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await createTask({ leadId: leadA.id, assignedToUserId: asesorA.id, dueDate: yesterday, done: false });
      await createTask({ leadId: leadB.id, assignedToUserId: asesorB.id, dueDate: yesterday, done: false });

      const today = new Date();
      await createAppointment({ leadId: leadA.id, scheduledAt: today });
      await createAppointment({ leadId: leadB.id, scheduledAt: today });

      await Activity.create({ leadId: leadA.id, type: 'nota', content: 'Nota de A', userId: asesorA.id });
      await Activity.create({ leadId: leadB.id, type: 'nota', content: 'Nota de B', userId: asesorB.id });
    });

    test('el dashboard de A solo contiene datos de A, nunca de B', async () => {
      const res = await authed(asesorAToken);
      expect(res.status).toBe(200);
      const d = res.body.data;

      expect(d.prospectosActivos).toBe(1);
      expect(d.seguimientosVencidos).toBe(1);

      expect(d.citasHoy).toHaveLength(1);
      expect(d.citasHoy[0].leadId).toBe(leadA.id);
      expect(d.citasHoy.some((a) => a.leadId === leadB.id)).toBe(false);

      expect(d.requierenAtencion.some((r) => r.leadId === leadB.id)).toBe(false);
      expect(d.requierenAtencion.some((r) => r.leadId === leadA.id)).toBe(true);

      expect(d.actividadReciente.some((a) => a.lead?.id === leadB.id)).toBe(false);
      expect(d.actividadReciente.some((a) => a.lead?.id === leadA.id)).toBe(true);
    });

    test('el dashboard de B solo contiene datos de B, nunca de A (simétrico)', async () => {
      const res = await authed(asesorBToken);
      expect(res.status).toBe(200);
      const d = res.body.data;

      expect(d.prospectosActivos).toBe(1);
      expect(d.citasHoy).toHaveLength(1);
      expect(d.citasHoy[0].leadId).toBe(leadB.id);
      expect(d.citasHoy.some((a) => a.leadId === leadA.id)).toBe(false);
      expect(d.requierenAtencion.some((r) => r.leadId === leadA.id)).toBe(false);
      expect(d.actividadReciente.some((a) => a.lead?.id === leadA.id)).toBe(false);
    });

    test('manipular la URL/headers no cambia el resultado — no hay parámetro de userId que aceptar', async () => {
      // No existe ?userId=/?assignedToUserId= en esta ruta — el scope viene únicamente del
      // JWT (req.user), así que intentar inyectarlo como query string no debe tener efecto.
      const res = await request(app)
        .get(`/api/crm/my-dashboard?userId=${asesorB.id}&assignedToUserId=${asesorB.id}`)
        .set('Authorization', `Bearer ${asesorAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.citasHoy.some((a) => a.leadId === leadB.id)).toBe(false);
      expect(res.body.data.prospectosActivos).toBe(1);
    });
  });

  describe('correctitud de métricas', () => {
    test('prospectosActivos excluye etapas terminales', async () => {
      await createLead({ assignedToUserId: asesorA.id, pipelineStage: 'nuevo' });
      await createLead({ assignedToUserId: asesorA.id, pipelineStage: 'negociacion' });
      await createLead({ assignedToUserId: asesorA.id, pipelineStage: 'venta_realizada' });
      await createLead({ assignedToUserId: asesorA.id, pipelineStage: 'no_interesado' });
      await createLead({ assignedToUserId: asesorA.id, pipelineStage: 'lista_espera' });

      const res = await authed(asesorAToken);
      expect(res.body.data.prospectosActivos).toBe(2);
    });

    test('nuevos.hoy cuenta por assignedAt, no por createdAt', async () => {
      const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      // Lead creado hace mucho pero asignado hoy — debe contar como "nuevo" para el asesor.
      const oldLead = await createLead({ assignedToUserId: asesorA.id, assignedAt: new Date() });
      await Lead.update({ createdAt: longAgo }, { where: { id: oldLead.id } });
      // Lead asignado hace mucho — no debe contar.
      const staleAssignment = await createLead({ assignedToUserId: asesorA.id, assignedAt: longAgo });

      const res = await authed(asesorAToken);
      expect(res.body.data.nuevos.hoy).toBe(1);
      expect(staleAssignment).toBeDefined();
    });

    test('conversion.rate = ventaRealizada / (gestionados excluyendo lista_espera)', async () => {
      const leadWon = await createLead({ assignedToUserId: asesorA.id, pipelineStage: 'venta_realizada' });
      await createLead({ assignedToUserId: asesorA.id, pipelineStage: 'no_interesado' });
      await createLead({ assignedToUserId: asesorA.id, pipelineStage: 'nuevo' });
      await createLead({ assignedToUserId: asesorA.id, pipelineStage: 'lista_espera' }); // excluido

      const res = await authed(asesorAToken);
      const { conversion } = res.body.data;
      // gestionados = 3 (excluye lista_espera), convertidos = 1 -> 33.3%
      expect(conversion.gestionados).toBe(3);
      expect(conversion.convertidos).toBe(1);
      expect(conversion.rate).toBeCloseTo(33.3, 1);
      expect(leadWon).toBeDefined();
    });

    test('pipeline agrupa las 10 etapas, incluidas las que no tienen ningún lead', async () => {
      await createLead({ assignedToUserId: asesorA.id, pipelineStage: 'nuevo' });

      const res = await authed(asesorAToken);
      const { pipeline } = res.body.data;
      expect(pipeline).toHaveLength(10);
      const nuevoRow = pipeline.find((p) => p.stage === 'nuevo');
      expect(nuevoRow.total).toBe(1);
      const negociacionRow = pipeline.find((p) => p.stage === 'negociacion');
      expect(negociacionRow.total).toBe(0);
    });

    test('ventasMes suma solo los Deal de leads propios cerrados este mes', async () => {
      const property = await require('./helpers/factories').createProperty();
      const leadWon = await createLead({ assignedToUserId: asesorA.id, pipelineStage: 'venta_realizada' });
      await createDeal({ leadId: leadWon.id, propertyId: property.id, amount: 500000, closedAt: new Date() });

      const otherLead = await createLead({ assignedToUserId: asesorB.id, pipelineStage: 'venta_realizada' });
      await createDeal({ leadId: otherLead.id, propertyId: property.id, amount: 999999, closedAt: new Date() });

      const res = await authed(asesorAToken);
      expect(res.body.data.ventasMes.count).toBe(1);
      expect(res.body.data.ventasMes.total).toBe(500000);
    });

    test('requierenAtencion prioriza cita de hoy sobre tarea vencida para el mismo lead', async () => {
      const lead = await createLead({ assignedToUserId: asesorA.id, pipelineStage: 'nuevo' });
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await createTask({ leadId: lead.id, assignedToUserId: asesorA.id, dueDate: yesterday, done: false });
      await createAppointment({ leadId: lead.id, scheduledAt: new Date() });

      const res = await authed(asesorAToken);
      const entry = res.body.data.requierenAtencion.find((r) => r.leadId === lead.id);
      expect(entry).toBeDefined();
      expect(entry.reasonType).toBe('cita_hoy');
    });

    test('propiedadesInteres agrupa leads activos por Lead.propertyId', async () => {
      const property = await require('./helpers/factories').createProperty();
      await createLead({ assignedToUserId: asesorA.id, propertyId: property.id, pipelineStage: 'nuevo' });
      await createLead({ assignedToUserId: asesorA.id, propertyId: property.id, pipelineStage: 'interesado' });
      await createLead({ assignedToUserId: asesorA.id, pipelineStage: 'nuevo' }); // sin propiedad

      const res = await authed(asesorAToken);
      const entry = res.body.data.propiedadesInteres.find((p) => p.propertyId === property.id);
      expect(entry).toBeDefined();
      expect(entry.leadCount).toBe(2);
    });
  });
});
