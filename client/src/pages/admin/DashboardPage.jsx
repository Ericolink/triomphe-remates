import { useQuery } from '@tanstack/react-query';
import { Building2, Users, Eye, TrendingUp, MapPin, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { getDashboard } from '../../services/analyticsService';
import Spinner from '../../components/ui/Spinner';
import { staggerContainer, fadeInUp, fadeIn } from '../../utils/animations';

const cityLabel = { juarez: 'Cd. Juárez', chihuahua: 'Chihuahua', queretaro: 'Querétaro' };
const typeLabel = { casa: 'Casa', departamento: 'Depto.', terreno: 'Terreno', local: 'Local', bodega: 'Bodega' };

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 60000,
  });

  const d = data?.data;
  if (isLoading) return <Spinner size="lg" className="py-20" />;

  const stats = [
    { label: 'Total propiedades', value: d?.properties?.total ?? 0, icon: <Building2 size={22} />, color: 'bg-blue-900' },
    { label: 'Disponibles', value: d?.properties?.disponible ?? 0, icon: <Home size={22} />, color: 'bg-green-600' },
    { label: 'Leads nuevos', value: d?.leads?.new ?? 0, icon: <Users size={22} />, color: 'bg-yellow-500' },
    { label: 'Vistas (30 días)', value: d?.views?.last30Days ?? 0, icon: <Eye size={22} />, color: 'bg-purple-600' },
  ];

  return (
    <div>
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Resumen general del sistema</p>
      </motion.div>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {stats.map(({ label, value, icon, color }) => (
          <motion.div
            key={label}
            variants={fadeInUp}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#2e3650] cursor-default"
          >
            <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-white mb-3`}>
              {icon}
            </div>
            <motion.p
              className="text-2xl font-bold text-gray-800 dark:text-gray-100"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {value}
            </motion.p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{label}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Por ciudad */}
        <motion.div variants={fadeInUp}
          className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-blue-700 dark:text-blue-400" /> Por ciudad
          </h2>
          <div className="space-y-3">
            {d?.byCity?.map(({ city, total }, i) => (
              <div key={city}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-300">{cityLabel[city] || city}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{total}</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-[#2e3650] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-900 dark:bg-blue-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(total / d.properties.total) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Por tipo */}
        <motion.div variants={fadeInUp}
          className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Home size={16} className="text-blue-700 dark:text-blue-400" /> Por tipo
          </h2>
          <div className="space-y-3">
            {d?.byType?.map(({ type, total }) => (
              <motion.div key={type}
                className="flex justify-between items-center"
                whileHover={{ x: 4 }}
                transition={{ duration: 0.15 }}
              >
                <span className="text-sm text-gray-600 dark:text-gray-300">{typeLabel[type] || type}</span>
                <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full">{total}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Top propiedades */}
        <motion.div variants={fadeInUp}
          className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-700 dark:text-blue-400" /> Más visitadas
          </h2>
          <div className="space-y-3">
            {d?.topProperties?.map((p, i) => (
              <motion.div key={p.id}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
              >
                <span className="w-6 h-6 bg-gray-100 dark:bg-[#2e3650] rounded-full flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{p.title}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{cityLabel[p.city]}</p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <Eye size={12} /> {p.views}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Estatus */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="mt-6 bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]"
      >
        <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Estatus del inventario</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Disponibles', value: d?.properties?.disponible, color: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400' },
            { label: 'Apartadas', value: d?.properties?.apartado, color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400' },
            { label: 'Vendidas', value: d?.properties?.vendido, color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400' },
          ].map(({ label, value, color }, i) => (
            <motion.div key={label}
              className={`rounded-xl p-4 text-center ${color}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.1, duration: 0.3 }}
              whileHover={{ scale: 1.04 }}
            >
              <p className="text-2xl font-bold">{value ?? 0}</p>
              <p className="text-sm font-medium mt-1">{label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
