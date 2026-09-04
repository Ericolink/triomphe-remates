import api from './api';

// Solicitud pública del catálogo (sitio principal) — POST porque manda datos de contacto en
// el body; el backend siempre registra un Lead antes de responder (ver
// exportController.exportCatalogPDF). Solo PDF — a pedido del dueño del negocio, el catálogo
// público ya no se ofrece en Excel.
//
// La respuesta puede ser el PDF binario O un JSON de confirmación, según el flag admin
// inventoryDownloadEnabled (ver SettingsPage) — `responseType: 'blob'` es necesario para
// poder recibir el binario, así que el JSON también llega envuelto en un Blob; se devuelve
// la respuesta completa (no solo `.data`) para que el caller decida cuál es por
// Content-Type, en vez de adivinar por el tamaño o el contenido.
export const requestCatalogPDF = async (data) => {
  return api.post('/export/catalog/pdf', data, { responseType: 'blob' });
};

// Lectura pública (sin auth) del mismo flag que SettingsPage — usada por CatalogDownloadForm
// para decidir el texto del CTA ("Descargar PDF del inventario" vs. "Solicitar inventario")
// ANTES de que el usuario envíe el formulario. Ver routes/settings.js: expone el mismo
// booleano por una ruta separada sin authenticate/authorize.
export const getInventoryDownloadStatus = async () => {
  const { data } = await api.get('/settings/inventory-download/status');
  return data;
};
