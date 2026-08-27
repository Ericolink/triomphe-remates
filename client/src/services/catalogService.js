import api from './api';

// Descarga pública del catálogo (sitio principal) — POST porque manda datos de contacto en
// el body; el backend registra un Lead antes de generar el archivo (ver
// exportController.exportCatalogPDF). Solo PDF — a pedido del dueño del negocio, el catálogo
// público ya no se ofrece en Excel.
export const downloadCatalogPDF = async (data) => {
  const response = await api.post('/export/catalog/pdf', data, { responseType: 'blob' });
  return response.data;
};
