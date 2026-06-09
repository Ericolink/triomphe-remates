import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Trash2, MapPin, Tag, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getAlerts, deleteAlert } from '../../services/alertService';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fadeIn, fadeInUp, staggerContainer } from '../../utils/animations';
import { formatPrice, formatDate } from '../../utils/formatters';
import { CITY_LABELS, TYPE_LABELS_SHORT } from '../../utils/constants';

export default function AlertsAdminPage() {
  const queryClient = useQueryClient();
  const [isActiveFilter, setIsActiveFilter] = useState('true');
  const [confirm, setConfirm] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', isActiveFilter],
    queryFn: () => getAlerts({ isActive: isActiveFilter, limit: 50 }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => { toast.success('Alerta eliminada'); queryClient.invalidateQueries(['alerts']); },
  });

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Alertas de propiedades</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{data?.pagination?.total ?? 0} suscriptores</p>
        </div>
        <select value={isActiveFilter} onChange={(e) => setIsActiveFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none">
          <option value="true">Activas</option>
          <option value="false">Canceladas</option>
          <option value="">Todas</option>
        </select>
      </motion.div>

      {isLoading ? <Spinner size="lg" className="py-16" /> : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data?.data?.map((alert) => (
            <motion.div key={alert.id} variants={fadeInUp}
              className="bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#2e3650]">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <Bell size={16} className="text-blue-700 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{alert.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{alert.email}</p>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setConfirm({ onConfirm: () => { deleteMutation.mutate(alert.id); setConfirm(null); } })}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                  <Trash2 size={16} />
                </motion.button>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {alert.city ? (
                  <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-[#2e3650] text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
                    <MapPin size={11} /> {CITY_LABELS[alert.city]}
                  </span>
                ) : <span className="text-xs text-gray-400 dark:text-gray-500">Cualquier ciudad</span>}
                {alert.type && (
                  <span className="flex items-center gap-1 text-xs bg-gray-100 dark:bg-[#2e3650] text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
                    <Tag size={11} /> {TYPE_LABELS_SHORT[alert.type]}
                  </span>
                )}
                {alert.maxPrice && (
                  <span className="flex items-center gap-1 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-1 rounded-full">
                    <DollarSign size={11} /> hasta {formatPrice(alert.maxPrice)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Badge variant={alert.isActive ? 'success' : 'default'}>{alert.isActive ? 'Activa' : 'Cancelada'}</Badge>
                <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(alert.createdAt)}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
      {!isLoading && data?.data?.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">No hay alertas con este filtro</div>
      )}

      <ConfirmDialog open={!!confirm} title="¿Eliminar esta alerta?" message="El suscriptor dejará de recibir notificaciones."
        confirmLabel="Eliminar" onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />
    </motion.div>
  );
}
