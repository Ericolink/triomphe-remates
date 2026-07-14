import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Mail, Home, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { getDashboard } from '../../services/analyticsService';
import { getLeads } from '../../services/leadService';
import { getFeedbacks } from '../../services/feedbackService';
import { getProperties } from '../../services/propertyService';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import { staggerContainer, fadeInUp, fadeIn } from '../../utils/animations';
import { CITY_LABELS, STATUS_LABELS, STATUS_VARIANTS } from '../../utils/constants';
import { formatPrice } from '../../utils/formatters';

// El Dashboard responde solo "¿cómo va el negocio hoy y hay algo que atender?".
// Las gráficas y desgloses detallados viven en /admin/estadisticas.
export default function DashboardPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 60000,
  });
  const d = data?.data;

  const { data: newLeadsData } = useQuery({
    queryKey: ['dashboard-new-leads'],
    queryFn: () => getLeads({ status: 'nuevo', limit: 5 }),
  });
  const newLeads = newLeadsData?.data ?? [];

  const { data: newFeedbackData } = useQuery({
    queryKey: ['dashboard-new-feedback'],
    queryFn: () => getFeedbacks({ status: 'nuevo', limit: 5 }),
  });
  const newFeedback = newFeedbackData?.data ?? [];

  const { data: recentPropertiesData } = useQuery({
    queryKey: ['dashboard-recent-properties'],
    queryFn: () => getProperties({ limit: 5 }),
  });
  const recentProperties = recentPropertiesData?.data ?? [];

  if (isLoading) return <Spinner size="lg" className="py-20" />;

  const stats = [
    { label: 'Leads nuevos', value: d?.leads?.new ?? 0, icon: <Users size={22} />, color: 'bg-yellow-500',
      onClick: () => navigate('/admin/leads', { state: { status: 'nuevo' } }) },
    { label: 'Mensajes pendientes', value: newFeedback.length, icon: <Mail size={22} />, color: 'bg-blue-900',
      onClick: () => navigate('/admin/buzon') },
    { label: 'Propiedades disponibles', value: d?.properties?.disponible ?? 0, icon: <Home size={22} />, color: 'bg-green-600',
      onClick: () => navigate('/admin/propiedades', { state: { status: 'disponible' } }) },
  ];

  const attentionItems = [
    ...(newLeads.length > 0 ? [{
      key: 'leads',
      text: `${newLeads.length} lead${newLeads.length !== 1 ? 's' : ''} nuevo${newLeads.length !== 1 ? 's' : ''} sin contactar`,
      onClick: () => navigate('/admin/leads', { state: { status: 'nuevo' } }),
    }] : []),
    ...(newFeedback.length > 0 ? [{
      key: 'feedback',
      text: `${newFeedback.length} mensaje${newFeedback.length !== 1 ? 's' : ''} nuevo${newFeedback.length !== 1 ? 's' : ''} en el buzón`,
      onClick: () => navigate('/admin/buzon'),
    }] : []),
  ];

  return (
    <div>
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Resumen del día</p>
      </motion.div>

      {/* Stats */}
      <motion.div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" variants={staggerContainer} initial="hidden" animate="visible">
        {stats.map(({ label, value, icon, color, onClick }) => (
          <motion.div key={label} variants={fadeInUp} whileHover={{ y: -4, transition: { duration: 0.2 } }}
            onClick={onClick} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
            className="bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#2e3650] transition-shadow cursor-pointer hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800">
            <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-white mb-3`}>{icon}</div>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
              {label}<span className="text-blue-500 dark:text-blue-400"> · ver detalle</span>
            </p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={fadeInUp} initial="hidden" animate="visible"
        className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650] mb-6">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Necesita tu atención</h2>
        {attentionItems.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Todo al día — no hay pendientes.</p>
        ) : (
          <div className="space-y-2">
            {attentionItems.map(({ key, text, onClick }) => (
              <button key={key} onClick={onClick}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors text-left">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{text}</span>
                <ArrowRight size={16} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div variants={fadeInUp} initial="hidden" animate="visible"
        className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Building2 size={16} className="text-blue-700 dark:text-blue-400" /> Propiedades recientes
          </h2>
          <button onClick={() => navigate('/admin/propiedades')}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
            Ver todas
          </button>
        </div>
        {recentProperties.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Todavía no hay propiedades cargadas.</p>
        ) : (
          <div className="space-y-2">
            {recentProperties.map((p) => (
              <button key={p.id} onClick={() => navigate(`/admin/propiedades/${p.id}/editar`)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-[#2e3650]/40 transition-colors text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{p.title}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{CITY_LABELS[p.city]} · {formatPrice(p.price)}</p>
                </div>
                <Badge variant={STATUS_VARIANTS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
