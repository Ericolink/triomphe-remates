// Cubre el requisito crítico del toggle publicPropertiesEnabled: cuando está en false, las
// APIs públicas de propiedades no deben entregar datos, sin importar cómo se les llame
// (listado, detalle, slug, stats, promoted, sync) — y el staff autenticado nunca debe verse
// afectado (ver propertyController.js). exportCatalogPDF se prueba aparte para confirmar que
// se rige únicamente por inventoryDownloadEnabled, no por este flag (independencia a
// propósito, ver routes/settings.js).
const request = require('supertest');
const app = require('../../app');
const { sequelize, Setting, Property, Lead } = require('../models/index');
const { createUser, authToken, createProperty } = require('./helpers/factories');
const { PUBLIC_PROPERTIES_ENABLED_KEY } = require('../services/settingsService');

// supertest necesita un parser binario explícito para leer el PDF crudo del test de
// independencia con exportCatalogPDF — mismo helper que catalogDownloadToggle.integration.test.js.
function binaryParser(res, callback) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => callback(null, Buffer.from(data, 'binary')));
}
const binary = (req) => req.buffer(true).parse(binaryParser);
const CATALOG_LEAD_NAME_TAG = 'Public Properties Toggle Test';
const uniquePhone = () => `6${Date.now().toString().slice(-9)}`;
let slugCounter = 0;
const uniqueSlug = () => `public-properties-toggle-test-${Date.now()}-${++slugCounter}`;

describe('publicPropertiesEnabled — bloqueo de APIs públicas de propiedades', () => {
  let admin, adminToken;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    adminToken = authToken(admin);
  });

  afterEach(async () => {
    await Setting.upsert({ key: PUBLIC_PROPERTIES_ENABLED_KEY, value: JSON.stringify(true) });
    await Property.destroy({ where: {}, force: true });
    await Lead.destroy({ where: { name: CATALOG_LEAD_NAME_TAG }, force: true });
  });

  afterAll(async () => {
    await admin.destroy({ force: true });
    await sequelize.close();
  });

  const setPublicProperties = (enabled) =>
    request(app)
      .put('/api/settings/public-properties')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ enabled });

  describe('ON (default) — comportamiento actual intacto', () => {
    test('listado público devuelve las propiedades disponibles', async () => {
      const property = await createProperty({ status: 'disponible' });

      const res = await request(app).get('/api/properties');
      expect(res.status).toBe(200);
      expect(res.body.data.some((p) => p.id === property.id)).toBe(true);
      expect(res.body.propertiesAvailable).toBeUndefined();
    });

    test('detalle público por slug funciona normalmente', async () => {
      const property = await createProperty({ status: 'disponible', slug: uniqueSlug() });

      const res = await request(app).get(`/api/properties/slug/${property.slug}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(property.id);
    });
  });

  describe('OFF — bloqueo del listado y búsqueda', () => {
    test('GET /api/properties sin auth: no entrega propiedades, responde propertiesAvailable:false', async () => {
      await createProperty({ status: 'disponible' });
      await setPublicProperties(false);

      const res = await request(app).get('/api/properties');
      expect(res.status).toBe(200);
      expect(res.body.propertiesAvailable).toBe(false);
      expect(res.body.data).toEqual([]);
      expect(typeof res.body.message).toBe('string');
    });

    test('GET /api/properties con filtros/búsqueda igual queda bloqueado (no hay bypass por query params)', async () => {
      await createProperty({ status: 'disponible', title: 'Casa especial' });
      await setPublicProperties(false);

      const res = await request(app)
        .get('/api/properties')
        .query({ search: 'especial', city: 'juarez', page: 1, limit: 50 });
      expect(res.status).toBe(200);
      expect(res.body.propertiesAvailable).toBe(false);
      expect(res.body.data).toEqual([]);
    });

    test('GET /api/properties/stats no expone conteos reales', async () => {
      await createProperty({ status: 'disponible' });
      await setPublicProperties(false);

      const res = await request(app).get('/api/properties/stats');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.propertiesAvailable).toBe(false);
    });

    test('GET /api/properties/promoted no expone la propiedad promovida', async () => {
      await createProperty({ status: 'disponible', isPromoted: true });
      await setPublicProperties(false);

      const res = await request(app).get('/api/properties/promoted');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    test('GET /api/properties/sync (usado por favoritos/comparador) no revela precio/status', async () => {
      const property = await createProperty({ status: 'disponible' });
      await setPublicProperties(false);

      const res = await request(app).get('/api/properties/sync').query({ ids: String(property.id) });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('OFF — bloqueo del detalle público (bypass por URL directa)', () => {
    test('GET /api/properties/:id conocido responde 404, no la propiedad', async () => {
      const property = await createProperty({ status: 'disponible' });
      await setPublicProperties(false);

      const res = await request(app).get(`/api/properties/${property.id}`);
      expect(res.status).toBe(404);
      expect(res.body.data).toBeUndefined();
    });

    test('GET /api/properties/slug/:slug conocido responde 404, no la propiedad', async () => {
      const property = await createProperty({ status: 'disponible', slug: uniqueSlug() });
      await setPublicProperties(false);

      const res = await request(app).get(`/api/properties/slug/${property.slug}`);
      expect(res.status).toBe(404);
      expect(res.body.data).toBeUndefined();
    });
  });

  describe('OFF — bypass con curl/Postman directo, sin token', () => {
    test('un cliente sin JWT no puede saltarse el bloqueo llamando directo al endpoint', async () => {
      await createProperty({ status: 'disponible' });
      await setPublicProperties(false);

      const res = await request(app).get('/api/properties').set('User-Agent', 'curl/8.0.0');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('OFF — el staff autenticado sigue viendo todo con normalidad', () => {
    test('admin autenticado sigue viendo el listado completo aunque el público esté bloqueado', async () => {
      const property = await createProperty({ status: 'disponible' });
      await setPublicProperties(false);

      const res = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.propertiesAvailable).toBeUndefined();
      expect(res.body.data.some((p) => p.id === property.id)).toBe(true);
    });

    test('admin autenticado sigue pudiendo abrir el detalle por id (panel de edición)', async () => {
      const property = await createProperty({ status: 'disponible' });
      await setPublicProperties(false);

      const res = await request(app)
        .get(`/api/properties/${property.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(property.id);
    });
  });

  describe('restauración ON → OFF → ON', () => {
    test('las propiedades reaparecen automáticamente al reactivar, sin tocar la propiedad', async () => {
      const property = await createProperty({ status: 'disponible' });

      // ON inicial
      let res = await request(app).get('/api/properties');
      expect(res.body.data.some((p) => p.id === property.id)).toBe(true);

      // OFF
      await setPublicProperties(false);
      res = await request(app).get('/api/properties');
      expect(res.body.propertiesAvailable).toBe(false);

      // ON de nuevo — sin modificar la propiedad en absoluto
      await setPublicProperties(true);
      res = await request(app).get('/api/properties');
      expect(res.body.propertiesAvailable).toBeUndefined();
      expect(res.body.data.some((p) => p.id === property.id)).toBe(true);

      await property.reload();
      expect(property.status).toBe('disponible');
    });
  });

  describe('independencia de inventoryDownloadEnabled (no deben mezclarse)', () => {
    test('publicPropertiesEnabled=false no bloquea el catálogo PDF (exportCatalogPDF se rige solo por inventoryDownloadEnabled)', async () => {
      await createProperty({ status: 'disponible' });
      await setPublicProperties(false);

      const res = await binary(request(app).post('/api/export/catalog/pdf')).send({
        name: CATALOG_LEAD_NAME_TAG,
        phone: uniquePhone(),
        interest: 'comprar_propiedad',
      });

      // No debe caer al camino "downloadAvailable:false" causado por publicPropertiesEnabled
      // — el PDF binario se entrega normalmente (inventoryDownloadEnabled sigue en su
      // default true).
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
    });
  });

  describe('sitemap.xml', () => {
    test('OFF: no lista URLs de propiedades individuales, pero sí las páginas estáticas', async () => {
      const property = await createProperty({ status: 'disponible', slug: uniqueSlug() });
      await setPublicProperties(false);

      const res = await request(app).get('/sitemap.xml');
      expect(res.status).toBe(200);
      expect(res.text).toContain('/propiedades</loc>');
      expect(res.text).not.toContain(`/propiedades/${property.slug}`);
    });

    test('ON: sí lista las propiedades disponibles', async () => {
      const property = await createProperty({ status: 'disponible', slug: uniqueSlug() });

      const res = await request(app).get('/sitemap.xml');
      expect(res.status).toBe(200);
      expect(res.text).toContain(`/propiedades/${property.slug}`);
    });
  });
});
