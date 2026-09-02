import { useNavigate } from 'react-router-dom';
import { Users, CalendarClock, Target, Sparkles, AlertCircle, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '../../../../utils/animations';
import { formatPrice } from '../../../../utils/formatters';

// Mismo patrón de tiles que OverviewSection.jsx (dashboard admin) — 6 números que resumen
// la cartera del asesor en los primeros segundos, cada uno clickeable hacia el CRM ya
// filtrado (el backend de /admin/crm ya scopea automáticamente a "mis prospectos").
export default function AsesorKpiRow({ d }) {
  const navigate = useNavigate();

  const kpis = [
    {
      label: 'Prospectos activos',
      value: d.prospectosActivos,
      icon: <Users size={22} />,
      color: 'bg-primary-900',
      onClick: () => navigate('/admin/crm?tab=prospectos'),
    },
    {
      label: 'Citas próximos 7 días',
      value: d.citasProximas7Dias.length,
      icon: <CalendarClock size={22} />,
      color: 'bg-accent-500',
      onClick: () => navigate('/admin/crm?tab=calendario'),
    },
    {
      label: 'Conversión',
      value: `${d.conversion.rate}%`,
      icon: <Target size={22} />,
      color: 'bg-green-600',
      onClick: () => navigate('/admin/crm?tab=prospectos&stage=venta_realizada'),
    },
    {
      label: 'Nuevos este mes',
      value: d.nuevos.esteMes,
      icon: <Sparkles size={22} />,
      color: 'bg-blue-600',
      onClick: () => navigate('/admin/crm?tab=prospectos'),
    },
    {
      label: 'Requieren atención',
      value: d.requierenAtencion.length,
      icon: <AlertCircle size={22} />,
      color: 'bg-red-500',
    },
    {
      label: 'Ventas del mes',
      value: `${d.ventasMes.count} · ${formatPrice(d.ventasMes.total)}`,
      icon: <TrendingUp size={22} />,
      color: 'bg-brand-red-600',
      onClick: () => navigate('/admin/crm?tab=prospectos&stage=venta_realizada'),
    },
  ];

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {kpis.map(({ label, value, icon, color, onClick }) => (
        <motion.div
          key={label}
          variants={fadeInUp}
          {...(onClick
            ? {
                whileHover: { y: -4, transition: { duration: 0.2 } },
                onClick,
                role: 'button',
                tabIndex: 0,
                onKeyDown: (e) => {
                  if (e.key === 'Enter') onClick();
                },
              }
            : {})}
          className={`bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#2e3650] transition-shadow ${
            onClick
              ? 'cursor-pointer hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800'
              : ''
          }`}
        >
          <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-white mb-3`}>
            {icon}
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{label}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
