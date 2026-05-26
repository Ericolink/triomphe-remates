export const safeBlobUrl = (url) => {
  if (typeof url !== 'string') return '';
  if (!url.startsWith('blob:')) return '';
  return url;
};
