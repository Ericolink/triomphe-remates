import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent, ANALYTICS_EVENTS } from '../utils/analytics';

// Dispara un page_view en cada cambio de ruta pública. Se monta una sola vez en
// PublicLayout — AdminLayout no lo usa, así que el panel administrativo nunca queda
// instrumentado (PASO 5 del brief: "No registrar rutas administrativas").
export default function usePageViewTracking() {
  const { pathname } = useLocation();

  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.PAGE_VIEW, { path: pathname });
  }, [pathname]);
}
