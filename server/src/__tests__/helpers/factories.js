// Factories compartidas para tests de integración — evitan repetir el boilerplate de
// crear User/Property/Lead con valores válidos en cada archivo de test.
const { generateToken, hashPassword } = require('../../utils/helpers');
const { User, Property, Lead, Deal } = require('../../models/index');

let counter = 0;
const nextId = () => ++counter;
// Sufijo único por proceso de test — evita colisiones con filas huérfanas que hayan
// quedado de una corrida anterior interrumpida a medias (p.ej. un beforeAll que falló
// antes de que su afterAll pudiera limpiar), ya que `email` es la única columna con
// constraint único entre las factories.
const RUN_TAG = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function createUser(overrides = {}) {
  const n = nextId();
  return User.create({
    name: overrides.name || `Usuario Test ${n}`,
    email: overrides.email || `usuario-test-${RUN_TAG}-${n}@triomphe.test`,
    password: overrides.password || (await hashPassword('Password123')),
    role: overrides.role || 'admin',
    crmRole: overrides.crmRole ?? null,
    isActive: overrides.isActive ?? true,
    tokenVersion: overrides.tokenVersion ?? 0,
  });
}

// Genera el JWT tal como lo hace authController.login — mismo payload shape.
function authToken(user) {
  return generateToken({ id: user.id, role: user.role, tokenVersion: user.tokenVersion });
}

async function createProperty(overrides = {}) {
  const n = nextId();
  return Property.create({
    title: overrides.title ?? `Propiedad de prueba ${n}`,
    city: overrides.city ?? 'juarez',
    type: overrides.type ?? 'casa',
    status: overrides.status ?? 'disponible',
    price: overrides.price === undefined ? 100000 + n * 1000 : overrides.price,
    ...overrides,
  });
}

async function createLead(overrides = {}) {
  const n = nextId();
  return Lead.create({
    name: overrides.name ?? `Prospecto de prueba ${n}`,
    phone: overrides.phone ?? '6561234567',
    ...overrides,
  });
}

// Un Deal requiere lead+property ya existentes (FKs allowNull:false) y closedAt/amount
// válidos — no hay valores por defecto sensatos como en las otras factories, así que el
// caller siempre debe pasar leadId/propertyId.
async function createDeal(overrides = {}) {
  const n = nextId();
  return Deal.create({
    amount: overrides.amount === undefined ? 1000000 + n * 1000 : overrides.amount,
    closedAt: overrides.closedAt ?? new Date(),
    ...overrides,
  });
}

module.exports = { createUser, authToken, createProperty, createLead, createDeal };
