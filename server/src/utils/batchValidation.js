// Guardarraíl compartido para endpoints batch (PATCH/DELETE /batch, etc.) que reciben un
// arreglo de IDs del cliente y lo usan para construir un WHERE id IN (...). Antes cada
// controller repetía su propio `Array.isArray(ids) && ids.length` sin límite superior —
// nada impedía una solicitud con miles de IDs. Se valida todo ANTES de tocar la base de
// datos: nunca vale la pena construir una consulta enorme para descubrir después que la
// solicitud era inválida.
const MAX_BATCH_IDS = 100;

// Devuelve { error } (string, listo para res.status(400).json({ error })) o
// { ids } con los IDs normalizados a enteros positivos, en el mismo orden recibido.
function validateBatchIds(ids, { maxIds = MAX_BATCH_IDS } = {}) {
  if (!Array.isArray(ids)) return { error: 'ids debe ser un arreglo' };
  if (ids.length === 0) return { error: 'ids requeridos' };
  if (ids.length > maxIds) {
    return { error: `No se pueden procesar más de ${maxIds} elementos por solicitud` };
  }

  const normalized = [];
  for (const raw of ids) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return { error: `ID inválido: ${JSON.stringify(raw)}` };
    }
    normalized.push(id);
  }

  return { ids: normalized };
}

module.exports = { MAX_BATCH_IDS, validateBatchIds };
