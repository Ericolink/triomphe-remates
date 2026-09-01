// SEC-004 — la validación de "magic bytes" (utils/fileSignature.js) protegía la subida de
// imágenes de propiedades, pero no la de testimonios ni la foto de perfil de usuario: ahí
// solo se validaba extensión/Content-Type declarados por el cliente, ambos falsificables
// con solo renombrar un archivo. `upload.validateImageSignature` (middleware/
// uploadMiddleware.js) ahora corre después de multer en las 3 rutas. Estos tests suben un
// archivo de verdad a cada ruta afectada y verifican que:
//  - un archivo cuyo contenido real es una imagen válida se acepta,
//  - un archivo que solo CAMBIÓ su extensión/Content-Type (contenido real no es imagen)
//    se rechaza con 400, sin llegar a Cloudinary.
jest.mock('../config/cloudinary', () => ({
  cloudinary: {
    uploader: {
      upload_stream: (options, callback) => ({
        end: () => callback(null, { secure_url: 'https://res.cloudinary.com/test/mock.jpg', public_id: 'mock_public_id' }),
      }),
      destroy: jest.fn((publicId, options, cb) => cb(null, { result: 'ok' })),
    },
  },
}));

const request = require('supertest');
const app = require('../../app');
const { sequelize, Testimonial, User } = require('../models/index');
const { createUser, authToken } = require('./helpers/factories');

// Bytes reales de un JPEG (solo la firma — isValidImageBuffer no exige un archivo
// decodificable completo, solo los primeros bytes) vs. un archivo de texto/HTML disfrazado
// con extensión y Content-Type de imagen (exactamente el ataque que SEC-004 describe:
// "cambiar la extensión no debe bastar").
const REAL_JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const FAKE_IMAGE_DISGUISED_AS_JPEG = Buffer.from('<html><body>no soy una imagen</body></html>');

describe('Validación de magic bytes en subida de archivos (SEC-004)', () => {
  let admin, adminToken, targetUser;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    targetUser = await createUser({ role: 'asistente_administrativo' });
    adminToken = authToken(admin);
  });

  afterEach(async () => {
    await Testimonial.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: [admin.id, targetUser.id] }, force: true });
    await sequelize.close();
  });

  describe('POST /api/testimonials', () => {
    test('caso permitido: acepta un archivo cuyo contenido real es una imagen válida', async () => {
      const res = await request(app)
        .post('/api/testimonials')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('clientName', 'Cliente de prueba')
        .field('testimonialText', 'Excelente servicio')
        .attach('beforeImage', REAL_JPEG_BYTES, {
          filename: 'antes.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.beforeImageUrl).toBe('https://res.cloudinary.com/test/mock.jpg');
    });

    test('caso bloqueado: rechaza un archivo no-imagen aunque declare extensión y Content-Type de imagen', async () => {
      const res = await request(app)
        .post('/api/testimonials')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('clientName', 'Cliente de prueba')
        .field('testimonialText', 'Excelente servicio')
        .attach('beforeImage', FAKE_IMAGE_DISGUISED_AS_JPEG, {
          filename: 'antes.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/imágenes válidas/i);

      // No debe haberse creado ningún testimonio ni haberse subido nada a Cloudinary.
      const count = await Testimonial.count();
      expect(count).toBe(0);
    });
  });

  describe('PUT /api/users/:id (foto de perfil)', () => {
    test('caso permitido: acepta una foto de perfil cuyo contenido real es una imagen válida', async () => {
      const res = await request(app)
        .put(`/api/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('profilePhoto', REAL_JPEG_BYTES, { filename: 'perfil.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body.data.profilePhoto).toBe('https://res.cloudinary.com/test/mock.jpg');
    });

    test('caso bloqueado: rechaza una foto de perfil cuyo contenido real no es una imagen', async () => {
      const before = await User.findByPk(targetUser.id);

      const res = await request(app)
        .put(`/api/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('profilePhoto', FAKE_IMAGE_DISGUISED_AS_JPEG, {
          filename: 'perfil.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/imágenes válidas/i);

      // El usuario no debe haber cambiado — el rechazo ocurrió antes de llegar al controller.
      const after = await User.findByPk(targetUser.id);
      expect(after.profilePhoto).toBe(before.profilePhoto);
    });
  });
});
