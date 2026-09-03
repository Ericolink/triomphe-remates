// Confirma el cableado real de app.js (no solo la clasificación aislada en
// errorHandler.test.js): una petición con un Origin no permitido debe llegar hasta el
// middleware cors(), producir un CorsError, y salir como 403 — no como el 500 genérico que
// devolvía antes de que errorHandler reconociera CorsError explícitamente.
const request = require('supertest');
const app = require('../../app');
const { sequelize } = require('../models/index');

describe('CORS — origin no permitido', () => {
  afterAll(async () => {
    await sequelize.close();
  });

  test('un Origin fuera de la whitelist responde 403, no 500', async () => {
    const res = await request(app)
      .get('/api/properties')
      .set('Origin', 'https://sitio-no-autorizado.example');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Origen no permitido.');
  });

  test('sin header Origin (ej. curl, apps nativas) la petición no se ve afectada por CORS', async () => {
    const res = await request(app).get('/api/properties');

    expect(res.status).toBe(200);
  });
});
