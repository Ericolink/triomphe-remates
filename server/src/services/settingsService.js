// Único punto que lee/escribe el modelo Setting directamente — cualquier controller que
// necesite un flag global debe pasar por getSetting/setSetting, nunca por Setting.* a mano
// (mismo criterio que analyticsService.js para Analytics).
//
// Sin caché a propósito: la tabla `settings` es minúscula (una fila por flag) y se lee con
// SELECT por primary key, así que el costo de ir siempre a BD es despreciable frente al
// riesgo real de una caché en memoria — con más de un proceso Node corriendo (o incluso
// uno solo, tras un cambio reciente), un admin podría ver "DESACTIVADO" en el panel
// mientras el backend seguía sirviendo el PDF con un valor cacheado desactualizado. Cada
// request de descarga consulta el valor vigente en ese instante.
const { Setting } = require('../models/index');

const INVENTORY_DOWNLOAD_ENABLED_KEY = 'inventoryDownloadEnabled';

async function getSetting(key, defaultValue = null) {
  const row = await Setting.findByPk(key);
  if (!row || row.value === null) return defaultValue;
  try {
    return JSON.parse(row.value);
  } catch {
    return defaultValue;
  }
}

// upsert (no create/update separado): la fila puede o no existir todavía — mismo caso que
// la siembra de la migración vs. un flag nuevo que un admin active por primera vez.
async function setSetting(key, value, userId = null) {
  const serialized = JSON.stringify(value);
  const [row] = await Setting.findOrBuild({ where: { key } });
  row.value = serialized;
  row.updatedByUserId = userId;
  await row.save();
  return row;
}

// true por default: si la fila no existe (BD recién creada antes de correr la migración de
// siembra, o un flag futuro sin sembrar), el comportamiento debe seguir siendo el actual
// (descarga entregada) — nunca romper el flujo existente por ausencia de configuración.
async function isInventoryDownloadEnabled() {
  return getSetting(INVENTORY_DOWNLOAD_ENABLED_KEY, true);
}

module.exports = {
  getSetting,
  setSetting,
  isInventoryDownloadEnabled,
  INVENTORY_DOWNLOAD_ENABLED_KEY,
};
