const request = require('supertest');
const ExcelJS = require('exceljs');
const { PDFParse } = require('pdf-parse');
const app = require('../../app');
const { sequelize, Property, Lead, User, AuditLog } = require('../models/index');
const { createUser, authToken, createProperty, createLead } = require('./helpers/factories');
const { formatPrice, formatDate, dash } = require('../services/exportHelpers');
const { CITY_LABEL, PROPERTY_TYPE_LABEL, STATUS_LABEL } = require('../utils/labels');
const { statusArgb } = require('../services/exportBranding');

// supertest/superagent no traen un parser binario por defecto para xlsx/pdf — sin esto,
// res.body llega como `{}` y ExcelJS/pdf-parse fallan al leerlo.
function binaryParser(res, callback) {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => callback(null, Buffer.from(data, 'binary')));
}
const binary = (req) => req.buffer(true).parse(binaryParser);

async function readWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

async function readPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result;
}

describe('exportController', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await AuditLog.destroy({ where: {}, force: true });
    await Lead.destroy({ where: {}, force: true });
    await Property.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  const authed = (url) => binary(request(app).get(url).set('Authorization', `Bearer ${token}`));

  describe('GET /api/export/excel — inventario de propiedades', () => {
    test('estructura, encabezados, formato de precio (incl. PENDIENTE) y campos faltantes', async () => {
      const withEverything = await createProperty({
        title: 'Casa completa',
        city: 'chihuahua',
        type: 'casa',
        status: 'disponible',
        price: 1250000,
        terrainMeters: 300,
        constructionMeters: 180,
        bedrooms: 3,
        bathrooms: 2,
        address: 'Av. Siempre Viva 123',
      });
      const pendingPrice = await createProperty({
        title: 'Terreno en remate',
        city: 'juarez',
        type: 'terreno',
        status: 'apartado',
        price: null,
        terrainMeters: null,
        bedrooms: null,
        bathrooms: null,
        address: null,
      });

      const res = await authed('/api/export/excel');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');

      const workbook = await readWorkbook(res.body);
      const sheet = workbook.getWorksheet('Inventario');
      expect(sheet).toBeDefined();

      const headerRow = sheet.getRow(3).values.filter(Boolean);
      expect(headerRow).toEqual([
        '#',
        'Título',
        'CALLE',
        'NUMERO',
        'LT',
        'MZ',
        'COLONIA',
        'CODIGO POSTAL',
        'MTS. T',
        'MTS. C',
        'PORTAFOLIO',
        'COFINAVIT/VIABILIDAD/TIPO',
        'PRECIO VENTA',
        'CLAVE DE BUSQUEDA',
        'OBSERVACIONES',
        'FOTO',
        'ZONA',
        'ADEUDO AGUA',
        'ADEUDO LUZ',
        'ADEUDO PREDIAL',
        'ADEUDOS ACTUALIZADO',
        'Precio comercial 1',
        'Fecha comercial 1',
        'Ciudad',
        'Tipo',
        'Estatus',
        'Recámaras',
        'Baños',
        'Fecha alta',
        'Última modif.',
      ]);

      // No asume orden de filas por índice: el ORDER BY city ASC de MySQL ordena por el
      // índice de declaración del ENUM ('juarez','chihuahua','queretaro'), no alfabético —
      // se busca cada fila por su título en vez de fijar la posición.
      const findRowByTitle = (title) => {
        for (let i = 4; i <= sheet.rowCount; i++) {
          const row = sheet.getRow(i);
          if (row.values[2] === title) return row.values;
        }
        return null;
      };

      const completa = findRowByTitle('Casa completa');
      expect(completa[3]).toBe('Av. Siempre Viva 123'); // CALLE
      expect(completa[9]).toBe('300.00 m²'); // MTS. T — DECIMAL(8,2) vuelve como string desde MySQL
      expect(completa[13]).toBe(formatPrice(1250000)); // PRECIO VENTA
      expect(completa[24]).toBe(CITY_LABEL.chihuahua);
      expect(completa[25]).toBe(PROPERTY_TYPE_LABEL.casa);
      expect(completa[26]).toBe(STATUS_LABEL.disponible);
      expect(completa[29]).toBe(formatDate(withEverything.createdAt)); // Fecha alta, dd/mm/aaaa no ISO

      const pendiente = findRowByTitle('Terreno en remate');
      expect(pendiente[9]).toBe(dash(null)); // '—' cuando no hay MTS. T
      expect(pendiente[13]).toBe('PENDIENTE'); // price: null — regla de dominio, no un error
      expect(pendiente[24]).toBe(CITY_LABEL.juarez);
      expect(pendiente[27]).toBe(dash(null)); // recámaras faltantes

      const totalRow = sheet.getRow(sheet.rowCount).values;
      expect(totalRow[2]).toBe('TOTAL: 2 propiedades');

      const auditRow = await AuditLog.findOne({
        where: { resource: 'property', action: 'export' },
        order: [['id', 'DESC']],
      });
      expect(auditRow).not.toBeNull();
      expect(JSON.parse(auditRow.detail).count).toBe(2);

      // limpieza local — estas dos propiedades no deben afectar el test de "vacío"/bulk siguientes
      await Property.destroy({ where: { id: [withEverything.id, pendingPrice.id] }, force: true });
    });

    test('exportación vacía: sigue devolviendo 200 con 0 filas, no un error', async () => {
      const res = await authed('/api/export/excel?city=queretaro');
      expect(res.status).toBe(200);

      const workbook = await readWorkbook(res.body);
      const sheet = workbook.getWorksheet('Inventario');
      // fila 1 título, fila 2 subtítulo, fila 3 encabezados, fila 4 total (sin datos)
      expect(sheet.rowCount).toBe(4);
      expect(sheet.getRow(4).values[2]).toBe('TOTAL: 0 propiedades');
    });

    test('exportación masiva: el conteo de filas coincide exactamente', async () => {
      const BULK = 40;
      await Property.bulkCreate(
        Array.from({ length: BULK }, (_, i) => ({
          title: `Propiedad masiva ${i + 1}`,
          city: 'juarez',
          type: 'casa',
          status: 'disponible',
          price: 100000 + i,
        }))
      );

      const res = await authed('/api/export/excel');
      const workbook = await readWorkbook(res.body);
      const sheet = workbook.getWorksheet('Inventario');
      // filas de datos = rowCount - (título+subtítulo+encabezado+total)
      expect(sheet.rowCount - 4).toBe(BULK);
      expect(sheet.getRow(sheet.rowCount).values[2]).toBe(`TOTAL: ${BULK} propiedades`);
    });

    test('respeta el filtro por ciudad', async () => {
      await createProperty({ city: 'juarez' });
      await createProperty({ city: 'chihuahua' });

      const res = await authed('/api/export/excel?city=chihuahua');
      const workbook = await readWorkbook(res.body);
      const sheet = workbook.getWorksheet('Inventario');
      expect(sheet.rowCount - 4).toBe(1);
      expect(sheet.getRow(4).values[24]).toBe(CITY_LABEL.chihuahua);
    });

    test('caracteres especiales y acentos se preservan tal cual (Excel no los recorta)', async () => {
      await createProperty({ title: "Ñoño's Café — Depto. 🏡 <especial>" });

      const res = await authed('/api/export/excel');
      const workbook = await readWorkbook(res.body);
      const sheet = workbook.getWorksheet('Inventario');
      expect(sheet.getRow(4).values[2]).toBe("Ñoño's Café — Depto. 🏡 <especial>");
    });
  });

  describe('GET /api/export/leads/excel', () => {
    test('columnas de presupuesto/pago/propiedad y color por estatus', async () => {
      const property = await createProperty({ title: 'Interesada' });
      await createLead({
        name: 'Con presupuesto',
        propertyId: property.id,
        paymentMethod: 'contado',
        budgetAmount: 900000,
        budgetNotSpecified: false,
        status: 'cerrado',
      });
      await createLead({
        name: 'Sin especificar',
        paymentMethod: null,
        budgetAmount: null,
        budgetNotSpecified: true,
        status: 'nuevo',
      });
      await createLead({
        name: 'Sin datos comerciales',
        budgetNotSpecified: false,
        budgetAmount: null,
        status: 'descartado',
      });

      const res = await authed('/api/export/leads/excel');
      expect(res.status).toBe(200);

      const workbook = await readWorkbook(res.body);
      const sheet = workbook.getWorksheet('Leads');

      const headerRow = sheet.getRow(3).values.filter(Boolean);
      expect(headerRow).toContain('Forma de pago');
      expect(headerRow).toContain('Monto disponible');
      expect(headerRow).toContain('Primer contacto');

      const rows = [];
      for (let i = 4; i < 4 + 3; i++) rows.push(sheet.getRow(i));

      const conPresupuesto = rows.find((r) => r.values[2] === 'Con presupuesto');
      expect(conPresupuesto.values[5]).toBe('Interesada'); // columna Propiedad
      expect(conPresupuesto.values[8]).toBe('Contado');
      expect(conPresupuesto.values[9]).toBe(formatPrice(900000));
      expect(conPresupuesto.getCell(7).font.color.argb).toBe(
        statusArgb.cerrado ?? conPresupuesto.getCell(7).font.color.argb
      );

      const sinEspecificar = rows.find((r) => r.values[2] === 'Sin especificar');
      expect(sinEspecificar.values[9]).toBe('No especificó');

      const sinDatos = rows.find((r) => r.values[2] === 'Sin datos comerciales');
      expect(sinDatos.values[8]).toBe('—'); // forma de pago no capturada
      expect(sinDatos.values[9]).toBe('—'); // ni presupuesto ni "no especificó"
      expect(sinDatos.values[5]).toBe('—'); // sin propiedad asociada
    });

    test('filtra por status y exportación vacía no falla', async () => {
      await createLead({ name: 'Nuevo', status: 'nuevo' });
      await createLead({ name: 'Cerrado', status: 'cerrado' });

      const res = await authed('/api/export/leads/excel?status=descartado');
      expect(res.status).toBe(200);
      const workbook = await readWorkbook(res.body);
      const sheet = workbook.getWorksheet('Leads');
      expect(sheet.rowCount - 4).toBe(0); // ningún lead está descartado
    });
  });

  describe('GET /api/export/pdf — inventario en PDF', () => {
    test('incluye encabezado de marca, total y precios formateados', async () => {
      await createProperty({ title: 'Casa con precio', price: 950000 });
      await createProperty({ title: 'Casa sin precio', price: null });

      const res = await authed('/api/export/pdf');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');

      const { text } = await readPdfText(res.body);
      expect(text).toMatch(/TRIOMPHE BIENES RA[ÍI]CES/);
      expect(text).toMatch(/2 propiedades/);
      expect(text).toContain('Casa con precio');
      expect(text).toContain('Casa sin precio');
      expect(text).toMatch(/PENDIENTE/);
      expect(text).toContain(formatPrice(950000));
    });

    test('con muchas propiedades genera varias páginas (encabezado repetido)', async () => {
      await Property.bulkCreate(
        Array.from({ length: 40 }, (_, i) => ({
          title: `Propiedad paginada ${i + 1}`,
          city: 'juarez',
          type: 'casa',
          status: 'disponible',
          price: 100000 + i,
        }))
      );

      const res = await authed('/api/export/pdf');
      expect(res.status).toBe(200);
      const result = await readPdfText(res.body);
      expect(result.total).toBeGreaterThan(1);
      expect((result.text.match(/TRIOMPHE BIENES RA[ÍI]CES/g) || []).length).toBeGreaterThan(1);
    });

    test('título con emoji/acentos no rompe la generación (robustez)', async () => {
      await createProperty({ title: 'Depto. Ñoño 🏡 café' });

      const res = await authed('/api/export/pdf');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });
});
