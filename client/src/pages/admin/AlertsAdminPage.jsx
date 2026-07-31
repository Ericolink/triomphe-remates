import { useMemo, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getAlerts, deleteAlert } from '../../services/alertService';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fadeIn, fadeInUp, staggerContainer } from '../../utils/animations';
import { formatPrice, formatDate } from '../../utils/formatters';
import { CITY_LABELS, TYPE_LABELS_SHORT } from '../../utils/constants';

const ALERTS_PAGE_SIZE = 24;

export default function AlertsAdminPage() {
  const queryClient = useQueryClient();
  const [isActiveFilter, setIsActiveFilter] = useState('true');
  const [confirm, setConfirm] = useState(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['alerts', isActiveFilter],
    queryFn: ({ pageParam = 1 }) =>
      getAlerts({ isActive: isActiveFilter, page: pageParam, limit: ALERTS_PAGE_SIZE }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
    initialPageParam: 1,
  });
  const alerts = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const alertsTotal = data?.pages?.[0]?.pagination?.total ?? 0;

  const deleteMutation = useMutation({
    mutationFn: deleteAlert,
    onSuccess: () => {
      toast.success('Alerta eliminada');
      queryClient.invalidateQueries(['alerts']);
    },
  });

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Alertas de propiedades
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{alertsTotal} suscriptores</p>
        </div>
        <select
          value={isActiveFilter}
          onChange={(e) => setIsActiveFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
        >
          <option value="true">Activas</option>
          <option value="false">Canceladas</option>
          <option value="">Todas</option>
        </select>
      </motion.div>

      {isLoading ? (
        <Spinner size="lg" className="py-16" />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              variants={fadeInUp}
              className="bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#2e3650]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                    <Bell size={16} className="text-primary-700 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">
                      {alert.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{alert.email}</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() =>
                    setConfirm({
                      onConfirm: () => {
                        deleteMutation.mutate(alert.id);
                        setConfirm(null);
                      },
                    })
                  }
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </motion.button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {[
                  alert.city ? CITY_LABELS[alert.city] : 'Cualquier ciudad',
                  alert.type ? TYPE_LABELS_SHORT[alert.type] : null,
                  alert.maxPrice ? `hasta ${formatPrice(alert.maxPrice)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>

              <div className="flex items-center justify-between">
                {isActiveFilter === '' ? (
                  <Badge variant={alert.isActive ? 'success' : 'default'}>
                    {alert.isActive ? 'Activa' : 'Cancelada'}
                  </Badge>
                ) : (
                  <span />
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDate(alert.createdAt)}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
      {!isLoading && alerts.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          No hay alertas con este filtro
        </div>
      )}
      {hasNextPage && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-4 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-[#242938] hover:bg-gray-50 dark:hover:bg-[#2e3650] disabled:opacity-50 transition-colors"
          >
            {isFetchingNextPage ? 'Cargando...' : 'Cargar más'}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title="¿Eliminar esta alerta?"
        message="El suscriptor dejará de recibir notificaciones."
        confirmLabel="Eliminar"
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </motion.div>
  );
}
