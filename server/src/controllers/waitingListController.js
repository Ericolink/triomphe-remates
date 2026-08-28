const { Op } = require('sequelize');
const { PropertyAlert } = require('../models/index');
const { validateEmail, validatePhone } = require('../utils/validators');
const { paginate } = require('../utils/pagination');
const { logAudit } = require('../utils/audit');
const { ApiError } = require('../middleware/errorHandler');
const { VALID_CITIES, VALID_TYPES, VALID_BUSINESS_LINES } = require('../utils/propertyAlertValidation');

// Lista de espera de clientes — CRUD administrativo separado de alertController.js (flujo
// público sin auth) a propósito, aunque ambos operan sobre el mismo modelo PropertyAlert
// (ver migración 20260813000004). Todas las rutas de acá fuerzan `source: 'staff'`.

function validateEntryFields(body) {
  const { name, phone, email, city, type, businessLine, minPrice, maxPrice } = body;

  if (!name || !name.trim()) return { error: 'Nombre es requerido' };
  if (!phone || !validatePhone(phone))
    return { error: 'Teléfono inválido — usa 10 dígitos, con o sin +52' };
  if (email && !validateEmail(email)) return { error: 'Email inválido' };
  if (city && !VALID_CITIES.includes(city))
    return { error: `Ciudad inválida. Valores permitidos: ${VALID_CITIES.join(', ')}` };
  if (type && !VALID_TYPES.includes(type))
    return { error: `Tipo inválido. Valores permitidos: ${VALID_TYPES.join(', ')}` };
  if (businessLine && !VALID_BUSINESS_LINES.includes(businessLine))
    return {
      error: `Línea de negocio inválida. Valores permitidos: ${VALID_BUSINESS_LINES.join(', ')}`,
    };
  if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
    if (!Number.isFinite(Number(minPrice)) || Number(minPrice) < 0)
      return { error: 'Monto mínimo inválido' };
  }
  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
    if (!Number.isFinite(Number(maxPrice)) || Number(maxPrice) < 0)
      return { error: 'Monto máximo inválido' };
  }

  return {
    values: {
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : null,
      city: city || null,
      state: body.state ? body.state.trim() : null,
      type: type || null,
      businessLine: businessLine || null,
      minPrice: minPrice !== undefined && minPrice !== null && minPrice !== '' ? Number(minPrice) : null,
      maxPrice: maxPrice !== undefined && maxPrice !== null && maxPrice !== '' ? Number(maxPrice) : null,
    },
  };
}

// GET /api/waiting-list — filtros: city, state, amount (cae dentro de [minPrice,maxPrice]
// de la fila, mismo criterio que alertService.notifyMatchingAlerts), name, phone, businessLine.
const getWaitingList = async (req, res) => {
  const { page = 1, limit = 30, city, state, amount, name, phone, businessLine } = req.query;
  const where = { source: 'staff' };

  if (city) where.city = city;
  if (businessLine) where.businessLine = businessLine;
  if (state) where.state = { [Op.like]: `%${state}%` };
  if (name) where.name = { [Op.like]: `%${name}%` };
  if (phone) where.phone = { [Op.like]: `%${phone}%` };
  if (amount !== undefined && amount !== '') {
    const parsed = Number(amount);
    if (Number.isFinite(parsed)) {
      where[Op.and] = [
        { [Op.or]: [{ minPrice: null }, { minPrice: { [Op.lte]: parsed } }] },
        { [Op.or]: [{ maxPrice: null }, { maxPrice: { [Op.gte]: parsed } }] },
      ];
    }
  }

  const result = await paginate(PropertyAlert, {
    page,
    limit,
    where,
    order: [['createdAt', 'DESC']],
  });

  return res.json(result);
};

// POST /api/waiting-list
const createWaitingListEntry = async (req, res) => {
  const { error, values } = validateEntryFields(req.body);
  if (error) throw new ApiError(400, error);

  const entry = await PropertyAlert.create({ ...values, source: 'staff' });
  logAudit(req, 'create', 'alert', entry.id, { name: entry.name, source: 'staff' });

  return res.status(201).json({ message: 'Cliente agregado a la lista de espera', data: entry });
};

// PUT /api/waiting-list/:id
const updateWaitingListEntry = async (req, res) => {
  const entry = await PropertyAlert.findOne({ where: { id: req.params.id, source: 'staff' } });
  if (!entry) throw new ApiError(404, 'Registro no encontrado');

  const { error, values } = validateEntryFields(req.body);
  if (error) throw new ApiError(400, error);

  await entry.update(values);
  logAudit(req, 'update', 'alert', entry.id, { name: entry.name });

  return res.json({ message: 'Registro actualizado', data: entry });
};

// DELETE /api/waiting-list/:id
const deleteWaitingListEntry = async (req, res) => {
  const entry = await PropertyAlert.findOne({ where: { id: req.params.id, source: 'staff' } });
  if (!entry) throw new ApiError(404, 'Registro no encontrado');

  await entry.destroy();
  logAudit(req, 'delete', 'alert', req.params.id, { name: entry.name });

  return res.json({ message: 'Registro eliminado' });
};

module.exports = {
  getWaitingList,
  createWaitingListEntry,
  updateWaitingListEntry,
  deleteWaitingListEntry,
};
