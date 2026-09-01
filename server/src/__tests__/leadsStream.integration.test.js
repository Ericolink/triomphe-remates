// SEC-003 / BUG-001 — GET /api/leads/stream (SSE) transmitía cada evento `new-lead` a
// TODOS los clientes CRM conectados sin filtrar por `assignedToUserId`, a diferencia de
// cada endpoint REST del módulo (getLeads, getLeadById, appointments, tasks, deals,
// export), que sí aplica canViewLead/getLeadVisibilityWhere. Estos tests conectan de
// verdad al stream (supertest no soporta bien conexiones long-lived, así que se usa un
// servidor http real en un puerto efímero) y verifican que el filtrado por visibilidad
// realmente ocurre, no solo que la conexión se abre.
jest.mock('../services/emailService', () => ({
  sendNewLeadNotification: jest.fn().mockResolvedValue(),
  sendLeadConfirmation: jest.fn().mockResolvedValue(),
}));

const http = require('http');
const request = require('supertest');
const app = require('../../app');
const { sequelize, Lead, User } = require('../models/index');
const { createUser, authToken } = require('./helpers/factories');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mismo formato/gotcha documentado en helpers/factories.js: 10 dígitos exactos, varían por
// llamada dentro del mismo proceso para no chocar con leads vivos de otros test files que
// corren en paralelo contra la misma BD de test.
function uniquePhone(n) {
  return `6${Date.now().toString().slice(-6)}${String(n).slice(-3).padStart(3, '0')}`;
}

async function waitUntil(predicate, { retries = 30, delayMs = 50 } = {}) {
  for (let i = 0; i < retries; i++) {
    if (predicate()) return true;
    await sleep(delayMs);
  }
  return false;
}

describe('GET /api/leads/stream — aislamiento por visibilidad de lead', () => {
  let server;
  let baseUrl;
  let admin, asesorA, asesorB;
  let adminToken, asesorAToken;
  const openConnections = [];

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    asesorA = await createUser({ role: 'asesor_ventas' });
    asesorB = await createUser({ role: 'asesor_ventas' });
    adminToken = authToken(admin);
    asesorAToken = authToken(asesorA);

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    while (openConnections.length) {
      const req = openConnections.pop();
      req.destroy();
    }
    // Da tiempo a que el servidor procese el cierre del socket (req.on('close') en
    // streamLeads) antes del siguiente test, para que no queden listeners de una
    // conexión anterior contaminando el conteo de eventos del siguiente caso.
    await sleep(50);
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await User.destroy({ where: { id: [admin.id, asesorA.id, asesorB.id] }, force: true });
    await sequelize.close();
  });

  // Abre una conexión SSE real contra el servidor efímero. Para una respuesta no-200
  // (401 sin token válido) resuelve con el body ya completo; para un stream (200) resuelve
  // con un objeto que acumula los eventos `new-lead` recibidos, parseados desde el
  // formato `event: ...\ndata: {...}\n\n`.
  function connectStream(token) {
    return new Promise((resolve, reject) => {
      const url = token ? `${baseUrl}/api/leads/stream?token=${token}` : `${baseUrl}/api/leads/stream`;
      const req = http.get(url, (res) => {
        openConnections.push(req);

        if (res.statusCode !== 200) {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ statusCode: res.statusCode, body }));
          return;
        }

        let buffer = '';
        const events = [];
        res.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          let idx;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data: '));
            if (dataLine) events.push(JSON.parse(dataLine.slice('data: '.length)));
          }
        });

        resolve({ statusCode: res.statusCode, events });
      });
      req.on('error', reject);
    });
  }

  test('1) un usuario no autenticado no puede conectarse al stream', async () => {
    const conn = await connectStream(null);
    expect(conn.statusCode).toBe(401);
  });

  test('1b) un token inválido tampoco puede conectarse al stream', async () => {
    const conn = await connectStream('token-invalido');
    expect(conn.statusCode).toBe(401);
  });

  test('2) un asesor recibe el evento de un lead asignado a él mismo', async () => {
    const conn = await connectStream(asesorAToken);
    expect(conn.statusCode).toBe(200);

    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Prospecto de A', phone: uniquePhone(1), assignedToUserId: asesorA.id });
    expect(res.status).toBe(201);

    const arrived = await waitUntil(() => conn.events.length > 0);
    expect(arrived).toBe(true);
    expect(conn.events[0]).toMatchObject({
      id: res.body.data.id,
      assignedToUserId: asesorA.id,
    });
  });

  test('3) un asesor NO recibe el evento de un lead asignado a otro asesor', async () => {
    const conn = await connectStream(asesorAToken);
    expect(conn.statusCode).toBe(200);

    // Lead ajeno (asignado a asesorB) — no debe llegarle nada a la conexión de asesorA.
    const foreignLead = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Prospecto de B', phone: uniquePhone(2), assignedToUserId: asesorB.id });
    expect(foreignLead.status).toBe(201);

    // Ventana de gracia para descartar que simplemente no le hubiera dado tiempo de llegar.
    await sleep(300);
    expect(conn.events.length).toBe(0);

    // Control positivo: la MISMA conexión sigue viva y sí recibe un evento cuando el lead
    // es visible para asesorA — descarta que el "0 eventos" de arriba fuera un problema de
    // la conexión/plumbing en vez de un filtrado correcto.
    const ownLead = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Prospecto de A (control)', phone: uniquePhone(3), assignedToUserId: asesorA.id });
    expect(ownLead.status).toBe(201);

    const arrived = await waitUntil(() => conn.events.length > 0);
    expect(arrived).toBe(true);
    expect(conn.events[0].id).toBe(ownLead.body.data.id);
  });

  test('4) un admin conectado al stream mantiene el comportamiento anterior: recibe todos los leads nuevos', async () => {
    const conn = await connectStream(adminToken);
    expect(conn.statusCode).toBe(200);

    const leadForA = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Prospecto de A visto por admin', phone: uniquePhone(4), assignedToUserId: asesorA.id });
    expect(leadForA.status).toBe(201);

    const leadForB = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Prospecto de B visto por admin', phone: uniquePhone(5), assignedToUserId: asesorB.id });
    expect(leadForB.status).toBe(201);

    const arrived = await waitUntil(() => conn.events.length >= 2);
    expect(arrived).toBe(true);
    const ids = conn.events.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining([leadForA.body.data.id, leadForB.body.data.id]));
  });
});
