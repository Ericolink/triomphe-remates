// AUDITORIA Fase 1 — regresión encontrada en la auditoría post-implementación: la migración
// 20260903000002 renombró los eventos 'view'/'share' a 'property_view'/'property_share',
// pero GET /api/analytics/dashboard y GET /api/analytics/properties/:id (endpoints
// PRE-EXISTENTES, no tocados durante la implementación de Fase 1) seguían filtrando por los
// nombres viejos — así que "Vistas del sitio (30 días)", "Vistas por semana" en el dashboard
// de negocio, y "views"/"shares"/"contacts" en la ficha de analítica de una propiedad
// (PropertyFormPage.jsx) quedaron silenciosamente en cero desde el día del deploy de Fase 1.
// Confirmado contra datos reales de triomphe_db antes de corregir (ver AUDITORIA).
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
} = require('./helpers/factories');
const { mexicoMidnightUtc, mexicoDateKey } = require('../utils/mexicoTime');

// Un solo beforeAll/afterAll para todo el archivo (no uno por describe): `sequelize` es un
// singleton compartido — un segundo `sequelize.close()` en otro describe del mismo archivo
// revienta cualquier query posterior con "ConnectionManager ... called after the connection
// manager was closed!" (mismo patrón de un solo cierre usado en el resto de este repo).
describe('Regresión de nombres de evento (Fase 1) en los endpoints de analítica pre-existentes', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await Analytics.destroy({ where: {}, force: true });
    await Lead.destroy({ where: {}, force: true });
    await Property.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  describe('GET /api/analytics/dashboard', () => {
    test('views.last30Days cuenta property_view, no el nombre viejo "view"', async () => {
      await createAnalyticsEvent({ event: 'property_view', isBot: false });
      await createAnalyticsEvent({ event: 'property_view', isBot: false });

      const res = await request(app).get('/api/analytics/dashboard').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.views.last30Days).toBe(2);
    });

    test('viewsOverTime incluye los property_view recientes agrupados por semana', async () => {
      await createAnalyticsEvent({ event: 'property_view', isBot: false, createdAt: new Date() });

      const res = await request(app).get('/api/analytics/dashboard').set('Authorization', `Bearer ${token}`);
      const totalInSeries = res.body.data.viewsOverTime.reduce((sum, w) => sum + w.count, 0);
      expect(totalInSeries).toBe(1);
    });

    test('topProperties sigue viniendo de Property.views (contador de conveniencia), no se rompió', async () => {
      await createProperty({ title: 'Con vistas', views: 10 });
      const res = await request(app).get('/api/analytics/dashboard').set('Authorization', `Bearer ${token}`);
      expect(res.body.data.topProperties[0].views).toBe(10);
    });
  });

  describe('GET /api/analytics/properties/:id', () => {
    test('totals.views/shares cuentan property_view/property_share, no "view"/"share"', async () => {
      const property = await createProperty();
      await createAnalyticsEvent({ event: 'property_view', propertyId: property.id, isBot: false });
      await createAnalyticsEvent({ event: 'property_view', propertyId: property.id, isBot: false });
      await createAnalyticsEvent({ event: 'property_share', propertyId: property.id, isBot: false });

      const res = await request(app)
        .get(`/api/analytics/properties/${property.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totals.views).toBe(2);
      expect(res.body.data.totals.shares).toBe(1);
    });

    test('totals.contacts usa Lead/LeadProperty reales, no el evento legacy "contact" (nunca escrito por código nuevo)', async () => {
      const property = await createProperty();
      const otherProperty = await createProperty();
      await createLead({ propertyId: property.id }); // contacto directo
      const leadViaInterest = await createLead({ propertyId: otherProperty.id });
      await createLeadProperty({ leadId: leadViaInterest.id, propertyId: property.id }); // propiedad de interés adicional

      const res = await request(app)
        .get(`/api/analytics/properties/${property.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.data.totals.contacts).toBe(2);
    });

    test('viewsByDay agrupa por día de México, no por DATE(createdAt) en UTC de MySQL', async () => {
      const property = await createProperty();
      // 23:30 hora México de AYER, construido en relación a "ahora" (no una fecha fija) para
      // que el test siga siendo válido sin importar cuándo se corra: mexicoMidnightUtc(0) es
      // la medianoche de México de HOY; restarle 30 min cae exactamente a las 23:30 de AYER
      // en México, que en UTC ya es "hoy" (05:30 UTC) — el caso exacto que DATE(createdAt)
      // de MySQL bucketearía mal.
      const lastNightMexico = new Date(mexicoMidnightUtc(0).getTime() - 30 * 60 * 1000);
      const expectedKey = mexicoDateKey(lastNightMexico);
      await createAnalyticsEvent({
        event: 'property_view',
        propertyId: property.id,
        isBot: false,
        createdAt: lastNightMexico,
      });

      const res = await request(app)
        .get(`/api/analytics/properties/${property.id}`)
        .set('Authorization', `Bearer ${token}`);

      const entry = res.body.data.viewsByDay.find((d) => d.views === 1);
      expect(entry).toBeDefined();
      expect(entry.date).toBe(expectedKey);
    });
  });
});
