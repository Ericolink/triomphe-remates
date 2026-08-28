// Valores permitidos compartidos por cualquier código que cree/valide filas de PropertyAlert
// (waitingListController.js y leadController.js's sendLeadToWaitingList) — evita una tercera
// copia de estos arrays.
const VALID_CITIES = ['juarez', 'chihuahua', 'queretaro'];
const VALID_TYPES = ['casa', 'departamento', 'terreno', 'local', 'bodega'];
const VALID_BUSINESS_LINES = ['remate', 'credito', 'renta', 'contado', 'inversion'];

module.exports = { VALID_CITIES, VALID_TYPES, VALID_BUSINESS_LINES };
