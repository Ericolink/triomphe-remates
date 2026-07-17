import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createElement } from 'react';
import { getLeads } from '../services/leadService';
import useAuthStore from '../store/authStore';
import LeadToast from '../components/ui/LeadToast';

export default function useNotifications() {
  const { isAuthenticated, token } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const initializedRef = useRef(false);

  // Carga inicial — establece el conteo y la lista de partida
  const { data } = useQuery({
    queryKey: ['leads-notifications'],
    queryFn: () => getLeads({ status: 'nuevo', limit: 10 }),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!data || initializedRef.current) return;
    initializedRef.current = true;
    setUnreadCount(data.pagination?.total ?? 0);
    setNotifications(data.data ?? []);
  }, [data]);

  // Conexión en tiempo real — el servidor empuja un evento por cada lead nuevo.
  // Se espera a que la página esté completamente cargada antes de abrir el EventSource
  // para evitar el mensaje "interrupted while the page was loading" de Firefox.
  useEffect(() => {
    if (!isAuthenticated || !token) return undefined;

    let source = null;

    const connect = () => {
      source = new EventSource(
        `${window.location.origin}/api/leads/stream?token=${encodeURIComponent(token)}`
      );

      source.addEventListener('new-lead', (event) => {
        const lead = JSON.parse(event.data);
        setUnreadCount((count) => count + 1);
        setNotifications((prev) => [lead, ...prev].slice(0, 10));
        toast.custom((t) => createElement(LeadToast, { t, diff: 1, lead }), { duration: 5000 });
      });
    };

    if (document.readyState === 'complete') {
      connect();
    } else {
      window.addEventListener('load', connect, { once: true });
    }

    return () => {
      window.removeEventListener('load', connect);
      source?.close();
    };
  }, [isAuthenticated, token]);

  const clearNotifications = () => {
    setUnreadCount(0);
  };

  return { unreadCount, notifications, clearNotifications };
}
