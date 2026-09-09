// GET /api/leads?assignedToUserId= (incluido el valor especial 'unassigned') y
// GET /api/leads/counts-by-responsible — filtro/resumen "Responsable" para que
// admin/asistente_administrativo puedan ver de un vistazo qué prospectos tiene cada
// usuario, sin revisarlos uno por uno. Ambos reutilizan getLeadVisibilityWhere
// (leadAccess.js) tal cual, así que un coordinador_ventas/asesor_ventas no puede usar el
// parámetro para escapar de su alcance normal — ver también leadCoordinadorAccess e
// leadFilters para la cobertura de esas reglas de visibilidad ya existentes.
const request = require('supertest');
const app = require('../../app');
const { sequelize, Lead, User } = require('../models/index');
const { createUser, authToken, createLead } = require('./helpers/factories');

describe('CRM de leads — filtro y resumen por responsable', () => {
  let admin, asistente, coordinador, asesorA, asesorB, asesorFuera;
  let adminToken, asistenteToken, coordinadorToken, asesorAToken;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    asistente = await createUser({ role: 'asistente_administrativo' });
    coordinador = await createUser({ role: 'coordinador_ventas' });
    asesorA = await createUser({ role: 'asesor_ventas', supervisorId: coordinador.id });
    asesorB = await createUser({ role: 'asesor_ventas', supervisorId: coordinador.id });
    asesorFuera = await createUser({ role: 'asesor_ventas' });
    adminToken = authToken(admin);
    asistenteToken = authToken(asistente);
    coordinadorToken = authToken(coordinador);
    asesorAToken = authToken(asesorA);
  });

  afterEach(async () => {
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({
      where: { id: [admin.id, asistente.id, coordinador.id, asesorA.id, asesorB.id, asesorFuera.id] },
      force: true,
    });
    await sequelize.close();
  });

  const listAs = (token) => (query = '') =>
    request(app).get(`/api/leads${query}`).set('Authorization', `Bearer ${token}`);
  const countsAs = (token) => (query = '') =>
    request(app)
      .get(`/api/leads/counts-by-responsible${query}`)
      .set('Authorization', `Bearer ${token}`);

  describe('autorización', () => {
    test('admin puede usar el filtro de responsable', async () => {
      await createLead({ assignedToUserId: asesorA.id });
      const res = await listAs(adminToken)(`?assignedToUserId=${asesorA.id}`);
      expect(res.status).toBe(200);
    });

    test('asistente_administrativo puede usar el filtro de responsable', async () => {
      await createLead({ assignedToUserId: asesorA.id });
      const res = await listAs(asistenteToken)(`?assignedToUserId=${asesorA.id}`);
      expect(res.status).toBe(200);
    });

    test('admin puede usar el resumen por responsable', async () => {
      const res = await countsAs(adminToken)();
      expect(res.status).toBe(200);
    });

    test('asistente_administrativo puede usar el resumen por responsable', async () => {
      const res = await countsAs(asistenteToken)();
      expect(res.status).toBe(200);
    });

    test('coordinador_ventas recibe 403 en el resumen por responsable (no gana acceso nuevo)', async () => {
      const res = await countsAs(coordinadorToken)();
      expect(res.status).toBe(403);
    });

    test('asesor_ventas recibe 403 en el resumen por responsable', async () => {
      const res = await countsAs(asesorAToken)();
      expect(res.status).toBe(403);
    });
  });

  describe('filtro assignedToUserId', () => {
    test('assignedToUserId=<usuario A> devuelve únicamente sus prospectos', async () => {
      await createLead({ name: 'De A', assignedToUserId: asesorA.id });
      await createLead({ name: 'De B', assignedToUserId: asesorB.id });

      const res = await listAs(adminToken)(`?assignedToUserId=${asesorA.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.name)).toEqual(['De A']);
    });

    test('assignedToUserId=<usuario B> devuelve únicamente los de B', async () => {
      await createLead({ name: 'De A', assignedToUserId: asesorA.id });
      await createLead({ name: 'De B', assignedToUserId: asesorB.id });

      const res = await listAs(adminToken)(`?assignedToUserId=${asesorB.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.name)).toEqual(['De B']);
    });

    test('sin el parámetro (equivalente a "Todos") conserva el comportamiento actual', async () => {
      await createLead({ name: 'De A', assignedToUserId: asesorA.id });
      await createLead({ name: 'De B', assignedToUserId: asesorB.id });
      await createLead({ name: 'Sin asignar', assignedToUserId: null });

      const res = await listAs(adminToken)();
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.name).sort()).toEqual(['De A', 'De B', 'Sin asignar']);
    });

    test("assignedToUserId=unassigned devuelve solamente prospectos sin responsable", async () => {
      await createLead({ name: 'De A', assignedToUserId: asesorA.id });
      await createLead({ name: 'Sin asignar 1', assignedToUserId: null });
      await createLead({ name: 'Sin asignar 2', assignedToUserId: null });

      const res = await listAs(adminToken)('?assignedToUserId=unassigned');
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.name).sort()).toEqual(['Sin asignar 1', 'Sin asignar 2']);
    });
  });

  describe('combinación con otros filtros', () => {
    test('responsable + businessLine', async () => {
      await createLead({ name: 'A-remate', assignedToUserId: asesorA.id, businessLine: 'remate' });
      await createLead({ name: 'A-credito', assignedToUserId: asesorA.id, businessLine: 'credito' });
      await createLead({ name: 'B-remate', assignedToUserId: asesorB.id, businessLine: 'remate' });

      const res = await listAs(adminToken)(`?assignedToUserId=${asesorA.id}&businessLine=remate`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.name)).toEqual(['A-remate']);
    });

    test('responsable + paymentMethod', async () => {
      await createLead({ name: 'A-contado', assignedToUserId: asesorA.id, paymentMethod: 'contado' });
      await createLead({
        name: 'A-credito',
        assignedToUserId: asesorA.id,
        paymentMethod: 'credito_hipotecario',
      });

      const res = await listAs(adminToken)(`?assignedToUserId=${asesorA.id}&paymentMethod=contado`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.name)).toEqual(['A-contado']);
    });

    test('responsable + pipelineStage (estatus)', async () => {
      await createLead({ name: 'A-nuevo', assignedToUserId: asesorA.id, pipelineStage: 'nuevo' });
      await createLead({
        name: 'A-contactado',
        assignedToUserId: asesorA.id,
        pipelineStage: 'contactado',
      });

      const res = await listAs(adminToken)(`?assignedToUserId=${asesorA.id}&pipelineStage=nuevo`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.name)).toEqual(['A-nuevo']);
    });

    test('responsable + búsqueda (search)', async () => {
      await createLead({ name: 'Juan Pérez', assignedToUserId: asesorA.id, phone: '6560000001' });
      await createLead({ name: 'Juan García', assignedToUserId: asesorB.id, phone: '6560000002' });

      const res = await listAs(adminToken)(`?assignedToUserId=${asesorA.id}&search=Juan`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.name)).toEqual(['Juan Pérez']);
    });

    test('responsable + source (otro filtro existente cualquiera)', async () => {
      await createLead({ name: 'A-google', assignedToUserId: asesorA.id, source: 'google' });
      await createLead({ name: 'A-directo', assignedToUserId: asesorA.id, source: 'directo' });
      await createLead({ name: 'B-google', assignedToUserId: asesorB.id, source: 'google' });

      const res = await listAs(adminToken)(`?assignedToUserId=${asesorA.id}&source=google`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.name)).toEqual(['A-google']);
    });

    test('responsable=unassigned + estatus', async () => {
      await createLead({ name: 'Sin asignar nuevo', assignedToUserId: null, pipelineStage: 'nuevo' });
      await createLead({
        name: 'Sin asignar contactado',
        assignedToUserId: null,
        pipelineStage: 'contactado',
      });

      const res = await listAs(adminToken)('?assignedToUserId=unassigned&pipelineStage=nuevo');
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.name)).toEqual(['Sin asignar nuevo']);
    });
  });

  describe('paginación', () => {
    test('el filtro de responsable funciona correctamente con varias páginas', async () => {
      for (let i = 0; i < 3; i++) {
        await createLead({ name: `A-${i}`, assignedToUserId: asesorA.id });
      }
      await createLead({ name: 'B-0', assignedToUserId: asesorB.id });

      const page1 = await listAs(adminToken)(`?assignedToUserId=${asesorA.id}&page=1&limit=2`);
      expect(page1.status).toBe(200);
      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.pagination).toMatchObject({ total: 3, page: 1, hasNext: true });

      const page2 = await listAs(adminToken)(`?assignedToUserId=${asesorA.id}&page=2&limit=2`);
      expect(page2.status).toBe(200);
      expect(page2.body.data).toHaveLength(1);
      expect(page2.body.pagination).toMatchObject({ total: 3, page: 2, hasNext: false });
    });

    test('el total reportado no se limita a lo cargado en la página actual', async () => {
      for (let i = 0; i < 5; i++) {
        await createLead({ name: `A-${i}`, assignedToUserId: asesorA.id });
      }
      const res = await listAs(adminToken)(`?assignedToUserId=${asesorA.id}&page=1&limit=2`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(5);
    });
  });

  describe('seguridad — no se puede manipular el parámetro para escapar del alcance permitido', () => {
    test('un asesor_ventas que pasa assignedToUserId de OTRO usuario sigue viendo solo lo suyo', async () => {
      const own = await createLead({ name: 'Propio de A', assignedToUserId: asesorA.id });
      await createLead({ name: 'De B', assignedToUserId: asesorB.id });

      const res = await listAs(asesorAToken)(`?assignedToUserId=${asesorB.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.id)).toEqual([own.id]);
    });

    test('un asesor_ventas que pasa assignedToUserId=unassigned NO ve los prospectos sin asignar de todo el sistema', async () => {
      const own = await createLead({ name: 'Propio de A', assignedToUserId: asesorA.id });
      await createLead({ name: 'Sin asignar', assignedToUserId: null });

      const res = await listAs(asesorAToken)('?assignedToUserId=unassigned');
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.id)).toEqual([own.id]);
    });

    test('un coordinador_ventas que pasa assignedToUserId de un asesor FUERA de su equipo no obtiene esos leads', async () => {
      const leadFuera = await createLead({ name: 'Fuera', assignedToUserId: asesorFuera.id });
      const leadEquipo = await createLead({ name: 'Equipo A', assignedToUserId: asesorA.id });

      const res = await listAs(coordinadorToken)(`?assignedToUserId=${asesorFuera.id}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((l) => l.id);
      expect(ids).not.toContain(leadFuera.id);
      // El where de visibilidad de coordinador sobrescribe el filtro puntual por el de todo
      // su equipo — no gana ni pierde acceso por el intento, simplemente el parámetro no lo
      // saca de su alcance normal.
      expect(ids).toContain(leadEquipo.id);
    });

    test('un usuario sin acceso al CRM (token inválido) recibe 401, no una lista vacía silenciosa', async () => {
      const res = await request(app).get('/api/leads?assignedToUserId=unassigned');
      expect(res.status).toBe(401);
    });
  });

  describe('resumen por responsable (counts-by-responsible)', () => {
    test('agrupa correctamente por usuario y por "sin asignar", sin N+1 (una sola llamada)', async () => {
      await createLead({ name: 'A1', assignedToUserId: asesorA.id });
      await createLead({ name: 'A2', assignedToUserId: asesorA.id });
      await createLead({ name: 'B1', assignedToUserId: asesorB.id });
      await createLead({ name: 'Sin asignar', assignedToUserId: null });

      const res = await countsAs(adminToken)();
      expect(res.status).toBe(200);
      const byUserId = Object.fromEntries(res.body.data.map((r) => [r.userId, r]));
      expect(byUserId[asesorA.id]).toMatchObject({ count: 2, user: { name: asesorA.name } });
      expect(byUserId[asesorB.id]).toMatchObject({ count: 1, user: { name: asesorB.name } });
      expect(byUserId[null]).toMatchObject({ count: 1, user: null });
    });

    test('respeta los mismos filtros activos que la lista (ej. businessLine)', async () => {
      await createLead({ name: 'A-remate', assignedToUserId: asesorA.id, businessLine: 'remate' });
      await createLead({ name: 'A-credito', assignedToUserId: asesorA.id, businessLine: 'credito' });
      await createLead({ name: 'B-remate', assignedToUserId: asesorB.id, businessLine: 'remate' });

      const res = await countsAs(adminToken)('?businessLine=remate');
      expect(res.status).toBe(200);
      const byUserId = Object.fromEntries(res.body.data.map((r) => [r.userId, r]));
      expect(byUserId[asesorA.id].count).toBe(1);
      expect(byUserId[asesorB.id].count).toBe(1);
    });
  });
});
