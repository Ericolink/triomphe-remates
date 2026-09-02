// Factories compartidas para tests de integración — evitan repetir el boilerplate de
// crear User/Property/Lead con valores válidos en cada archivo de test.
const { generateToken, hashPassword } = require('../../utils/helpers');
const {
  User,
  Property,
  Lead,
  Deal,
  Campaign,
  Analytics,
  LeadProperty,
  Task,
  Appointment,
} = require('../../models/index');

let counter = 0;
const nextId = () => ++counter;
// Sufijo único por proceso de test — evita colisiones con filas huérfanas que hayan
// quedado de una corrida anterior interrumpida a medias (p.ej. un beforeAll que falló
// antes de que su afterAll pudiera limpiar), ya que `email` es la única columna con
// constraint único entre las factories.
const RUN_TAG = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
// Mismo problema para `phone`: leadController ahora rechaza teléfonos duplicados entre
// prospectos (ver findDuplicatePhoneLead), y Jest corre archivos de test en paralelo contra
// la misma DB de test — si todos los leads de prueba usaran el mismo '656...' fijo, un
// archivo podía chocar con un lead que otro archivo dejó vivo momentáneamente. 10 dígitos
// exactos (formato que exige validatePhone): '6' + 6 dígitos del timestamp (varían por
// proceso/momento) + 3 de `n` (varían por llamada dentro del mismo proceso).
const uniquePhone = (n) => `6${Date.now().toString().slice(-6)}${String(n).slice(-3).padStart(3, '0')}`;

async function createUser(overrides = {}) {
  const n = nextId();
  return User.create({
    name: overrides.name || `Usuario Test ${n}`,
    email: overrides.email || `usuario-test-${RUN_TAG}-${n}@triomphe.test`,
    password: overrides.password || (await hashPassword('Password123')),
    role: overrides.role || 'admin',
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
    phone: overrides.phone ?? uniquePhone(n),
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

async function createCampaign(overrides = {}) {
  const n = nextId();
  return Campaign.create({
    platform: overrides.platform ?? 'facebook',
    name: overrides.name ?? `Campaña de prueba ${n}`,
    startDate: overrides.startDate ?? new Date(),
    ...overrides,
  });
}

// Genera un UUID v4 con forma válida (no criptográficamente fuerte, no hace falta para
// datos de prueba) — evita depender del paquete `uuid` solo para los tests.
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function createAnalyticsEvent(overrides = {}) {
  return Analytics.create({
    event: overrides.event ?? 'page_view',
    visitorId: overrides.visitorId === undefined ? uuid() : overrides.visitorId,
    sessionId: overrides.sessionId === undefined ? uuid() : overrides.sessionId,
    path: overrides.path ?? '/',
    device: overrides.device ?? 'desktop',
    isBot: overrides.isBot ?? false,
    ...overrides,
  });
}

async function createLeadProperty(overrides = {}) {
  return LeadProperty.create({ ...overrides });
}

// Task requiere leadId/assignedToUserId (FKs allowNull:false) — sin valores por defecto
// sensatos, igual que createDeal.
async function createTask(overrides = {}) {
  return Task.create({
    type: overrides.type ?? 'llamar',
    dueDate: overrides.dueDate ?? new Date(),
    done: overrides.done ?? false,
    ...overrides,
  });
}

// Appointment requiere leadId (FK allowNull:false) — propertyId es opcional.
async function createAppointment(overrides = {}) {
  return Appointment.create({
    scheduledAt: overrides.scheduledAt ?? new Date(),
    status: overrides.status ?? 'programada',
    ...overrides,
  });
}

module.exports = {
  createUser,
  authToken,
  createProperty,
  createLead,
  createDeal,
  createCampaign,
  createAnalyticsEvent,
  createLeadProperty,
  createTask,
  createAppointment,
  uuid,
};
