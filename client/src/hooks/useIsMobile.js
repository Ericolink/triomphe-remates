import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px)';

// Extraído de KanbanBoard (única fuente antes de LeadDetailPanel también necesitarlo) —
// determina el layout en el que arrancan las secciones colapsables del editor de
// prospectos y qué columna del Kanban se monta en celular.
export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isMobile;
}
