// HOTFIX — incidente de producción: GET /api/properties devolvía 500 en cada petición.
// Causa raíz: la migración que agrega waterDebt/electricityDebt/propertyTaxDebt/
// debtsUpdateDate a `properties` nunca se aplicó en la base de datos de producción, aunque
// el modelo Property (ya desplegado) sí espera esas columnas —
// `attributes: { exclude: ['internalNotes'] }` en getProperties selecciona TODAS las demás
// columnas del modelo, así que cualquier columna faltante rompe la consulta con un
// SequelizeDatabaseError en cada petición. Ver server/src/config/checkSchemaSync.js (y sus
// tests) para la reproducción exacta del escenario de columnas faltantes — aquí se cubren:
// el caso normal por cada rol, y que un error real de base de datos (simulado, sin arriesgar
// el esquema compartido de la BD de test) se traduce en un 500 seguro y queda registrado,
// en vez de filtrar detalles internos al cliente.
const request = require('supertest');
const app = require('../../app');
const logger = require('../utils/logger');
const { sequelize, Property, User } = require('../models/index');
const { createUser, authToken, createProperty } = require('./helpers/factories');

jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

describe('GET /api/properties', () => {
  let admin, asistente, asesor, coordinador;
  let adminToken, asistenteToken, asesorToken, coordinadorToken;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    asistente = await createUser({ role: 'asistente_administrativo' });
    asesor = await createUser({ role: 'asesor_ventas' });
    coordinador = await createUser({ role: 'coordinador_ventas' });
    adminToken = authToken(admin);
    asistenteToken = authToken(asistente);
    asesorToken = authToken(asesor);
    coordinadorToken = authToken(coordinador);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await Property.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({
      where: { id: [admin.id, asistente.id, asesor.id, coordinador.id] },
      force: true,
    });
    await sequelize.close();
  });

  describe('caso normal — por rol', () => {
    test.each([
      ['admin', () => adminToken],
      ['asistente_administrativo', () => asistenteToken],
      ['asesor_ventas', () => asesorToken],
      ['coordinador_ventas', () => coordinadorToken],
    ])('%s: devuelve 200 con las propiedades disponibles', async (_role, getToken) => {
      await createProperty({ status: 'disponible' });
      await createProperty({ status: 'disponible' });

      const res = await request(app)
        .get('/api/properties')
        .set('Authorization', `Bearer ${getToken()}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    test('usuario no autenticado: devuelve 200 y solo ve propiedades "disponible"', async () => {
      await createProperty({ status: 'disponible' });
      await createProperty({ status: 'vendido' });

      const res = await request(app).get('/api/properties');

      expect(res.status).toBe(200);
      expect(res.body.data.every((p) => p.status === 'disponible')).toBe(true);
    });

    test('staff autenticado sí puede ver propiedades en otros estatus vía filtro', async () => {
      await createProperty({ status: 'vendido' });

      const res = await request(app)
        .get('/api/properties')
        .query({ status: 'vendido' })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((p) => p.status === 'vendido')).toBe(true);
    });

    test('paginación: respeta page/limit', async () => {
      for (let i = 0; i < 5; i++) await createProperty({ status: 'disponible' });

      const res = await request(app).get('/api/properties').query({ page: 1, limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(5);
      expect(res.body.pagination.hasNext).toBe(true);
    });

    test('filtros combinados (city/type/category/businessLine/precio) no rompen la consulta', async () => {
      await createProperty({
        status: 'disponible',
        city: 'juarez',
        type: 'casa',
        category: 'remate',
        businessLine: 'remate',
        price: 500000,
      });

      const res = await request(app).get('/api/properties').query({
        city: 'juarez',
        type: 'casa',
        category: 'remate',
        businessLine: 'remate',
        minPrice: 100000,
        maxPrice: 900000,
      });

      expect(res.status).toBe(200);
    });

    test('búsqueda por texto no rompe la consulta (camino FULLTEXT + fallback LIKE)', async () => {
      await createProperty({ status: 'disponible', title: 'Casa remate especial Juárez' });

      const res = await request(app).get('/api/properties').query({ search: 'especial' });

      expect(res.status).toBe(200);
    });
  });

  describe('caso de error real de base de datos — no debe filtrar detalles ni tumbar el proceso', () => {
    test('un SequelizeDatabaseError (ej. columna faltante, el incidente real) se traduce en 500 seguro y queda registrado', async () => {
      // Simula exactamente la clase de error que causó el incidente
      // (`Unknown column 'waterDebt' in 'field list'`) sin arriesgar el esquema real de la
      // base de datos de test compartida por el resto de la suite — ver
      // checkSchemaSync.test.js para la reproducción con el esquema real (mockeado).
      const dbError = new Error(
        "Unknown column 'waterDebt' in 'field list'"
      );
      dbError.name = 'SequelizeDatabaseError';
      dbError.original = { code: 'ER_BAD_FIELD_ERROR' };
      jest.spyOn(Property, 'findAndCountAll').mockRejectedValueOnce(dbError);

      const res = await request(app).get('/api/properties');

      expect(res.status).toBe(500);
      // Nunca debe filtrar el mensaje real de Sequelize/MySQL al cliente.
      expect(res.body.error).toBe('Error interno del servidor');
      expect(res.body.error).not.toMatch(/waterDebt|SequelizeDatabaseError|ER_BAD_FIELD_ERROR/);
      expect(res.body.stack).toBeUndefined();

      // Pero sí debe quedar registrado con suficiente contexto para diagnosticarlo.
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('/api/properties'),
        expect.objectContaining({
          statusCode: 500,
          message: expect.stringContaining('waterDebt'),
        })
      );
    });

    test('un error real no dejó al proceso en mal estado: la siguiente petición funciona con normalidad', async () => {
      const dbError = new Error("Unknown column 'waterDebt' in 'field list'");
      dbError.name = 'SequelizeDatabaseError';
      jest.spyOn(Property, 'findAndCountAll').mockRejectedValueOnce(dbError);

      const failedRes = await request(app).get('/api/properties');
      expect(failedRes.status).toBe(500);

      const okRes = await request(app).get('/api/properties');
      expect(okRes.status).toBe(200);
    });
  });

  describe('caso de entrada inválida — debe ser un error controlado (400/200 con lista vacía), nunca una excepción sin manejar', () => {
    test('page/limit no numéricos no producen un 500 (caen a los valores por defecto)', async () => {
      const res = await request(app).get('/api/properties').query({ page: 'abc', limit: 'xyz' });
      expect(res.status).toBe(200);
    });

    test('un filtro de ciudad/tipo/categoría fuera del ENUM no produce un 500', async () => {
      const res = await request(app)
        .get('/api/properties')
        .query({ city: 'atlantida', type: 'castillo', category: 'inexistente' });

      // El ENUM de MySQL simplemente no matchea nada — 200 con lista vacía, no una excepción.
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });
});
