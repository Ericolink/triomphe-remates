import { create } from 'zustand';

const MAX = 3;
const STORAGE_KEY = 'triomphe_comparator';

const readStorage = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};

// Store compartido — así el botón de cada tarjeta y la barra flotante
// reaccionan al instante a los mismos cambios (antes cada uno tenía su
// propio useState desincronizado, leído una sola vez de localStorage)
const useComparatorStore = create((set, get) => ({
  items: readStorage(),

  isInComparator: (id) => get().items.some((p) => p.id === id),

  toggle: (property) => {
    const { items } = get();
    let next;
    if (items.some((p) => p.id === property.id)) {
      next = items.filter((p) => p.id !== property.id);
    } else {
      if (items.length >= MAX) return;
      next = [...items, {
        id: property.id, slug: property.slug, title: property.title,
        price: property.price, city: property.city, type: property.type,
        status: property.status, images: property.images?.slice(0, 1) ?? [],
        squareMeters: property.squareMeters, constructionMeters: property.constructionMeters,
        terrainMeters: property.terrainMeters, bedrooms: property.bedrooms,
        bathrooms: property.bathrooms, address: property.address,
      }];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    set({ items: next });
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ items: [] });
  },
}));

export default function useComparator() {
  const { items, toggle, clear, isInComparator } = useComparatorStore();
  return { items, toggle, clear, isInComparator, count: items.length, isFull: items.length >= MAX };
}
