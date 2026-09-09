// Issue "PDF y Excel deben respetar los filtros activos de propiedades": GET /api/properties
// (listado) y GET /api/export/excel|pdf (admin) ahora comparten el mismo `where` vía
// buildPropertyWhereClause (services/propertyFilters.js), y el catálogo público
// (POST /api/export/catalog/pdf) lo reutiliza forzando status='disponible'. Estas pruebas
// demuestran que, para un mismo conjunto de filtros, el listado y las exportaciones
// devuelven exactamente el mismo conjunto de propiedades — nunca solo la página visible — y
// que "Estatus" no forma parte de ningún documento de propiedades mientras "Estado" (campo
// distinto, Property.state) sí sigue presente.
const request = require('supertest');
const ExcelJS = require('exceljs');
const { PDFParse } = require('pdf-parse');
const app = require('../../app');
const { sequelize, Property, Lead, User } = require('../models/index');
const { createUser, authToken, createProperty } = require('./helpers/factories');

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
  return result.text;
}

// pdfkit envuelve texto más ancho que su columna a una 2ª línea real dentro de la celda (ver
// comentario sobre PDF_CELL_TEXT_HEIGHT en exportController.js) — un código como "PDF-MATCH"
// puede salir como "PDF-\nMATCH" en columnas angostas. Sin espacios, la búsqueda es
// insensible a en qué línea cae cada palabra.
const flatten = (text) => text.replace(/\s+/g, '');
const pdfContains = (text, needle) => flatten(text).includes(flatten(needle));

const CLAVE_COL = 20; // ver export.integration.test.js — "20 = Clave"

describe('Exportación de propiedades respeta los mismos filtros que el listado', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await Property.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    // No cierra `sequelize` aquí — es el mismo singleton compartido por el segundo describe
    // de este archivo (catálogo público), que corre después y lo cierra al final.
    await User.destroy({ where: { id: admin.id }, force: true });
  });

  // Todas las propiedades de este archivo llevan `code` único — permite identificar qué
  // filas trajo cada exportación sin depender del orden.
  const listingCodes = async (query = {}) => {
    const res = await request(app)
      .get('/api/properties')
      .query({ ...query, limit: 100 })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body.data.map((p) => p.code).sort();
  };

  const excelCodes = async (query = {}) => {
    const res = await binary(
      request(app).get('/api/export/excel').query(query).set('Authorization', `Bearer ${token}`)
    );
    expect(res.status).toBe(200);
    const workbook = await readWorkbook(res.body);
    const sheet = workbook.getWorksheet('Inventario');
    const codes = [];
    // Filas de datos: 4 .. rowCount-1 (rowCount incluye título/subtítulo/encabezado/total —
    // ver export.integration.test.js). Vacío cuando rowCount=4 (solo queda la fila TOTAL).
    for (let i = 4; i <= sheet.rowCount - 1; i++) {
      codes.push(sheet.getRow(i).values[CLAVE_COL]);
    }
    return codes.sort();
  };

  const expectListingMatchesExcel = async (query) => {
    const [listing, excel] = await Promise.all([listingCodes(query), excelCodes(query)]);
    expect(excel).toEqual(listing);
    return listing;
  };

  test('sin filtros: listado y Excel devuelven el mismo conjunto completo', async () => {
    await createProperty({ code: 'SF-1' });
    await createProperty({ code: 'SF-2' });
    await createProperty({ code: 'SF-3' });

    const codes = await expectListingMatchesExcel({});
    expect(codes).toEqual(['SF-1', 'SF-2', 'SF-3']);
  });

  test('filtro de ciudad', async () => {
    await createProperty({ code: 'CIU-JRZ', city: 'juarez' });
    await createProperty({ code: 'CIU-CHI', city: 'chihuahua' });

    const codes = await expectListingMatchesExcel({ city: 'chihuahua' });
    expect(codes).toEqual(['CIU-CHI']);
  });

  test('filtro de tipo', async () => {
    await createProperty({ code: 'TIPO-CASA', type: 'casa' });
    await createProperty({ code: 'TIPO-DEPTO', type: 'departamento' });

    const codes = await expectListingMatchesExcel({ type: 'departamento' });
    expect(codes).toEqual(['TIPO-DEPTO']);
  });

  test('filtro de categoría', async () => {
    await createProperty({ code: 'CAT-REM', category: 'remate' });
    await createProperty({ code: 'CAT-RENTA', category: 'renta' });

    const codes = await expectListingMatchesExcel({ category: 'renta' });
    expect(codes).toEqual(['CAT-RENTA']);
  });

  test('filtro de línea de negocio (businessLine)', async () => {
    await createProperty({ code: 'BL-REM', businessLine: 'remate' });
    await createProperty({ code: 'BL-CRED', businessLine: 'credito' });

    const codes = await expectListingMatchesExcel({ businessLine: 'credito' });
    expect(codes).toEqual(['BL-CRED']);
  });

  test('búsqueda por texto', async () => {
    await createProperty({ code: 'SRCH-1', title: 'Residencial Campestre exclusivo' });
    await createProperty({ code: 'SRCH-2', title: 'Departamento centro' });

    const codes = await expectListingMatchesExcel({ search: 'Campestre' });
    expect(codes).toEqual(['SRCH-1']);
  });

  test('rango de precio', async () => {
    await createProperty({ code: 'PRICE-LOW', price: 200000 });
    await createProperty({ code: 'PRICE-MID', price: 500000 });
    await createProperty({ code: 'PRICE-HIGH', price: 900000 });

    const codes = await expectListingMatchesExcel({ minPrice: 300000, maxPrice: 700000 });
    expect(codes).toEqual(['PRICE-MID']);
  });

  test('filtro de recámaras (mínimo)', async () => {
    await createProperty({ code: 'BED-1', bedrooms: 1 });
    await createProperty({ code: 'BED-3', bedrooms: 3 });

    const codes = await expectListingMatchesExcel({ minBedrooms: 2 });
    expect(codes).toEqual(['BED-3']);
  });

  test('filtro de baños (mínimo)', async () => {
    await createProperty({ code: 'BATH-1', bathrooms: 1 });
    await createProperty({ code: 'BATH-3', bathrooms: 3 });

    const codes = await expectListingMatchesExcel({ minBathrooms: 2 });
    expect(codes).toEqual(['BATH-3']);
  });

  test('rango de terreno (m²)', async () => {
    await createProperty({ code: 'TER-SMALL', terrainMeters: 100 });
    await createProperty({ code: 'TER-BIG', terrainMeters: 500 });

    const codes = await expectListingMatchesExcel({ minTerrainM2: 200, maxTerrainM2: 600 });
    expect(codes).toEqual(['TER-BIG']);
  });

  test('rango de construcción (m²)', async () => {
    await createProperty({ code: 'CON-SMALL', constructionMeters: 80 });
    await createProperty({ code: 'CON-BIG', constructionMeters: 300 });

    const codes = await expectListingMatchesExcel({ minConstructionM2: 150, maxConstructionM2: 400 });
    expect(codes).toEqual(['CON-BIG']);
  });

  test('combinación de varios filtros simultáneos', async () => {
    await createProperty({
      code: 'COMBO-MATCH',
      city: 'juarez',
      type: 'casa',
      businessLine: 'remate',
      price: 500000,
      title: 'Casa remate Campestre',
    });
    await createProperty({
      code: 'COMBO-WRONG-CITY',
      city: 'chihuahua',
      type: 'casa',
      businessLine: 'remate',
      price: 500000,
      title: 'Casa remate Campestre',
    });
    await createProperty({
      code: 'COMBO-WRONG-PRICE',
      city: 'juarez',
      type: 'casa',
      businessLine: 'remate',
      price: 2000000,
      title: 'Casa remate Campestre',
    });

    const codes = await expectListingMatchesExcel({
      city: 'juarez',
      type: 'casa',
      businessLine: 'remate',
      search: 'Campestre',
      minPrice: 100000,
      maxPrice: 900000,
    });
    expect(codes).toEqual(['COMBO-MATCH']);
  });

  test('filtro que no devuelve resultados: 0 en listado y Excel, sin error 500', async () => {
    await createProperty({ code: 'NORESULT', city: 'juarez' });

    const listingRes = await request(app)
      .get('/api/properties')
      .query({ city: 'queretaro' })
      .set('Authorization', `Bearer ${token}`);
    expect(listingRes.status).toBe(200);
    expect(listingRes.body.data).toEqual([]);
    expect(listingRes.body.pagination.total).toBe(0);

    const excelRes = await binary(
      request(app)
        .get('/api/export/excel')
        .query({ city: 'queretaro' })
        .set('Authorization', `Bearer ${token}`)
    );
    expect(excelRes.status).toBe(200);
    const workbook = await readWorkbook(excelRes.body);
    const sheet = workbook.getWorksheet('Inventario');
    expect(sheet.rowCount).toBe(4); // sin filas de datos, solo la fila TOTAL
    expect(sheet.getRow(4).values[2]).toBe('TOTAL: 0 propiedades');

    const pdfRes = await binary(
      request(app)
        .get('/api/export/pdf')
        .query({ city: 'queretaro' })
        .set('Authorization', `Bearer ${token}`)
    );
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.body.length).toBeGreaterThan(0);
  });

  test('exportación sin paginación: trae TODO el conjunto filtrado, no solo una página', async () => {
    for (let i = 0; i < 25; i++) {
      await createProperty({ code: `PAG-${i}`, city: 'juarez' });
    }

    // El listado sí pagina — con limit=5 solo trae 5, aunque el total sea mayor.
    const pagedListing = await request(app)
      .get('/api/properties')
      .query({ city: 'juarez', page: 1, limit: 5 })
      .set('Authorization', `Bearer ${token}`);
    expect(pagedListing.body.data).toHaveLength(5);
    expect(pagedListing.body.pagination.total).toBe(25);

    // La exportación ignora page/limit (no los interpreta) y trae las 25 completas.
    const excelRes = await binary(
      request(app)
        .get('/api/export/excel')
        .query({ city: 'juarez', page: 1, limit: 5 })
        .set('Authorization', `Bearer ${token}`)
    );
    const workbook = await readWorkbook(excelRes.body);
    const sheet = workbook.getWorksheet('Inventario');
    expect(sheet.rowCount - 4).toBe(25);
  });

  describe('GET /api/export/pdf — mismos filtros que el listado', () => {
    test('respeta ciudad + búsqueda combinadas', async () => {
      await createProperty({ code: 'PDF-MATCH', city: 'juarez', title: 'Loft Industrial Único' });
      await createProperty({ code: 'PDF-WRONG-CITY', city: 'chihuahua', title: 'Loft Industrial Único' });
      await createProperty({ code: 'PDF-WRONG-TEXT', city: 'juarez', title: 'Casa tradicional' });

      const res = await binary(
        request(app)
          .get('/api/export/pdf')
          .query({ city: 'juarez', search: 'Industrial' })
          .set('Authorization', `Bearer ${token}`)
      );
      expect(res.status).toBe(200);
      const text = await readPdfText(res.body);
      expect(pdfContains(text, 'PDF-MATCH')).toBe(true);
      expect(pdfContains(text, 'PDF-WRONG-CITY')).toBe(false);
      expect(pdfContains(text, 'PDF-WRONG-TEXT')).toBe(false);
    });
  });

  describe('"Estatus" no forma parte de las exportaciones de propiedades; "Estado" sí', () => {
    test('Excel: el encabezado no incluye "Estatus" y sí incluye "Estado"', async () => {
      await createProperty({ code: 'HDR-1', state: 'Chihuahua' });

      const res = await binary(
        request(app).get('/api/export/excel').set('Authorization', `Bearer ${token}`)
      );
      const workbook = await readWorkbook(res.body);
      const sheet = workbook.getWorksheet('Inventario');
      const headerRow = sheet.getRow(3).values.filter(Boolean);
      expect(headerRow).not.toContain('Estatus');
      expect(headerRow).toContain('Estado');
    });

    test('PDF admin: el texto no contiene la etiqueta "Estatus" y sí "Estado"', async () => {
      await createProperty({ code: 'HDR-2', state: 'Chihuahua' });

      const res = await binary(
        request(app).get('/api/export/pdf').set('Authorization', `Bearer ${token}`)
      );
      const text = await readPdfText(res.body);
      expect(text).not.toMatch(/\bEstatus\b/);
      expect(text).toMatch(/\bEstado\b/);
    });
  });
});

describe('Catálogo público (POST /api/export/catalog/pdf) respeta los mismos filtros', () => {
  const NAME_TAG = 'Filtro Catálogo Test';
  let uniqueCounter = 0;
  // Exactamente 10 dígitos (lo que exige validatePhone): '6' + 7 del timestamp + 2 de un
  // contador — mismo criterio que uniquePhone en helpers/factories.js.
  const uniquePhone = () =>
    `6${Date.now().toString().slice(-7)}${String(++uniqueCounter).padStart(2, '0')}`;

  function binaryParserLocal(res, callback) {
    res.setEncoding('binary');
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => callback(null, Buffer.from(data, 'binary')));
  }
  const binaryPost = (req) => req.buffer(true).parse(binaryParserLocal);

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
  });

  afterEach(async () => {
    await Lead.destroy({ where: { name: NAME_TAG }, force: true });
    await Property.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  const catalogPayload = (filters = {}) => ({
    name: NAME_TAG,
    phone: uniquePhone(),
    interest: 'comprar_propiedad',
    ...filters,
  });

  test('nunca incluye propiedades fuera de status=disponible, aunque se intente forzar otro status', async () => {
    await createProperty({ code: 'PUB-DISP', title: 'Casa disponible catálogo', status: 'disponible' });
    await createProperty({ code: 'PUB-VEND', title: 'Casa vendida catálogo', status: 'vendido' });

    const res = await binaryPost(request(app).post('/api/export/catalog/pdf')).send(
      catalogPayload({ status: 'vendido', search: 'catálogo' })
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');

    const text = await readPdfText(res.body);
    expect(pdfContains(text, 'Casa disponible catálogo')).toBe(true);
    expect(pdfContains(text, 'Casa vendida catálogo')).toBe(false);
  });

  test('respeta ciudad + rango de precio', async () => {
    await createProperty({
      title: 'Depto Centro Catálogo',
      city: 'chihuahua',
      price: 400000,
      status: 'disponible',
    });
    await createProperty({
      title: 'Depto Otra Ciudad Catálogo',
      city: 'juarez',
      price: 400000,
      status: 'disponible',
    });
    await createProperty({
      title: 'Depto Fuera de Precio Catálogo',
      city: 'chihuahua',
      price: 5000000,
      status: 'disponible',
    });

    const res = await binaryPost(request(app).post('/api/export/catalog/pdf')).send(
      catalogPayload({ city: 'chihuahua', minPrice: 100000, maxPrice: 900000 })
    );
    const text = await readPdfText(res.body);
    expect(pdfContains(text, 'Depto Centro Catálogo')).toBe(true);
    expect(pdfContains(text, 'Depto Otra Ciudad Catálogo')).toBe(false);
    expect(pdfContains(text, 'Depto Fuera de Precio Catálogo')).toBe(false);
  });

  test('sin resultados: responde 200 con un PDF válido, no un error 500', async () => {
    const res = await binaryPost(request(app).post('/api/export/catalog/pdf')).send(
      catalogPayload({ city: 'queretaro', search: 'inexistente-xyz' })
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('"Estatus" no aparece en el PDF del catálogo público', async () => {
    await createProperty({ title: 'Propiedad catálogo estatus', status: 'disponible' });

    const res = await binaryPost(request(app).post('/api/export/catalog/pdf')).send(catalogPayload());
    const text = await readPdfText(res.body);
    expect(text).not.toMatch(/\bEstatus\b/);
  });
});
