const API_HOST = import.meta.env.VITE_API_URL?.replace('/api', '');

// Inserta transformaciones de Cloudinary (formato/calidad automáticos + resize)
// para no servir el original a pantalla completa donde solo se muestra una
// miniatura — las rutas locales (uploads viejos) solo se prefijan con la API.
export const buildImageUrl = (url, width) => {
  if (!url) return null;
  if (!url.startsWith('http')) return `${API_HOST}${url}`;
  if (!width || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
};
