// BUG real: POST /api/export/catalog/pdf hacía `Lead.create` sin comprobar duplicados.
// `leads.phoneNormalized` tiene un índice único (migración 20260901000000) — si quien pedía
// el catálogo ya era un prospecto conocido (por cualquier canal, no solo una descarga previa
// del catálogo), el INSERT chocaba con SequelizeUniqueConstraintError, que no es un ApiError,
// así que exportHelpers.handleExportError lo devolvía como un 500 genérico y el PDF nunca se
// generaba. Estos tests verifican que ahora se reutiliza el prospecto existente (mismo
// patrón findDuplicatePhoneLead/isDuplicatePhoneConstraintError que leadController, ver
// utils/leadDuplicates.js) en vez de fallar, sin duplicar la fila ni pisar datos que ya
// gestiona el CRM, y que la descarga del PDF continúa con normalidad.
const request = require('supertest');
const { Op } = require('sequelize');
const app = require('../../app');
const { sequelize, Lead, Activity } = require('../models/index');
const { normalizePhone } = require('../utils/validators');

function binaryParser(res, callback) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => callback(null, Buffer.from(data, 'binary')));
}
const binary = (req) => req.buffer(true).parse(binaryParser);

const uniquePhone = () => `6${Date.now().toString().slice(-9)}`;

describe('POST /api/export/catalog/pdf — prospecto duplicado por teléfono', () => {
  beforeAll(async () => {
    await sequelize.sync({ alter: false });
  });

  afterEach(async () => {
    await Lead.destroy({ where: { name: { [Op.like]: 'Catálogo Dup%' } }, force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('reutiliza el prospecto existente en vez de fallar, y el PDF se entrega igual', async () => {
    const phone = uniquePhone();

    const existing = await Lead.create({
      name: 'Catálogo Dup Original',
      phone,
      type: 'contacto',
      source: 'whatsapp',
      pipelineStage: 'interesado',
    });

    const res = await binary(request(app).post('/api/export/catalog/pdf')).send({
      name: 'Catálogo Dup Original',
      phone, // mismo número exacto
      interest: 'comprar_propiedad',
    });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');

    const leads = await Lead.findAll({ where: { phoneNormalized: existing.phoneNormalized } });
    expect(leads).toHaveLength(1);
    expect(leads[0].id).toBe(existing.id);
    // No se pisan campos que ya gestiona el CRM.
    expect(leads[0].pipelineStage).toBe('interesado');
    expect(leads[0].source).toBe('whatsapp');

    const activity = await Activity.findOne({ where: { leadId: existing.id, type: 'sistema' } });
    expect(activity).not.toBeNull();
    expect(activity.content).toMatch(/volvió a descargar/i);
  });

  test('detecta el duplicado aunque el teléfono venga en formato distinto (+52/guiones)', async () => {
    const phone = uniquePhone();
    const existing = await Lead.create({ name: 'Catálogo Dup Formato', phone });

    const res = await binary(request(app).post('/api/export/catalog/pdf')).send({
      name: 'Catálogo Dup Formato',
      phone: `+52 ${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`,
      interest: 'comprar_propiedad',
    });

    expect(res.status).toBe(200);
    const leads = await Lead.findAll({ where: { phoneNormalized: existing.phoneNormalized } });
    expect(leads).toHaveLength(1);
  });

  test('completa el email si el prospecto existente no tenía uno, sin pisar uno ya guardado', async () => {
    const phone = uniquePhone();
    const existing = await Lead.create({ name: 'Catálogo Dup Email', phone, email: null });

    await binary(request(app).post('/api/export/catalog/pdf')).send({
      name: 'Catálogo Dup Email',
      phone,
      email: 'nuevo@triomphe.test',
      interest: 'comprar_propiedad',
    });

    await existing.reload();
    expect(existing.email).toBe('nuevo@triomphe.test');

    await binary(request(app).post('/api/export/catalog/pdf')).send({
      name: 'Catálogo Dup Email',
      phone,
      email: 'otro-distinto@triomphe.test',
      interest: 'comprar_propiedad',
    });

    await existing.reload();
    expect(existing.email).toBe('nuevo@triomphe.test'); // no se sobrescribe
  });

  test('concurrencia: dos descargas simultáneas con el mismo teléfono nuevo — ambas responden 200 y solo se crea un prospecto', async () => {
    const phone = uniquePhone();

    const [resA, resB] = await Promise.all([
      binary(request(app).post('/api/export/catalog/pdf')).send({
        name: 'Catálogo Dup Concurrente A',
        phone,
        interest: 'comprar_propiedad',
      }),
      binary(request(app).post('/api/export/catalog/pdf')).send({
        name: 'Catálogo Dup Concurrente B',
        phone,
        interest: 'rentar_propiedad',
      }),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.headers['content-type']).toContain('application/pdf');
    expect(resB.headers['content-type']).toContain('application/pdf');

    const leads = await Lead.findAll({ where: { phoneNormalized: normalizePhone(phone) } });
    expect(leads).toHaveLength(1);
  });
});
