// Fase 1 de analítica de tráfico — cobertura de POST /api/analytics/events (endpoint
// público de ingesta) y de la migración de trackView/trackShare al mismo
// analyticsService.recordEvent: validación estricta, deduplicación, detección de bots y
// rate limit. Ver server/src/services/analyticsService.js.
const request = require('supertest');
const app = require('../../app');
const { sequelize, Analytics, Property } = require('../models/index');
const { createProperty, uuid } = require('./helpers/factories');

const REAL_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const validPayload = (overrides = {}) => ({
  event: 'page_view',
  visitorId: uuid(),
  sessionId: uuid(),
  path: '/propiedades',
  ...overrides,
});

const post = (body, ua = REAL_BROWSER_UA) =>
  request(app)
    .post('/api/analytics/events')
    .set('Content-Type', 'text/plain')
    .set('User-Agent', ua)
    .send(JSON.stringify(body));

describe('POST /api/analytics/events', () => {
  beforeAll(async () => {
    await sequelize.sync({ alter: false });
  });

  afterEach(async () => {
    await Analytics.destroy({ where: {}, force: true });
    await Property.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('un page_view válido crea una fila con los campos esperados', async () => {
    const payload = validPayload({ path: '/nosotros', utmSource: 'instagram', utmMedium: 'social' });
    const res = await post(payload);
    expect(res.status).toBe(204);

    const rows = await Analytics.findAll({ where: { visitorId: payload.visitorId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].event).toBe('page_view');
    expect(rows[0].sessionId).toBe(payload.sessionId);
    expect(rows[0].path).toBe('/nosotros');
    expect(rows[0].utmSource).toBe('instagram');
    expect(rows[0].isBot).toBe(false);
    expect(rows[0].device).toBe('desktop');
    // Nunca persiste IP ni user-agent crudo para eventos nuevos (ver privacidad, Fase 1).
    expect(rows[0].ip).toBeNull();
    expect(rows[0].userAgent).toBeNull();
  });

  test('un property_view válido con propertyId incrementa Property.views', async () => {
    const property = await createProperty();
    const res = await post(validPayload({ event: 'property_view', propertyId: property.id, path: `/propiedades/${property.slug}` }));
    expect(res.status).toBe(204);

    await property.reload();
    expect(property.views).toBe(1);
  });

  test('rechaza un event fuera de la whitelist con 400', async () => {
    const res = await post(validPayload({ event: 'algo_inventado' }));
    expect(res.status).toBe(400);
    expect(await Analytics.count()).toBe(0);
  });

  test('rechaza visitorId ausente o mal formado con 400', async () => {
    const res1 = await post({ ...validPayload(), visitorId: undefined });
    expect(res1.status).toBe(400);

    const res2 = await post(validPayload({ visitorId: 'no-es-un-uuid' }));
    expect(res2.status).toBe(400);

    expect(await Analytics.count()).toBe(0);
  });

  test('rechaza sessionId mal formado con 400', async () => {
    const res = await post(validPayload({ sessionId: '12345' }));
    expect(res.status).toBe(400);
    expect(await Analytics.count()).toBe(0);
  });

  test('rechaza propertyId que no es un entero positivo con 400', async () => {
    const res = await post(validPayload({ propertyId: 'DROP TABLE properties' }));
    expect(res.status).toBe(400);
    expect(await Analytics.count()).toBe(0);
  });

  test('un propertyId inexistente no revienta el request (fire-and-forget)', async () => {
    const res = await post(validPayload({ event: 'property_view', propertyId: 999999999 }));
    expect(res.status).toBe(204);
    expect(await Analytics.count()).toBe(0);
  });

  test('rechaza un path más largo que el máximo permitido con 400', async () => {
    const res = await post(validPayload({ path: '/' + 'a'.repeat(400) }));
    expect(res.status).toBe(400);
    expect(await Analytics.count()).toBe(0);
  });

  test('rechaza un cuerpo que no es un objeto JSON válido con 400', async () => {
    const res = await request(app)
      .post('/api/analytics/events')
      .set('Content-Type', 'text/plain')
      .set('User-Agent', REAL_BROWSER_UA)
      .send('esto no es JSON');
    expect(res.status).toBe(400);
  });

  // Ajuste de producto (ver AUDITORIA de la Fase 1): page_view representa cada navegación
  // real de React Router — ya NO se deduplica. Antes, un visitante que volvía a una página
  // ya vista dentro de los 30 min (ej. catálogo → propiedad → catálogo → otra propiedad →
  // catálogo) solo contaba 1 vista del catálogo en vez de 3, lo cual no coincide con lo que
  // "Páginas vistas" debería significar. property_view sigue deduplicando — ver el describe
  // "property_view" más abajo.
  test('Caso 1 — 3 navegaciones reales del mismo visitante a la misma ruta generan 3 page_view, no 1', async () => {
    const payload = validPayload({ path: '/propiedades' });
    // Simula: /propiedades -> (abre una propiedad) -> /propiedades -> (abre otra) ->
    // /propiedades — cada regreso al catálogo es una navegación real de React Router.
    await post(payload);
    await post(payload);
    const res3 = await post(payload);
    expect(res3.status).toBe(204);

    expect(await Analytics.count({ where: { visitorId: payload.visitorId, event: 'page_view' } })).toBe(3);
  });

  describe('property_view sigue deduplicando (Caso 2 — refresh/StrictMode/reintentos no deben inflar el contador)', () => {
    test('vía POST /api/analytics/events', async () => {
      const property = await createProperty();
      const payload = validPayload({
        event: 'property_view',
        propertyId: property.id,
        path: `/propiedades/${property.id}`,
      });

      await post(payload);
      const res2 = await post(payload); // mismo visitorId/propertyId, "refresh" inmediato
      expect(res2.status).toBe(204);

      expect(
        await Analytics.count({ where: { visitorId: payload.visitorId, event: 'property_view' } })
      ).toBe(1);
      await property.reload();
      expect(property.views).toBe(1);
    });

    test('varios eventos dentro de la ventana de dedup a la misma propiedad siguen contando como 1', async () => {
      const property = await createProperty();
      const visitorId = uuid();
      const payload = validPayload({
        visitorId,
        event: 'property_view',
        propertyId: property.id,
        path: `/propiedades/${property.id}`,
      });

      // 5 intentos (refresh repetitivo, doble render, reintento de red) del mismo visitante
      // a la misma propiedad, todos dentro de la ventana de 30 min.
      for (let i = 0; i < 5; i++) {
        await post({ ...payload, sessionId: uuid() });
      }

      expect(
        await Analytics.count({ where: { visitorId, propertyId: property.id, event: 'property_view' } })
      ).toBe(1);
      await property.reload();
      expect(property.views).toBe(1);
    });
  });

  test('un User-Agent de bot conocido se marca isBot=true y no cuenta como page_view real', async () => {
    const payload = validPayload();
    const res = await post(payload, BOT_UA);
    expect(res.status).toBe(204);

    const row = await Analytics.findOne({ where: { visitorId: payload.visitorId } });
    expect(row.isBot).toBe(true);
  });

  test('un User-Agent de bot en property_view no incrementa Property.views', async () => {
    const property = await createProperty();
    await post(validPayload({ event: 'property_view', propertyId: property.id }), BOT_UA);

    await property.reload();
    expect(property.views).toBe(0);
  });

  test('rate limit: corta después de superar el máximo de eventos por visitante', async () => {
    const visitorId = uuid();
    const sessionId = uuid();
    let sawLimit = false;
    // max=120 por 5 min (ver analyticsLimiter) — cada evento usa una ruta distinta para no
    // chocar con la deduplicación y así probar el limiter en aislamiento.
    for (let i = 0; i < 125 && !sawLimit; i++) {
      const res = await post(validPayload({ visitorId, sessionId, path: `/ruta-${i}` }));
      if (res.status === 429) sawLimit = true;
    }
    expect(sawLimit).toBe(true);
  }, 30000);

  describe('trackView/trackShare (endpoints REST existentes, migrados al mismo servicio)', () => {
    test('POST /:id/view acepta visitorId/sessionId opcionales y deduplica property_view igual que /events', async () => {
      const property = await createProperty();
      const visitorId = uuid();

      await request(app)
        .post(`/api/properties/${property.id}/view`)
        .set('User-Agent', REAL_BROWSER_UA)
        .send({ visitorId, sessionId: uuid() });
      await request(app)
        .post(`/api/properties/${property.id}/view`)
        .set('User-Agent', REAL_BROWSER_UA)
        .send({ visitorId, sessionId: uuid() });

      await property.reload();
      expect(property.views).toBe(1);
      expect(await Analytics.count({ where: { propertyId: property.id, event: 'property_view' } })).toBe(1);
    });

    test('POST /:id/view sin ningún visitorId sigue funcionando (cliente viejo en caché)', async () => {
      const property = await createProperty();
      const res = await request(app)
        .post(`/api/properties/${property.id}/view`)
        .set('User-Agent', REAL_BROWSER_UA);
      expect(res.status).toBe(204);

      await property.reload();
      expect(property.views).toBe(1);
    });

    test('POST /:id/share nunca deduplica — cada clic cuenta', async () => {
      const property = await createProperty();
      const visitorId = uuid();

      for (let i = 0; i < 3; i++) {
        await request(app)
          .post(`/api/properties/${property.id}/share`)
          .set('User-Agent', REAL_BROWSER_UA)
          .send({ visitorId, sessionId: uuid() });
      }

      expect(await Analytics.count({ where: { propertyId: property.id, event: 'property_share' } })).toBe(3);
    });
  });
});
