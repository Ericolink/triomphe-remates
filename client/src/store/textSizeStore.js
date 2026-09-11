import { create } from 'zustand';

export const TEXT_SIZES = ['normal', 'large', 'xlarge'];
export const TEXT_SIZE_LABELS = {
  normal: 'Normal',
  large: 'Grande',
  xlarge: 'Muy grande',
};

// main.jsx aplica el tamaño persistido/por defecto a <html> de forma síncrona antes
// de montar React (mismo patrón que themeStore), así que este store solo lee ese
// estado del DOM ya correcto en vez de volver a decidirlo.
const getInitialTextSize = () => {
  const attr = document.documentElement.getAttribute('data-text-size');
  return TEXT_SIZES.includes(attr) ? attr : 'normal';
};

const useTextSizeStore = create((set) => ({
  textSize: getInitialTextSize(),
  setTextSize: (size) => {
    if (!TEXT_SIZES.includes(size)) return;
    if (size === 'normal') {
      document.documentElement.removeAttribute('data-text-size');
    } else {
      document.documentElement.setAttribute('data-text-size', size);
    }
    localStorage.setItem('textSize', size);
    set({ textSize: size });
  },
}));

export default useTextSizeStore;
