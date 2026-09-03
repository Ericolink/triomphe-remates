// Jerarquía coordinador_ventas -> asesor_ventas — User.supervisorId solo tiene sentido en
// un usuario asesor_ventas, y solo puede apuntar a un usuario coordinador_ventas. Ver
// server/src/services/userService.js (resolveSupervisorId).
const request = require('supertest');
const app = require('../../app');
const { sequelize, User } = require('../models/index');
const { createUser, authToken } = require('./helpers/factories');

describe('supervisorId — POST/PUT /api/users', () => {
  let admin, coordinador, otroCoordinador, asesor, adminToken;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    coordinador = await createUser({ role: 'coordinador_ventas' });
    otroCoordinador = await createUser({ role: 'coordinador_ventas' });
    asesor = await createUser({ role: 'asesor_ventas' });
    adminToken = authToken(admin);
  });

  afterAll(async () => {
    await User.destroy({
      where: { id: [admin.id, coordinador.id, otroCoordinador.id, asesor.id] },
      force: true,
    });
    await sequelize.close();
  });

  const createdUserIds = [];
  afterEach(async () => {
    if (createdUserIds.length) {
      await User.destroy({ where: { id: createdUserIds }, force: true });
      createdUserIds.length = 0;
    }
  });

  test('crea un asesor con un coordinador asignado', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Asesor con coordinador',
        email: `asesor-sup-${Date.now()}@triomphe.test`,
        password: 'Password123',
        role: 'asesor_ventas',
        supervisorId: coordinador.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.supervisorId).toBe(coordinador.id);
    createdUserIds.push(res.body.data.id);
  });

  test('rechaza supervisorId en un usuario que no es asesor_ventas', async () => {
    const email = `coord-sup-${Date.now()}@triomphe.test`;
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Coordinador con supervisor inválido',
        email,
        password: 'Password123',
        role: 'coordinador_ventas',
        supervisorId: otroCoordinador.id,
      });

    expect(res.status).toBe(400);
    const created = await User.findOne({ where: { email } });
    expect(created).toBeNull();
  });

  test('rechaza un supervisorId que no apunta a un coordinador_ventas', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Asesor con supervisor inválido',
        email: `asesor-badsup-${Date.now()}@triomphe.test`,
        password: 'Password123',
        role: 'asesor_ventas',
        supervisorId: asesor.id, // asesor, no coordinador
      });

    expect(res.status).toBe(400);
  });

  test('actualiza el coordinador asignado de un asesor existente', async () => {
    const asesorToEdit = await createUser({ role: 'asesor_ventas' });
    createdUserIds.push(asesorToEdit.id);

    const res = await request(app)
      .put(`/api/users/${asesorToEdit.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supervisorId', String(coordinador.id));

    expect(res.status).toBe(200);
    const stored = await User.findByPk(asesorToEdit.id);
    expect(stored.supervisorId).toBe(coordinador.id);
  });

  test('quitar el coordinador de un asesor (supervisorId vacío) lo deja en null', async () => {
    const asesorToEdit = await createUser({ role: 'asesor_ventas', supervisorId: coordinador.id });
    createdUserIds.push(asesorToEdit.id);

    const res = await request(app)
      .put(`/api/users/${asesorToEdit.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supervisorId', '');

    expect(res.status).toBe(200);
    const stored = await User.findByPk(asesorToEdit.id);
    expect(stored.supervisorId).toBeNull();
  });

  test('ascender un asesor a coordinador_ventas limpia su supervisorId automáticamente', async () => {
    const asesorToPromote = await createUser({ role: 'asesor_ventas', supervisorId: coordinador.id });
    createdUserIds.push(asesorToPromote.id);

    const res = await request(app)
      .put(`/api/users/${asesorToPromote.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('role', 'coordinador_ventas');

    expect(res.status).toBe(200);
    const stored = await User.findByPk(asesorToPromote.id);
    expect(stored.role).toBe('coordinador_ventas');
    expect(stored.supervisorId).toBeNull();
  });
});
