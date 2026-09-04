const request = require('supertest');
const app = require('../../app');
const { sequelize, Lead, Activity, Setting } = require('../models/index');
const { setSetting, INVENTORY_DOWNLOAD_ENABLED_KEY } = require('../services/settingsService');

// supertest necesita un parser binario explícito para leer el PDF crudo — mismo helper
// que export.integration.test.js.
function binaryParser(res, callback) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => callback(null, Buffer.from(data, 'binary')));
}
const binary = (req) => req.buffer(true).parse(binaryParser);

const NAME_TAG = 'Catálogo Toggle Test';
const uniquePhone = () => `6${Date.now().toString().slice(-9)}`;

async function findLeadByPhone(phone) {
  return Lead.findOne({ where: { phone } });
}

describe('POST /api/export/catalog/pdf — toggle inventoryDownloadEnabled', () => {
  beforeAll(async () => {
    await sequelize.sync({ alter: false });
  });

  afterEach(async () => {
    await Lead.destroy({ where: { name: NAME_TAG }, force: true });
    await setSetting(INVENTORY_DOWNLOAD_ENABLED_KEY, true);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  const basePayload = () => ({
    name: NAME_TAG,
    phone: uniquePhone(),
    email: 'toggle-test@triomphe.test',
    interest: 'comprar_propiedad',
  });

  describe('descarga ACTIVADA (comportamiento actual)', () => {
    beforeEach(async () => {
      await setSetting(INVENTORY_DOWNLOAD_ENABLED_KEY, true);
    });

    test('crea el prospecto y entrega el PDF en la misma respuesta', async () => {
      const payload = basePayload();
      const res = await binary(request(app).post('/api/export/catalog/pdf')).send(payload);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.body.length).toBeGreaterThan(0);

      const lead = await findLeadByPhone(payload.phone);
      expect(lead).not.toBeNull();
      expect(lead.message).toMatch(/Descargó/i);

      const activity = await Activity.findOne({ where: { leadId: lead.id, type: 'sistema' } });
      expect(activity).not.toBeNull();
      expect(activity.content).toMatch(/descargó/i);
    });
  });

  describe('descarga DESACTIVADA', () => {
    beforeEach(async () => {
      await setSetting(INVENTORY_DOWNLOAD_ENABLED_KEY, false);
    });

    test('crea el prospecto pero NO entrega el PDF — responde JSON de confirmación', async () => {
      const payload = basePayload();
      const res = await request(app).post('/api/export/catalog/pdf').send(payload);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.headers['content-type']).not.toContain('application/pdf');
      expect(res.body.downloadAvailable).toBe(false);
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message.length).toBeGreaterThan(0);
    });

    test('el prospecto queda registrado correctamente en el CRM, distinguible de una descarga', async () => {
      const payload = basePayload();
      await request(app).post('/api/export/catalog/pdf').send(payload);

      const lead = await findLeadByPhone(payload.phone);
      expect(lead).not.toBeNull();
      expect(lead.name).toBe(NAME_TAG);
      expect(lead.type).toBe('comprar_propiedad');
      expect(lead.message).toMatch(/Solicitó/i);
      expect(lead.message).not.toMatch(/Descargó/i);

      const activity = await Activity.findOne({ where: { leadId: lead.id, type: 'sistema' } });
      expect(activity).not.toBeNull();
      expect(activity.content).toMatch(/solicitó/i);
    });

    test('sigue validando los datos del formulario igual que con la descarga activada', async () => {
      const res = await request(app)
        .post('/api/export/catalog/pdf')
        .send({ ...basePayload(), phone: '123' });

      expect(res.status).toBe(400);
      const lead = await Lead.findOne({ where: { name: NAME_TAG, phone: '123' } });
      expect(lead).toBeNull();
    });
  });

  describe('cambio dinámico del flag', () => {
    test('activar → funciona, desactivar → bloqueada, reactivar → funciona de nuevo', async () => {
      await setSetting(INVENTORY_DOWNLOAD_ENABLED_KEY, true);
      const p1 = basePayload();
      const r1 = await binary(request(app).post('/api/export/catalog/pdf')).send(p1);
      expect(r1.headers['content-type']).toContain('application/pdf');

      await setSetting(INVENTORY_DOWNLOAD_ENABLED_KEY, false);
      const p2 = basePayload();
      const r2 = await request(app).post('/api/export/catalog/pdf').send(p2);
      expect(r2.headers['content-type']).toContain('application/json');
      expect(r2.body.downloadAvailable).toBe(false);

      await setSetting(INVENTORY_DOWNLOAD_ENABLED_KEY, true);
      const p3 = basePayload();
      const r3 = await binary(request(app).post('/api/export/catalog/pdf')).send(p3);
      expect(r3.headers['content-type']).toContain('application/pdf');
    });
  });

  describe('sin fila de configuración sembrada', () => {
    test('el default es "activado" — no rompe el flujo existente si la fila no existe', async () => {
      await Setting.destroy({ where: { key: INVENTORY_DOWNLOAD_ENABLED_KEY }, force: true });

      const payload = basePayload();
      const res = await binary(request(app).post('/api/export/catalog/pdf')).send(payload);
      expect(res.headers['content-type']).toContain('application/pdf');
    });
  });
});
