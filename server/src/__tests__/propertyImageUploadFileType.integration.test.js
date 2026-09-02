// AUDITORÍA 500s (2026-09-01): uploadMiddleware.js rechazaba un archivo con extensión/
// Content-Type no permitidos (ej. un .heic de cámara de celular, o cualquier tipo fuera de
// jpg/png/webp) llamando a `cb(new Error(...))` dentro del fileFilter de multer — un Error
// plano, no un ApiError. Como errorHandler.js solo reconocía ApiError, ese rechazo (un caso
// de negocio perfectamente normal: "tipo de archivo no soportado") terminaba como un 500
// "Error interno del servidor" en vez de un 400 con el mensaje real. Esto es DISTINTO del
// escenario que cubre imageSignatureValidation.integration.test.js (que valida los bytes
// reales del archivo cuando la extensión SÍ es válida) — aquí la extensión/Content-Type
// mismos son los rechazados por multer antes de llegar a esa segunda validación.
const request = require('supertest');
const app = require('../../app');
const { sequelize, Property, Image, User } = require('../models/index');
const { createUser, authToken, createProperty } = require('./helpers/factories');

describe('Rechazo de tipo de archivo no soportado en subida de imágenes (fileFilter)', () => {
  let admin, adminToken, property;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    adminToken = authToken(admin);
  });

  beforeEach(async () => {
    property = await createProperty();
  });

  afterEach(async () => {
    await Image.destroy({ where: {}, force: true });
    await Property.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  test('un archivo con extensión/Content-Type no soportados responde 400, no 500', async () => {
    const res = await request(app)
      .post(`/api/properties/${property.id}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('images', Buffer.from('contenido cualquiera'), {
        filename: 'foto.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/JPG, PNG o WEBP/i);
    expect(res.body.error).not.toMatch(/error interno del servidor/i);

    const count = await Image.count({ where: { propertyId: property.id } });
    expect(count).toBe(0);
  });
});
