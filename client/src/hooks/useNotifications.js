import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createElement } from 'react';
import { getLeads } from '../services/leadService';
import useAuthStore from '../store/authStore';
import LeadToast from '../components/ui/LeadToast';

const API_URL = import.meta.env.VITE_API_URL;

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

  // Conexión en tiempo real — el servidor empuja un evento por cada lead nuevo
  useEffect(() => {
    if (!isAuthenticated || !token) return undefined;

    const source = new EventSource(`${API_URL}/leads/stream?token=${encodeURIComponent(token)}`);

    const handleNewLead = (event) => {
      const lead = JSON.parse(event.data);
      setUnreadCount((count) => count + 1);
      setNotifications((prev) => [lead, ...prev].slice(0, 10));
      toast.custom((t) => createElement(LeadToast, { t, diff: 1, lead }), { duration: 5000 });
    };

    source.addEventListener('new-lead', handleNewLead);

    return () => {
      source.removeEventListener('new-lead', handleNewLead);
      source.close();
    };
  }, [isAuthenticated, token]);

  const clearNotifications = () => {
    setUnreadCount(0);
  };

  return { unreadCount, notifications, clearNotifications };
}
