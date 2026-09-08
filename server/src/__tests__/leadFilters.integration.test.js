// GET /api/leads?businessLine=&paymentMethod= — filtros de búsqueda del CRM (issue: agregar
// filtros de línea de negocio / método de pago a la lista de prospectos). Ambos campos ya
// existían en Lead (ver models/Lead.js) y solo se exponen aquí como query params nuevos,
// reutilizando VALID_BUSINESS_LINES/VALID_PAYMENT_METHODS ya usados por create/updateLead.
const request = require('supertest');
const app = require('../../app');
const { sequelize, Lead, User } = require('../models/index');
const { createUser, authToken, createLead } = require('./helpers/factories');

describe('GET /api/leads — filtros businessLine / paymentMethod', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  const authed = (query = '') =>
    request(app)
      .get(`/api/leads${query}`)
      .set('Authorization', `Bearer ${token}`);

  test('sin filtros devuelve todos los prospectos normalmente', async () => {
    await createLead({ name: 'A', businessLine: 'remate', paymentMethod: 'contado' });
    await createLead({ name: 'B', businessLine: 'credito', paymentMethod: 'credito_hipotecario' });

    const res = await authed();
    expect(res.status).toBe(200);
    expect(res.body.data.map((l) => l.name).sort()).toEqual(['A', 'B']);
  });

  test('filtra por línea de negocio', async () => {
    await createLead({ name: 'Remate', businessLine: 'remate' });
    await createLead({ name: 'Credito', businessLine: 'credito' });

    const res = await authed('?businessLine=remate');
    expect(res.status).toBe(200);
    expect(res.body.data.map((l) => l.name)).toEqual(['Remate']);
  });

  test('filtra por método de pago', async () => {
    await createLead({ name: 'Contado', paymentMethod: 'contado' });
    await createLead({ name: 'Credito', paymentMethod: 'credito_hipotecario' });

    const res = await authed('?paymentMethod=contado');
    expect(res.status).toBe(200);
    expect(res.body.data.map((l) => l.name)).toEqual(['Contado']);
  });

  test('combina businessLine + paymentMethod (AND, no OR)', async () => {
    await createLead({ name: 'Match', businessLine: 'remate', paymentMethod: 'contado' });
    await createLead({ name: 'SoloLinea', businessLine: 'remate', paymentMethod: 'credito_hipotecario' });
    await createLead({ name: 'SoloPago', businessLine: 'credito', paymentMethod: 'contado' });

    const res = await authed('?businessLine=remate&paymentMethod=contado');
    expect(res.status).toBe(200);
    expect(res.body.data.map((l) => l.name)).toEqual(['Match']);
  });

  test('combina búsqueda (search) + filtros', async () => {
    await createLead({ name: 'Juan Pérez', businessLine: 'remate' });
    await createLead({ name: 'Juan García', businessLine: 'credito' });
    await createLead({ name: 'Otro Nombre', businessLine: 'remate' });

    const res = await authed('?search=Juan&businessLine=remate');
    expect(res.status).toBe(200);
    expect(res.body.data.map((l) => l.name)).toEqual(['Juan Pérez']);
  });

  test('combina filtros + paginación', async () => {
    for (let i = 0; i < 3; i++) {
      await createLead({ name: `Remate ${i}`, businessLine: 'remate' });
    }
    await createLead({ name: 'Credito', businessLine: 'credito' });

    const page1 = await authed('?businessLine=remate&page=1&limit=2');
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.pagination).toMatchObject({ total: 3, page: 1, hasNext: true });

    const page2 = await authed('?businessLine=remate&page=2&limit=2');
    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.pagination).toMatchObject({ total: 3, page: 2, hasNext: false });
  });

  test('rechaza un valor de businessLine inválido con 400, no 500', async () => {
    const res = await authed('?businessLine=inventado');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Línea de negocio inválida/);
  });

  test('rechaza un valor de paymentMethod inválido con 400, no 500', async () => {
    const res = await authed('?paymentMethod=inventado');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Forma de pago inválida/);
  });

  test('devuelve una lista vacía (sin error) cuando ningún prospecto coincide', async () => {
    await createLead({ name: 'Único', businessLine: 'credito' });

    const res = await authed('?businessLine=inversion');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  test('un filtro no enviado no restringe el resultado (businessLine sin especificar)', async () => {
    await createLead({ name: 'Sin línea', businessLine: null });
    await createLead({ name: 'Con línea', businessLine: 'renta' });

    const res = await authed('?paymentMethod=');
    expect(res.status).toBe(200);
    expect(res.body.data.map((l) => l.name).sort()).toEqual(['Con línea', 'Sin línea']);
  });
});
