// Fase 1 de analítica de tráfico — GET /api/analytics/traffic. Cubre control de acceso,
// filtrado por rango de fechas, y que el cálculo de "propiedades más vistas" use la relación
// real Analytics -> Property y Lead/LeadProperty (no una relación inventada).
const request = require('supertest');
const app = require('../../app');
const { sequelize, User, Property, Lead, Analytics } = require('../models/index');
const {
  createUser,
  authToken,
  createProperty,
  createLead,
  createAnalyticsEvent,
  createLeadProperty,
  uuid,
} = require('./helpers/factories');
const { mexicoMidnightUtc, mexicoDateKey } = require('../utils/mexicoTime');

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const REAL_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const postEvent = (body) =>
  request(app)
    .post('/api/analytics/events')
    .set('Content-Type', 'text/plain')
    .set('User-Agent', REAL_BROWSER_UA)
    .send(JSON.stringify(body));

describe('GET /api/analytics/traffic', () => {
  let admin, asesor, adminToken, asesorToken;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    asesor = await createUser({ role: 'asesor_ventas' });
    adminToken = authToken(admin);
    asesorToken = authToken(asesor);
  });

  afterEach(async () => {
    await Analytics.destroy({ where: {}, force: true });
    await Lead.destroy({ where: {}, force: true });
    await Property.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: [admin.id, asesor.id] }, force: true });
    await sequelize.close();
  });

  test('sin token responde 401', async () => {
    const res = await request(app).get('/api/analytics/traffic');
    expect(res.status).toBe(401);
  });

  test('un rol sin acceso a analítica responde 403', async () => {
    const res = await request(app).get('/api/analytics/traffic').set('Authorization', `Bearer ${asesorToken}`);
    expect(res.status).toBe(403);
  });

  test('admin recibe la forma esperada de datos', async () => {
    const res = await request(app).get('/api/analytics/traffic').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totals).toEqual(
      expect.objectContaining({
        pageViews: expect.any(Object),
        uniqueVisitors: expect.any(Object),
        sessions: expect.any(Object),
        propertyViews: expect.any(Object),
        contacts: expect.any(Object),
      })
    );
    expect(Array.isArray(res.body.data.traffic.current)).toBe(true);
    expect(Array.isArray(res.body.data.sources)).toBe(true);
    expect(Array.isArray(res.body.data.devices)).toBe(true);
    expect(Array.isArray(res.body.data.topPages)).toBe(true);
    expect(Array.isArray(res.body.data.topProperties)).toBe(true);
  });

  test('respeta el rango de fechas: eventos fuera del rango no se cuentan', async () => {
    await createAnalyticsEvent({ event: 'page_view', path: '/dentro', createdAt: daysAgo(1) });
    await createAnalyticsEvent({ event: 'page_view', path: '/fuera', createdAt: daysAgo(40) });

    const res = await request(app)
      .get('/api/analytics/traffic?range=7d')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totals.pageViews.value).toBe(1);
  });

  test('excluye eventos marcados isBot=true de los totales', async () => {
    await createAnalyticsEvent({ event: 'page_view', isBot: false, createdAt: daysAgo(1) });
    await createAnalyticsEvent({ event: 'page_view', isBot: true, createdAt: daysAgo(1) });

    const res = await request(app)
      .get('/api/analytics/traffic?range=7d')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data.totals.pageViews.value).toBe(1);
  });

  test('acepta un rango personalizado from/to', async () => {
    await createAnalyticsEvent({ event: 'page_view', createdAt: new Date('2026-01-15T10:00:00') });
    await createAnalyticsEvent({ event: 'page_view', createdAt: new Date('2026-02-15T10:00:00') });

    const res = await request(app)
      .get('/api/analytics/traffic?from=2026-01-01&to=2026-01-31')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totals.pageViews.value).toBe(1);
  });

  test('calcula views/contactos/conversión por propiedad usando Lead y LeadProperty reales', async () => {
    const propertyA = await createProperty({ title: 'Casa con contacto directo' });
    const propertyB = await createProperty({ title: 'Casa con contacto vía interés adicional' });
    const propertyC = await createProperty({ title: 'Casa sin contactos' });

    // 4 vistas a A, 2 a B, 1 a C.
    for (let i = 0; i < 4; i++) {
      await createAnalyticsEvent({ event: 'property_view', propertyId: propertyA.id, path: `/propiedades/${propertyA.id}`, createdAt: daysAgo(1) });
    }
    for (let i = 0; i < 2; i++) {
      await createAnalyticsEvent({ event: 'property_view', propertyId: propertyB.id, path: `/propiedades/${propertyB.id}`, createdAt: daysAgo(1) });
    }
    await createAnalyticsEvent({ event: 'property_view', propertyId: propertyC.id, path: `/propiedades/${propertyC.id}`, createdAt: daysAgo(1) });

    // A recibe un lead directo (Lead.propertyId).
    await createLead({ propertyId: propertyA.id, createdAt: daysAgo(1) });
    // B recibe un lead vía "propiedad de interés adicional" (LeadProperty), con OTRA
    // propiedad como origen — exactamente el caso que LeadProperty existe para cubrir.
    const leadForB = await createLead({ propertyId: propertyC.id, createdAt: daysAgo(1) });
    await createLeadProperty({ leadId: leadForB.id, propertyId: propertyB.id });
    // C no recibe ningún contacto propio (el lead de arriba cuenta para C solo si fuera
    // directo, pero su origen es C mismo — se agrega aparte para probar el conteo directo).
    await createLead({ propertyId: propertyC.id, createdAt: daysAgo(1) });

    const res = await request(app)
      .get('/api/analytics/traffic?range=7d')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.data.topProperties.map((p) => [p.propertyId, p]));

    expect(byId[propertyA.id]).toEqual(
      expect.objectContaining({ views: 4, contacts: 1, conversionRate: 25 })
    );
    expect(byId[propertyB.id]).toEqual(
      expect.objectContaining({ views: 2, contacts: 1, conversionRate: 50 })
    );
    expect(byId[propertyC.id]).toEqual(
      expect.objectContaining({ views: 1, contacts: 2, conversionRate: 200 })
    );
  });

  test('clasifica fuentes de tráfico por utm_source y por host del referrer', async () => {
    const s1 = uuid();
    const s2 = uuid();
    const s3 = uuid();
    const s4 = uuid();
    await createAnalyticsEvent({ event: 'page_view', sessionId: s1, utmSource: 'instagram', createdAt: daysAgo(1) });
    await createAnalyticsEvent({ event: 'page_view', sessionId: s2, referrerHost: 'google.com', createdAt: daysAgo(1) });
    await createAnalyticsEvent({ event: 'page_view', sessionId: s3, referrerHost: null, utmSource: null, createdAt: daysAgo(1) });
    await createAnalyticsEvent({ event: 'page_view', sessionId: s4, referrerHost: 'bing.com', createdAt: daysAgo(1) });

    const res = await request(app)
      .get('/api/analytics/traffic?range=7d')
      .set('Authorization', `Bearer ${adminToken}`);

    const bySource = Object.fromEntries(res.body.data.sources.map((s) => [s.source, s.total]));
    expect(bySource.instagram).toBe(1);
    expect(bySource.google).toBe(1);
    expect(bySource.directo).toBe(1);
    expect(bySource.otros).toBe(1);
  });

  test('la gráfica de tráfico bucketea por día de México, no por DATE(createdAt) en UTC de MySQL', async () => {
    // 23:30 hora México de AYER — en UTC ya es "hoy" (05:30 UTC). DATE(createdAt) de MySQL
    // lo pondría en el bucket de HOY; el día real de México es AYER. Ver mismo caso en
    // analyticsLegacyDashboard.integration.test.js y mexicoTime.test.js.
    const lastNightMexico = new Date(mexicoMidnightUtc(0).getTime() - 30 * 60 * 1000);
    const expectedKey = mexicoDateKey(lastNightMexico);
    await createAnalyticsEvent({ event: 'page_view', createdAt: lastNightMexico });

    const res = await request(app)
      .get('/api/analytics/traffic?range=7d')
      .set('Authorization', `Bearer ${adminToken}`);

    const bucket = res.body.data.traffic.current.find((d) => d.date === expectedKey);
    expect(bucket).toBeDefined();
    expect(bucket.count).toBe(1);
  });

  // Caso 3 del ajuste de producto: dos visitantes reales distintos viendo la misma página
  // deben producir 2 page_view, 2 visitantes únicos y 2 sesiones (1 por visitante) — pasa
  // por el endpoint real de ingesta (no la factory que inserta directo en la tabla) para
  // probar la tubería completa: sin dedup de page_view entre visitantes distintos, y sin que
  // "visitantes" o "sesiones" colapsen a un solo número por accidente.
  test('Caso 3 — 2 visitantes distintos a la misma página: 2 page views, 2 visitantes únicos, 2 sesiones', async () => {
    const visitorA = uuid();
    const sessionA = uuid();
    const visitorB = uuid();
    const sessionB = uuid();

    await postEvent({
      event: 'page_view',
      visitorId: visitorA,
      sessionId: sessionA,
      path: '/propiedades',
    });
    await postEvent({
      event: 'page_view',
      visitorId: visitorB,
      sessionId: sessionB,
      path: '/propiedades',
    });

    const res = await request(app)
      .get('/api/analytics/traffic?range=today')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totals.pageViews.value).toBe(2);
    expect(res.body.data.totals.uniqueVisitors.value).toBe(2);
    expect(res.body.data.totals.sessions.value).toBe(2);
  });
});
