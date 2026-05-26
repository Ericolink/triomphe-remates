import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createElement } from 'react';
import { getLeads } from '../services/leadService';
import useAuthStore from '../store/authStore';
import LeadToast from '../components/ui/LeadToast';

export default function useNotifications() {
  const { isAuthenticated } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const lastCountRef = useRef(null);

  const { data } = useQuery({
    queryKey: ['leads-notifications'],
    queryFn: () => getLeads({ status: 'nuevo', limit: 10 }),
    enabled: isAuthenticated,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!data) return;

    const currentCount = data.pagination?.total ?? 0;
    const leads = data.data ?? [];

    // Primera carga — solo guardar el count sin notificar
    if (lastCountRef.current === null) {
      lastCountRef.current = currentCount;
      setUnreadCount(currentCount);
      setNotifications(leads);
      return;
    }

    // Si llegaron leads nuevos desde la última revisión
    if (currentCount > lastCountRef.current) {
      const diff = currentCount - lastCountRef.current;
      toast.custom(
        (t) => createElement(LeadToast, { t, diff, lead: leads[0] ?? null }),
        { duration: 5000 }
      );
    }

    lastCountRef.current = currentCount;
    setUnreadCount(currentCount);
    setNotifications(leads);
  }, [data]);

  const clearNotifications = () => {
    setUnreadCount(0);
  };

  return { unreadCount, notifications, clearNotifications };
}