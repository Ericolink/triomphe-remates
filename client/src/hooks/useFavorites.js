import { useState } from 'react';

const STORAGE_KEY = 'triomphe_favorites';

const readStorage = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

export default function useFavorites() {
  const [favorites, setFavorites] = useState(readStorage);

  const isFavorite = (id) => favorites.some((f) => f.id === id);

  const toggle = (property) => {
    setFavorites((prev) => {
      const next = isFavorite(property.id)
        ? prev.filter((f) => f.id !== property.id)
        : [...prev, {
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
      return next;
    });
  };

  const remove = (id) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setFavorites([]);
  };

  return { favorites, isFavorite, toggle, remove, clear, count: favorites.length };
}
