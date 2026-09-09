const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const { sequelize, User, UserSession } = require('../models/index');
const { hashPassword } = require('../utils/helpers');

const CHROME_WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SAFARI_IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const login = (email, password = 'Password123', userAgent = CHROME_WINDOWS_UA) =>
  request(app).post('/api/auth/login').set('User-Agent', userAgent).send({ email, password });

describe('Sesiones activas (UserSession)', () => {
  let user1;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    await UserSession.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });

    user1 = await User.create({
      name: 'Usuario Uno',
      email: 'sessions-user1@triomphe.test',
      password: await hashPassword('Password123'),
      role: 'admin',
      isActive: true,
    });
    await User.create({
      name: 'Usuario Dos',
      email: 'sessions-user2@triomphe.test',
      password: await hashPassword('Password123'),
      role: 'admin',
      isActive: true,
    });
  });

  afterEach(async () => {
    await UserSession.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await UserSession.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
    await sequelize.close();
  });

  describe('Creación', () => {
    test('login crea una sesión con device/browser/ip y el JWT incluye sid', async () => {
      const res = await login('sessions-user1@triomphe.test');
      expect(res.status).toBe(200);

      const decoded = jwt.decode(res.body.token);
      expect(decoded.sid).toEqual(expect.any(Number));

      const session = await UserSession.findByPk(decoded.sid);
      expect(session).not.toBeNull();
      expect(session.userId).toBe(user1.id);
      expect(session.device).toBe('Windows');
      expect(session.browser).toBe('Chrome');
      expect(session.ip).toBeTruthy();
      expect(session.lastActivity).toBeInstanceOf(Date);
    });

    test('un User-Agent de iPhone/Safari se clasifica correctamente', async () => {
      const res = await login('sessions-user1@triomphe.test', 'Password123', SAFARI_IPHONE_UA);
      const decoded = jwt.decode(res.body.token);
      const session = await UserSession.findByPk(decoded.sid);
      expect(session.device).toBe('iPhone');
      expect(session.browser).toBe('Safari');
    });
  });

  describe('Consulta', () => {
    test('el usuario puede consultar sus sesiones y se identifica la sesión actual', async () => {
      const { body: a } = await login('sessions-user1@triomphe.test');

      const res = await request(app).get('/api/auth/sessions').set('Authorization', `Bearer ${a.token}`);

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(1);
      expect(res.body.sessions[0].isCurrent).toBe(true);
      expect(res.body.sessions[0].device).toBe('Windows');
    });

    test('una sesión revocada no aparece en la lista de activas', async () => {
      const { body: a } = await login('sessions-user1@triomphe.test');
      const { body: b } = await login('sessions-user1@triomphe.test');
      const idB = jwt.decode(b.token).sid;

      await request(app).delete(`/api/auth/sessions/${idB}`).set('Authorization', `Bearer ${a.token}`);

      const res = await request(app).get('/api/auth/sessions').set('Authorization', `Bearer ${a.token}`);
      expect(res.body.sessions).toHaveLength(1);
      expect(res.body.sessions[0].isCurrent).toBe(true);
    });
  });

  describe('Cerrar sesión individual', () => {
    test('el propietario puede cerrar una sesión propia; la sesión cerrada deja de autenticar y las demás siguen funcionando', async () => {
      const { body: a } = await login('sessions-user1@triomphe.test');
      const { body: b } = await login('sessions-user1@triomphe.test');
      const idB = jwt.decode(b.token).sid;

      const revoke = await request(app)
        .delete(`/api/auth/sessions/${idB}`)
        .set('Authorization', `Bearer ${a.token}`);
      expect(revoke.status).toBe(200);

      const meB = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${b.token}`);
      expect(meB.status).toBe(401);
      expect(meB.body.code).toBe('INVALID_SESSION');

      const meA = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${a.token}`);
      expect(meA.status).toBe(200);
    });

    test('un usuario no puede cerrar la sesión de otro usuario (403) y un id inexistente responde 404', async () => {
      const { body: a } = await login('sessions-user1@triomphe.test');
      const { body: c } = await login('sessions-user2@triomphe.test');
      const idA = jwt.decode(a.token).sid;

      const forbidden = await request(app)
        .delete(`/api/auth/sessions/${idA}`)
        .set('Authorization', `Bearer ${c.token}`);
      expect(forbidden.status).toBe(403);

      const notFound = await request(app)
        .delete('/api/auth/sessions/999999999')
        .set('Authorization', `Bearer ${a.token}`);
      expect(notFound.status).toBe(404);

      // La sesión de user1 sigue intacta: manipular sessionId no la afectó.
      const meA = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${a.token}`);
      expect(meA.status).toBe(200);
    });

    test('no se puede cerrar la sesión actual vía DELETE /sessions/:id (usa /logout)', async () => {
      const { body: a } = await login('sessions-user1@triomphe.test');
      const idA = jwt.decode(a.token).sid;

      const res = await request(app)
        .delete(`/api/auth/sessions/${idA}`)
        .set('Authorization', `Bearer ${a.token}`);
      expect(res.status).toBe(400);
    });
  });

  describe('Cerrar todas las demás sesiones', () => {
    test('mantiene la sesión actual e invalida el resto', async () => {
      const { body: a } = await login('sessions-user1@triomphe.test');
      const { body: b } = await login('sessions-user1@triomphe.test');
      const { body: c } = await login('sessions-user1@triomphe.test');

      const res = await request(app)
        .post('/api/auth/sessions/revoke-others')
        .set('Authorization', `Bearer ${a.token}`);
      expect(res.status).toBe(200);
      expect(res.body.revoked).toBe(2);

      const meA = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${a.token}`);
      expect(meA.status).toBe(200);

      const meB = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${b.token}`);
      expect(meB.status).toBe(401);

      const meC = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${c.token}`);
      expect(meC.status).toBe(401);
    });
  });

  describe('Compatibilidad', () => {
    test('POST /auth/logout revoca la sesión actual', async () => {
      const { body: a } = await login('sessions-user1@triomphe.test');

      const logoutRes = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${a.token}`);
      expect(logoutRes.status).toBe(200);

      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${a.token}`);
      expect(me.status).toBe(401);
    });

    test('tokenVersion sigue invalidando tokens correctamente (change-password revoca las demás sesiones, no la actual)', async () => {
      const { body: a } = await login('sessions-user1@triomphe.test');
      const { body: b } = await login('sessions-user1@triomphe.test');

      const changeRes = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ currentPassword: 'Password123', newPassword: 'NewPassword456' });
      expect(changeRes.status).toBe(200);
      expect(changeRes.body.token).toBeDefined();

      // El token viejo de la sesión A quedó invalidado por el bump de tokenVersion...
      const oldA = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${a.token}`);
      expect(oldA.status).toBe(401);

      // ...pero el token REEMITIDO para esa misma sesión sigue funcionando.
      const newA = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${changeRes.body.token}`);
      expect(newA.status).toBe(200);

      // La sesión B (otro dispositivo) quedó invalidada, tanto por tokenVersion como por revocación explícita.
      const meB = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${b.token}`);
      expect(meB.status).toBe(401);

      // Revertir para no afectar otros tests de este archivo.
      await user1.update({ password: await hashPassword('Password123') });
    });

    test('un token sin claim sid (emitido antes de esta feature) sigue autenticando si tokenVersion coincide', async () => {
      const fresh = await User.findByPk(user1.id);
      const legacyToken = jwt.sign(
        { id: fresh.id, role: fresh.role, tokenVersion: fresh.tokenVersion },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${legacyToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Seguridad', () => {
    test('los endpoints de sesiones requieren autenticación', async () => {
      const [list, del, revokeOthers, logoutRes] = await Promise.all([
        request(app).get('/api/auth/sessions'),
        request(app).delete('/api/auth/sessions/1'),
        request(app).post('/api/auth/sessions/revoke-others'),
        request(app).post('/api/auth/logout'),
      ]);

      expect(list.status).toBe(401);
      expect(del.status).toBe(401);
      expect(revokeOthers.status).toBe(401);
      expect(logoutRes.status).toBe(401);
    });
  });
});
