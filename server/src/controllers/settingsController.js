// Endpoints admin-only para leer/escribir flags de configuración global. A propósito NO
// es un CRUD genérico de `key` arbitraria — cada flag expuesto tiene su propio par de
// handlers con su propia validación, para no dejarle a un admin (o a un bug de frontend)
// la posibilidad de escribir una `key` no contemplada vía API. Si se agrega un segundo
// flag, se agrega su propio par get/update aquí, reutilizando settingsService.
const {
  getSetting,
  setSetting,
  isInventoryDownloadEnabled,
  INVENTORY_DOWNLOAD_ENABLED_KEY,
  isPublicPropertiesEnabled,
  PUBLIC_PROPERTIES_ENABLED_KEY,
} = require('../services/settingsService');
const { logAudit } = require('../utils/audit');
const { ApiError } = require('../middleware/errorHandler');

// GET /api/settings/inventory-download
const getInventoryDownloadSetting = async (req, res) => {
  const enabled = await isInventoryDownloadEnabled();
  res.json({ enabled });
};

// PUT /api/settings/inventory-download
const updateInventoryDownloadSetting = async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    throw new ApiError(400, 'enabled debe ser true o false');
  }

  const before = await getSetting(INVENTORY_DOWNLOAD_ENABLED_KEY, true);
  await setSetting(INVENTORY_DOWNLOAD_ENABLED_KEY, enabled, req.user.id);

  logAudit(req, 'update', 'setting', null, {
    key: INVENTORY_DOWNLOAD_ENABLED_KEY,
    before,
    after: enabled,
  });

  res.json({ enabled });
};

// GET /api/settings/public-properties
const getPublicPropertiesSetting = async (req, res) => {
  const enabled = await isPublicPropertiesEnabled();
  res.json({ enabled });
};

// PUT /api/settings/public-properties
const updatePublicPropertiesSetting = async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    throw new ApiError(400, 'enabled debe ser true o false');
  }

  const before = await getSetting(PUBLIC_PROPERTIES_ENABLED_KEY, true);
  await setSetting(PUBLIC_PROPERTIES_ENABLED_KEY, enabled, req.user.id);

  logAudit(req, 'update', 'setting', null, {
    key: PUBLIC_PROPERTIES_ENABLED_KEY,
    before,
    after: enabled,
  });

  res.json({ enabled });
};

module.exports = {
  getInventoryDownloadSetting,
  updateInventoryDownloadSetting,
  getPublicPropertiesSetting,
  updatePublicPropertiesSetting,
};
