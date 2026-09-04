const request = require('supertest');
const app = require('../../app');
const { sequelize, User } = require('../models/index');
const { hashPassword } = require('../utils/helpers');

// Cubre el issue de seguridad de fuerza bruta en /api/auth/login (ver rateLimitMiddleware.js:
// loginLimiter/loginAccountLimiter). Los limiters viven en memoria — una sola instancia
// compartida por TODO el archivo (igual que en producción, un solo proceso), así que
// authLimiter (por IP, sin key por test) acumula intentos de un `test()` a otro si todos
// comparten la misma IP de origen. Para que cada escenario sea determinista y no dependa del
// orden de ejecución, cada `describe` fija su propia IP sintética vía X-Forwarded-For
// (trust proxy ya está en 1, ver app.js) — así ningún bloque interfiere con el cupo de
// authLimiter de otro. Los que SÍ necesitan variar la IP a propósito (para probar
// loginAccountLimiter o authLimiter en sí) lo hacen dentro de su propio bloque, ya aislado.
describe('Fuerza bruta / rate limiting de POST /api/auth/login', () => {
  const PASSWORD = 'Password123';

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    await User.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: {}, force: true });
    await sequelize.close();
  });

  async function createUser(email) {
    return User.create({
      name: 'Admin de prueba',
      email,
      password: await hashPassword(PASSWORD),
      role: 'admin',
      isActive: true,
    });
  }

  const attempt = (ip, body) => request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send(body);

  describe('límite combinado IP+cuenta (loginLimiter: 5/15min)', () => {
    const email = 'bruteforce-combo@triomphe.test';
    const ip = '203.0.113.10';

    beforeAll(async () => {
      await createUser(email);
    });

    test('los primeros 5 intentos fallidos se procesan normalmente (401, no 429)', async () => {
      for (let i = 0; i < 5; i += 1) {
        const res = await attempt(ip, { email, password: 'wrong-password' });
        expect(res.status).toBe(401);
      }
    });

    test('el 6to intento (mismo IP+email) responde 429 con Retry-After y mensaje genérico', async () => {
      const res = await attempt(ip, { email, password: 'wrong-password' });

      expect(res.status).toBe(429);
      expect(res.body.error).toBe('Demasiados intentos. Intenta de nuevo en unos minutos.');
      expect(res.headers['retry-after']).toBeDefined();
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });

    test('el bloqueo persiste aunque se mande la contraseña correcta (backend, no solo frontend)', async () => {
      const res = await attempt(ip, { email, password: PASSWORD });
      expect(res.status).toBe(429);
      expect(res.body.token).toBeUndefined();
    });
  });

  describe('login exitoso reinicia el contador de intentos fallidos', () => {
    const email = 'bruteforce-reset@triomphe.test';
    const ip = '203.0.113.11';

    beforeAll(async () => {
      await createUser(email);
    });

    test('4 fallos + 1 éxito + 4 fallos más no llega a bloquear (el contador se limpió tras el éxito)', async () => {
      for (let i = 0; i < 4; i += 1) {
        const res = await attempt(ip, { email, password: 'wrong-password' });
        expect(res.status).toBe(401);
      }

      const success = await attempt(ip, { email, password: PASSWORD });
      expect(success.status).toBe(200);
      expect(success.body.token).toBeDefined();

      for (let i = 0; i < 4; i += 1) {
        const res = await attempt(ip, { email, password: 'wrong-password' });
        expect(res.status).toBe(401); // si el contador no se hubiera reiniciado, esto ya estaría en 429
      }
    });
  });

  describe('cooldown: tras el bloqueo, pasada la ventana de 15min el login vuelve a permitirse', () => {
    const email = 'bruteforce-cooldown@triomphe.test';
    const ip = '203.0.113.12';

    beforeAll(async () => {
      await createUser(email);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('bloqueado dentro de la ventana, permitido de nuevo pasados los 15 minutos', async () => {
      // Solo se fija Date — los timers reales (setTimeout/clearTimeout/I-O de supertest) se
      // dejan intactos, mismo patrón que leads.integration.test.js. MemoryStore (ver
      // node_modules/express-rate-limit) calcula sus ventanas con Date.now(), así que esto
      // alcanza para simular el paso del tiempo sin esperar 15 minutos reales.
      const t0 = new Date('2026-01-05T10:00:00.000Z');
      jest
        .useFakeTimers({
          doNotFake: [
            'setTimeout',
            'clearTimeout',
            'setInterval',
            'clearInterval',
            'setImmediate',
            'clearImmediate',
            'nextTick',
            'queueMicrotask',
          ],
        })
        .setSystemTime(t0);

      for (let i = 0; i < 5; i += 1) {
        const res = await attempt(ip, { email, password: 'wrong-password' });
        expect(res.status).toBe(401);
      }
      const blocked = await attempt(ip, { email, password: PASSWORD });
      expect(blocked.status).toBe(429);

      // Avanza 15 minutos y 1 segundo — la ventana ya debería haber expirado.
      jest.setSystemTime(new Date(t0.getTime() + 15 * 60 * 1000 + 1000));

      const afterCooldown = await attempt(ip, { email, password: PASSWORD });
      expect(afterCooldown.status).toBe(200);
      expect(afterCooldown.body.token).toBeDefined();
    });
  });

  describe('red de seguridad por cuenta (loginAccountLimiter: 15/15min, sin IP)', () => {
    const email = 'bruteforce-distributed@triomphe.test';

    beforeAll(async () => {
      await createUser(email);
    });

    test('no se puede evadir el límite por cuenta cambiando el header X-Forwarded-For en cada intento', async () => {
      // loginLimiter (IP+email, cap 5) sí se dispara por cada IP nueva reiniciado en 0, pero
      // loginAccountLimiter (solo email, cap 15) no depende de IP — así que rotar IP falsa en
      // cada request evade el primero pero no el segundo. Cada intento usa una IP distinta
      // (203.0.113.60+i), fuera del rango usado por cualquier otro describe de este archivo,
      // así que ninguno choca contra loginLimiter ni contra el cupo de authLimiter de otra
      // IP ya usada en un describe anterior.
      const results = [];
      for (let i = 0; i < 15; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const res = await attempt(`203.0.113.${60 + i}`, { email, password: 'wrong-password' });
        results.push(res.status);
      }
      // Ninguno de estos 15 debería haber tropezado con loginLimiter (IP distinta cada vez),
      // así que todos deberían haber sido 401 — y loginAccountLimiter ya debería estar en su
      // cupo máximo (15/15) sin haber disparado 429 todavía (recién en el intento 16).
      expect(results.every((s) => s === 401)).toBe(true);

      const overLimit = await attempt('203.0.113.75', { email, password: 'wrong-password' });
      expect(overLimit.status).toBe(429);
    });
  });

  describe('cambiar de email desde la misma IP no evade el límite por IP (authLimiter: 20/15min)', () => {
    const ip = '203.0.113.30';

    test('20 intentos con emails distintos desde la misma IP agotan authLimiter', async () => {
      const statuses = [];
      for (let i = 0; i < 21; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const res = await attempt(ip, { email: `no-existe-scan-${i}@triomphe.test`, password: 'x' });
        statuses.push(res.status);
      }
      // Los primeros 20 son 401 (cada email es nuevo, así que ni loginLimiter ni
      // loginAccountLimiter se agotan individualmente); el 21vo cae en 429 por IP.
      expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true);
      expect(statuses[20]).toBe(429);
    });
  });

  describe('condiciones de carrera: requests concurrentes contra la misma cuenta', () => {
    const email = 'bruteforce-concurrent@triomphe.test';
    const ip = '203.0.113.40';

    beforeAll(async () => {
      await createUser(email);
    });

    test('20 requests simultáneos no son todos aceptados — el cupo de 5 se respeta exactamente', async () => {
      const requests = Array.from({ length: 20 }, () => attempt(ip, { email, password: 'wrong-password' }));
      const results = await Promise.all(requests);
      const statuses = results.map((r) => r.status);

      expect(statuses.filter((s) => s === 401).length).toBe(5);
      expect(statuses.filter((s) => s === 429).length).toBe(15);
    });
  });

  describe('no se expone información sensible en un bloqueo', () => {
    const email = 'bruteforce-noleak@triomphe.test';
    const ip = '203.0.113.50';

    beforeAll(async () => {
      await createUser(email);
    });

    test('la respuesta 429 no contiene token, hash de password ni detalles internos', async () => {
      for (let i = 0; i < 5; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await attempt(ip, { email, password: 'wrong-password' });
      }
      const res = await attempt(ip, { email, password: PASSWORD });

      expect(res.status).toBe(429);
      const raw = JSON.stringify(res.body);
      expect(raw).not.toMatch(/token/i);
      expect(raw).not.toMatch(/\$2[aby]\$/); // ningún hash bcrypt
      expect(Object.keys(res.body)).toEqual(['error']);
    });
  });
});
