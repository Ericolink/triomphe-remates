jest.mock('../services/emailService', () => ({
  sendNewLeadNotification: jest.fn().mockResolvedValue(),
  sendLeadConfirmation: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const app = require('../../app');
const { sequelize, Lead, User } = require('../models/index');
const { createUser, authToken, createLead } = require('./helpers/factories');

describe('POST /api/leads', () => {
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
    // sequelize.close() se deja al último describe del archivo (ver más abajo) — dos
    // describes en el mismo archivo comparten la misma conexión module-level, así que
    // cerrarla acá rompería el beforeAll del describe siguiente.
    await User.destroy({ where: { id: admin.id }, force: true });
  });

  test('crea el lead sin nombre con un placeholder (campo opcional)', async () => {
    const res = await request(app).post('/api/leads').send({ phone: '6561234567' });
    expect(res.status).toBe(201);

    const stored = await Lead.findOne({ where: { phone: '6561234567' } });
    expect(stored.name).toBe('Prospecto sin nombre');
  });

  test('rechaza email inválido', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Juan', email: 'no-es-un-email' });
    expect(res.status).toBe(400);
  });

  test('rechaza teléfono inválido (AUDIT-006)', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Juan', email: 'juan@test.com', phone: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/teléfono/i);
  });

  test('crea el lead con teléfono válido en distintos formatos', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Juan Pérez', email: 'juan@test.com', phone: '+52 656 123 4567' });

    expect(res.status).toBe(201);

    const stored = await Lead.findOne({ where: { email: 'juan@test.com' } });
    expect(stored).not.toBeNull();
  });

  test('rechaza el lead sin teléfono cuando no hay usuario autenticado (formulario público)', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Sin Teléfono', email: 'sintelefono@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/teléfono/i);
  });

  test('permite el lead sin teléfono cuando lo crea un usuario autenticado (CRM, campo opcional)', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sin Teléfono CRM' });

    expect(res.status).toBe(201);
  });

  test('rechaza un motivo de contacto fuera de la lista permitida', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ phone: '6561234567', type: 'informacion' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/motivo/i);
  });

  test('rechaza una ciudad de búsqueda fuera de la lista permitida', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ phone: '6561234568', searchCity: 'monterrey' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ciudad/i);
  });

  test('rechaza un tipo de propiedad buscado fuera de la lista permitida', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ phone: '6561234569', desiredType: 'yate' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tipo de propiedad/i);
  });

  test('rechaza una urgencia fuera de la lista permitida', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ phone: '6561234570', urgency: 'ya_merito' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/urgencia/i);
  });

  test('rechaza recámaras mínimas negativas', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ phone: '6561234571', minBedrooms: -1 });

    expect(res.status).toBe(400);
  });

  test('crea el lead con criterios de búsqueda válidos', async () => {
    const res = await request(app).post('/api/leads').send({
      phone: '6561234572',
      searchCity: 'juarez',
      searchZone: 'Campestre',
      desiredType: 'casa',
      minBedrooms: 3,
      minBathrooms: 2,
      desiredFeatures: 'con cochera',
      urgency: 'inmediata',
    });
    expect(res.status).toBe(201);

    const stored = await Lead.findOne({ where: { phone: '6561234572' } });
    expect(stored.searchCity).toBe('juarez');
    expect(stored.searchZone).toBe('Campestre');
    expect(stored.desiredType).toBe('casa');
    expect(stored.minBedrooms).toBe(3);
    expect(stored.minBathrooms).toBe(2);
    expect(stored.desiredFeatures).toBe('con cochera');
    expect(stored.urgency).toBe('inmediata');
  });

  describe('type: "cita" — validación de horario en la zona horaria de negocio (CAL-001)', () => {
    // `appointmentDate` llega como ISO UTC explícito (con sufijo Z) — igual que ahora lo
    // manda ContactForm.jsx. America/Chihuahua no observa horario de verano desde la
    // reforma de 2022 (offset fijo -6 todo el año — verificado en el propio test de abajo
    // para no asumirlo a ciegas), así que "10:00 Chihuahua" == "16:00 UTC" siempre.
    const CHIHUAHUA_UTC_OFFSET_HOURS = 6;

    test('la zona horaria de referencia (America/Chihuahua) mantiene offset fijo -6 todo el año (sin horario de verano)', () => {
      const invierno = new Date('2026-01-15T12:00:00Z');
      const verano = new Date('2026-07-15T12:00:00Z');
      const offsetOf = (date) =>
        new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chihuahua', timeZoneName: 'shortOffset' })
          .formatToParts(date)
          .find((p) => p.type === 'timeZoneName').value;
      expect(offsetOf(invierno)).toBe('GMT-6');
      expect(offsetOf(verano)).toBe('GMT-6');
    });

    // Encuentra un día entre semana (lun-vie en hora de Chihuahua) al menos `daysAhead`
    // días en el futuro, y arma el ISO UTC correspondiente a las `hourChihuahua`:00 hora
    // de Chihuahua ese día.
    function futureWeekdayApptISO(daysAhead, hourChihuahua) {
      let d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
      const weekdayOf = (date) =>
        new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chihuahua', weekday: 'short' }).format(date);
      while (['Sat', 'Sun'].includes(weekdayOf(d))) {
        d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      }
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Chihuahua',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
          .formatToParts(d)
          .map((p) => [p.type, p.value])
      );
      const utcHour = hourChihuahua + CHIHUAHUA_UTC_OFFSET_HOURS;
      return `${parts.year}-${parts.month}-${parts.day}T${String(utcHour).padStart(2, '0')}:00:00.000Z`;
    }

    test('acepta 15:00 hora de Chihuahua (UTC 21:00) — leer la hora UTC cruda la rechazaría por error', async () => {
      // Caso discriminador: 15:00 Chihuahua es horario comercial válido, pero se serializa
      // como "T21:00:00.000Z" — un servidor que (como antes del fix) leyera la hora
      // directamente del string sin convertir de zona horaria vería "21" y la rechazaría
      // por estar fuera de 9-18, aunque en Chihuahua sí sea una hora válida.
      const appointmentDate = futureWeekdayApptISO(10, 15);
      const res = await request(app)
        .post('/api/leads')
        .send({ phone: '6567770001', type: 'cita', appointmentDate });

      expect(res.status).toBe(201);
    });

    test('rechaza 04:00 AM hora de Chihuahua (UTC 10:00) — leer la hora UTC cruda la aceptaría por error', async () => {
      // Caso discriminador inverso: 4:00 AM en Chihuahua está fuera de horario comercial,
      // pero se serializa como "T10:00:00.000Z" — un servidor que leyera "10" directamente
      // del string (sin convertir de zona horaria) la aceptaría por error, ya que 10 SÍ
      // cae dentro de 9-18.
      const appointmentDate = futureWeekdayApptISO(10, 4);
      const res = await request(app)
        .post('/api/leads')
        .send({ phone: '6567770002', type: 'cita', appointmentDate });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/horario/i);
    });

    test('rechaza una cita agendada en fin de semana (calculado en hora de Chihuahua, no UTC)', async () => {
      // Construye un sábado en hora de Chihuahua a las 10:00 — si el día de la semana se
      // calculara en UTC en vez de en hora de Chihuahua, este mismo instante podría caer
      // en domingo por el cruce de medianoche en otra zona.
      let d = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const weekdayOf = (date) =>
        new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chihuahua', weekday: 'short' }).format(date);
      while (weekdayOf(d) !== 'Sat') {
        d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
      }
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Chihuahua',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
          .formatToParts(d)
          .map((p) => [p.type, p.value])
      );
      const appointmentDate = `${parts.year}-${parts.month}-${parts.day}T${String(10 + CHIHUAHUA_UTC_OFFSET_HOURS).padStart(2, '0')}:00:00.000Z`;

      const res = await request(app)
        .post('/api/leads')
        .send({ phone: '6567770003', type: 'cita', appointmentDate });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/fin de semana/i);
    });

    test('rechaza una cita con menos de 24 horas de anticipación', async () => {
      // Fija "ahora" a un lunes 08:00 hora de Chihuahua conocido, para poder construir un
      // horario que sea simultáneamente válido en hora/día (15:00 del mismo lunes) pero a
      // menos de 24h — sin esto, "+2 horas desde ahora" cae fuera de horario comercial o
      // en fin de semana según el momento real en que corra la suite, y la petición se
      // rechazaría por esa otra regla en vez de por el lead time, invalidando el test.
      const mondayUTCNoon = new Date('2026-03-02T14:00:00.000Z'); // lunes 08:00 Chihuahua
      // Solo se fija Date — los timers reales (setTimeout/setImmediate/nextTick) se dejan
      // intactos para no interferir con el I/O real de supertest/Express bajo la prueba.
      jest
        .useFakeTimers({
          doNotFake: [
            'setTimeout',
            'clearTimeout',
            'setInterval',
            'clearInterval',
            'setImmediate',
            'clearImmediate',
            'nextTick',
            'queueMicrotask',
          ],
        })
        .setSystemTime(mondayUTCNoon);
      try {
        const appointmentDate = '2026-03-02T21:00:00.000Z'; // mismo lunes, 15:00 Chihuahua
        const res = await request(app)
          .post('/api/leads')
          .send({ phone: '6567770004', type: 'cita', appointmentDate });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/24 horas/i);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});

describe('GET /api/leads — "Todas las etapas" excluye venta_realizada y lista_espera por default', () => {
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

  test('sin filtro de etapa, oculta venta_realizada y lista_espera pero no no_interesado', async () => {
    await createLead({ name: 'Nuevo', pipelineStage: 'nuevo' });
    await createLead({ name: 'Ganado', pipelineStage: 'venta_realizada' });
    await createLead({ name: 'No interesado', pipelineStage: 'no_interesado' });
    await createLead({ name: 'Espera', pipelineStage: 'lista_espera' });

    const res = await authed();
    expect(res.status).toBe(200);
    const names = res.body.data.map((l) => l.name).sort();
    expect(names).toEqual(['No interesado', 'Nuevo']);
  });

  test('filtrando explícitamente por pipelineStage=venta_realizada sí los devuelve', async () => {
    await createLead({ name: 'Ganado', pipelineStage: 'venta_realizada' });
    await createLead({ name: 'Nuevo', pipelineStage: 'nuevo' });

    const res = await authed('?pipelineStage=venta_realizada');
    expect(res.status).toBe(200);
    expect(res.body.data.map((l) => l.name)).toEqual(['Ganado']);
  });

  test('allStages=true también los devuelve (usado por CampanasSection)', async () => {
    await createLead({ name: 'Ganado', pipelineStage: 'venta_realizada' });
    await createLead({ name: 'Espera', pipelineStage: 'lista_espera' });
    await createLead({ name: 'Nuevo', pipelineStage: 'nuevo' });

    const res = await authed('?allStages=true');
    expect(res.status).toBe(200);
    expect(res.body.data.map((l) => l.name).sort()).toEqual(['Espera', 'Ganado', 'Nuevo']);
  });
});
