import { useState } from 'react';

const MAX = 3;
const STORAGE_KEY = 'triomphe_comparator';

const readStorage = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};

export default function useComparator() {
  const [items, setItems] = useState(readStorage);

  const isInComparator = (id) => items.some((p) => p.id === id);

  const toggle = (property) => {
    setItems((prev) => {
      if (isInComparator(property.id)) {
        const next = prev.filter((p) => p.id !== property.id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      }
      if (prev.length >= MAX) return prev;
      const snapshot = {
        id: property.id, slug: property.slug, title: property.title,
        price: property.price, city: property.city, type: property.type,
        status: property.status, images: property.images?.slice(0, 1) ?? [],
        squareMeters: property.squareMeters, constructionMeters: property.constructionMeters,
        terrainMeters: property.terrainMeters, bedrooms: property.bedrooms,
        bathrooms: property.bathrooms, address: property.address,
      };
      const next = [...prev, snapshot];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clear = () => { localStorage.removeItem(STORAGE_KEY); setItems([]); };

  return { items, toggle, clear, isInComparator, count: items.length, isFull: items.length >= MAX };
}
