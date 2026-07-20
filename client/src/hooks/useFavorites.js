import { create } from 'zustand';

const STORAGE_KEY = 'triomphe_favorites';

const readStorage = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};

// Store compartido — Navbar (contador), FavoriteButton y FavoritesPage
// comparten el mismo estado en vez de cada uno leer localStorage por separado
// (antes cada instancia tenía su propio useState desincronizado, igual que
// ocurría con useComparator antes de migrarlo a Zustand)
const useFavoritesStore = create((set, get) => ({
  favorites: readStorage(),

  isFavorite: (id) => get().favorites.some((f) => f.id === id),

  toggle: (property) => {
    const { favorites } = get();
    const next = favorites.some((f) => f.id === property.id)
      ? favorites.filter((f) => f.id !== property.id)
      : [...favorites, {
          id: property.id,
          slug: property.slug,
          title: property.title,
          price: property.price,
          city: property.city,
          status: property.status,
          type: property.type,
          images: property.images?.slice(0, 1) ?? [],
          squareMeters: property.squareMeters,
          constructionMeters: property.constructionMeters,
          terrainMeters: property.terrainMeters,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          isFeatured: property.isFeatured,
        }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    set({ favorites: next });
  },

  remove: (id) => {
    const next = get().favorites.filter((f) => f.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    set({ favorites: next });
  },

  // Aplica campos dinámicos revalidados contra el servidor (precio, status)
  // sobre el snapshot local, sin tocar el resto de los campos guardados.
  patchMany: (updates) => {
    if (!updates.length) return;
    const map = new Map(updates.map((u) => [u.id, u]));
    const next = get().favorites.map((f) => (map.has(f.id) ? { ...f, ...map.get(f.id) } : f));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    set({ favorites: next });
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ favorites: [] });
  },
}));

export default function useFavorites() {
  const { favorites, isFavorite, toggle, remove, clear, patchMany } = useFavoritesStore();
  return { favorites, isFavorite, toggle, remove, clear, patchMany, count: favorites.length };
}
