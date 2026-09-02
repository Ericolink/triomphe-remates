// AUDITORÍA 500s — revisión pre-deploy (PASO 7): antes, si UNA imagen fallaba al subir a
// Cloudinary a mitad de una subida múltiple, Promise.all rechazaba TODA la petición aunque
// las demás imágenes ya se hubieran subido y guardado en la base — un admin podía ver un
// error, no saber que parte de las fotos sí quedaron guardadas, y reintentar generando
// duplicados. propertyController.uploadImages ahora usa Promise.allSettled: guarda lo que sí
// subió y solo falla la petición completa si NINGUNA imagen se pudo subir.
let mockCloudinaryCallCount = 0;
let mockFailOnCall = null; // null = nunca falla; N = falla exactamente en la llamada N (1-indexed)

jest.mock('../config/cloudinary', () => ({
  cloudinary: {
    uploader: {
      upload_stream: (options, callback) => ({
        end: () => {
          mockCloudinaryCallCount += 1;
          const thisCall = mockCloudinaryCallCount;
          if (mockFailOnCall === 'all' || thisCall === mockFailOnCall) {
            callback(new Error('Cloudinary timeout simulado'));
          } else {
            callback(null, {
              secure_url: `https://res.cloudinary.com/test/mock${thisCall}.jpg`,
              public_id: `mock_public_id_${thisCall}`,
            });
          }
        },
      }),
      destroy: jest.fn((publicId, options, cb) => cb(null, { result: 'ok' })),
    },
  },
}));

const request = require('supertest');
const app = require('../../app');
const { sequelize, Property, Image, User } = require('../models/index');
const { createUser, authToken, createProperty } = require('./helpers/factories');

const REAL_JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

describe('POST /api/properties/:id/images — subida parcial', () => {
  let admin, adminToken, property;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    adminToken = authToken(admin);
  });

  beforeEach(async () => {
    property = await createProperty();
    mockCloudinaryCallCount = 0;
    mockFailOnCall = null;
  });

  afterEach(async () => {
    await Image.destroy({ where: {}, force: true });
    await Property.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  test('si una de tres imágenes falla, las otras dos se guardan y la respuesta lo reporta', async () => {
    mockFailOnCall = 2;

    const res = await request(app)
      .post(`/api/properties/${property.id}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('images', REAL_JPEG_BYTES, { filename: '1.jpg', contentType: 'image/jpeg' })
      .attach('images', REAL_JPEG_BYTES, { filename: '2.jpg', contentType: 'image/jpeg' })
      .attach('images', REAL_JPEG_BYTES, { filename: '3.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.failedCount).toBe(1);

    const savedCount = await Image.count({ where: { propertyId: property.id } });
    expect(savedCount).toBe(2);

    // La portada debe quedar asignada a la primera imagen que SÍ se subió con éxito.
    const cover = await Image.findOne({ where: { propertyId: property.id, isCover: true } });
    expect(cover).not.toBeNull();
  });

  test('si todas las imágenes fallan, responde 502 y no crea ningún registro', async () => {
    mockFailOnCall = 'all';

    const res = await request(app)
      .post(`/api/properties/${property.id}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('images', REAL_JPEG_BYTES, { filename: '1.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(502);
    expect(res.body.error).not.toMatch(/error interno del servidor/i);

    const savedCount = await Image.count({ where: { propertyId: property.id } });
    expect(savedCount).toBe(0);
  });

  test('caso exitoso: todas las imágenes se suben sin failedCount', async () => {
    const res = await request(app)
      .post(`/api/properties/${property.id}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('images', REAL_JPEG_BYTES, { filename: '1.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.failedCount).toBe(0);
    expect(res.body.data).toHaveLength(1);
  });
});
