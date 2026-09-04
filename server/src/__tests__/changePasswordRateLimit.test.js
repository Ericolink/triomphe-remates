const request = require('supertest');
const app = require('../../app');
const { sequelize, User } = require('../models/index');
const { hashPassword } = require('../utils/helpers');

// Verifica que separar el limiter de change-password de authLimiter (ver
// rateLimitMiddleware.js) no rompió login/register y que la nueva política
// (10/15min, keyed por usuario) funciona de forma aislada por cuenta.
describe('Rate limiting de PUT /api/auth/change-password', () => {
  let tokenA;
  let tokenB;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    await User.destroy({ where: {}, force: true });
    await User.create({
      name: 'Admin A',
      email: 'ratelimit-a@triomphe.test',
      password: await hashPassword('Password123'),
      role: 'admin',
      isActive: true,
    });
    await User.create({
      name: 'Admin B',
      email: 'ratelimit-b@triomphe.test',
      password: await hashPassword('Password123'),
      role: 'admin',
      isActive: true,
    });

    const loginA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ratelimit-a@triomphe.test', password: 'Password123' });
    tokenA = loginA.body.token;

    const loginB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ratelimit-b@triomphe.test', password: 'Password123' });
    tokenB = loginB.body.token;
  });

  afterAll(async () => {
    await User.destroy({ where: {}, force: true });
    await sequelize.close();
  });

  test('login sigue pasando por authLimiter y por los limiters de fuerza bruta (ver loginBruteForce.test.js)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ratelimit-a@triomphe.test', password: 'wrong-password' });

    expect(res.status).toBe(401);
    // /login corre tres limiters en cadena: authLimiter (20/15min, IP) → loginLimiter
    // (5/15min, IP+email) → loginAccountLimiter (15/15min, email) — cada uno pisa los
    // headers RateLimit-* del anterior si no corta la respuesta, así que el valor visible
    // en la respuesta es el del ÚLTIMO limiter que corrió (loginAccountLimiter). El
    // comportamiento de authLimiter/loginLimiter en sí se prueba en loginBruteForce.test.js.
    expect(res.headers['ratelimit-limit']).toBe('15');
  });

  test('register sigue usando authLimiter (20/15min), no el nuevo limiter', async () => {
    // Payload inválido a propósito: solo interesa que authLimiter (no el nuevo limiter
    // de change-password) sea el que procese esta ruta, sin crear un usuario real.
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Nadie' });

    expect(res.status).toBe(400);
    expect(res.headers['ratelimit-limit']).toBe('20');
  });

  test('change-password usa un limiter propio (10/15min), no el 20 de authLimiter', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ currentPassword: 'wrong', newPassword: 'Password456' });

    expect(res.status).toBe(401); // currentPassword incorrecto, no bloqueado por rate limit
    expect(res.headers['ratelimit-limit']).toBe('10');
  });

  test('agotar el límite de change-password de un usuario no afecta el login de otro', async () => {
    // Usuario A agota su presupuesto de change-password (10/15min)
    for (let i = 0; i < 9; i += 1) {
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ currentPassword: 'wrong', newPassword: 'Password456' });
      expect(res.status).toBe(401);
    }

    const blocked = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ currentPassword: 'wrong', newPassword: 'Password456' });
    expect(blocked.status).toBe(429);

    // Usuario B, misma IP de origen (supertest/loopback), sigue con su propio presupuesto
    // intacto porque la key es por usuario (jwt.verify), no por IP.
    const stillWorksForB = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ currentPassword: 'wrong', newPassword: 'Password456' });
    expect(stillWorksForB.status).toBe(401);

    // Y el login de cualquier usuario (misma IP) tampoco se vio afectado por haber
    // agotado el limiter de change-password.
    const loginStillWorks = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ratelimit-b@triomphe.test', password: 'Password123' });
    expect(loginStillWorks.status).toBe(200);
  });

  test('sin token, change-password cae al fallback por IP y responde 401 (no crashea)', async () => {
    const res = await request(app)
      .put('/api/auth/change-password')
      .send({ currentPassword: 'wrong', newPassword: 'Password456' });

    expect(res.status).toBe(401);
  });
});
