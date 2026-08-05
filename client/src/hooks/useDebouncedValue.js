import { useEffect, useState } from 'react';

// Retrasa la propagación de `value` — usado para no disparar una consulta al backend
// en cada tecla de un campo de búsqueda (property picker, listados con `search` remoto).
export default function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
