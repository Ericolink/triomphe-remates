/**
 * Valida que una URL sea un blob URL seguro generado localmente.
 * Previene XSS al asegurarse que solo se usen blob: URLs.
 */
export const safeBlobUrl = (url) => {
  if (typeof url !== 'string') return '';
  if (!url.startsWith('blob:')) return '';
  return url;
};
