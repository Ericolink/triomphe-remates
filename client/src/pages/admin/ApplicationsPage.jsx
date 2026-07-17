import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Phone, MapPin, Briefcase, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { getApplications, updateApplication, deleteApplication } from '../../services/jobService';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fadeIn, fadeInUp, fadeInRight, staggerContainer } from '../../utils/animations';
import { formatDate } from '../../utils/formatters';
import { CITY_LABELS } from '../../utils/constants';

const statusVariant = { nueva: 'primary', en_revision: 'warning', entrevista: 'default', aceptada: 'success', rechazada: 'danger' };
const expLabel = { sin_experiencia: 'Sin experiencia', 'menos_1_año': '< 1 año', '1_3_años': '1-3 años', 'mas_3_años': '3+ años' };

export default function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['applications', status],
    queryFn: () => getApplications({ status }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateApplication(id, data),
    onSuccess: () => { toast.success('Postulación actualizada'); queryClient.invalidateQueries(['applications']); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApplication,
    onSuccess: () => { toast.success('Postulación eliminada'); setSelected(null); queryClient.invalidateQueries(['applications']); },
  });

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} initial="hidden" animate="visible"
        className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Postulaciones</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{data?.data?.length ?? 0} postulaciones</p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none">
          <option value="">Todas</option>
          <option value="nueva">Nuevas</option>
          <option value="en_revision">En revisión</option>
          <option value="entrevista">Entrevista</option>
          <option value="aceptada">Aceptadas</option>
          <option value="rechazada">Rechazadas</option>
        </select>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? <Spinner size="lg" className="py-16" /> : (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
              <AnimatePresence>
                {data?.data?.map((app) => (
                  <motion.div key={app.id} variants={fadeInUp} layout
                    onClick={() => setSelected(app)}
                    whileHover={{ x: 4, transition: { duration: 0.15 } }}
                    className={`bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border cursor-pointer transition-all ${
                      selected?.id === app.id
                        ? 'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500'
                        : 'border-gray-100 dark:border-[#2e3650]'
                    }`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-100">{app.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(app.createdAt)}</p>
                      </div>
                      <Badge variant={statusVariant[app.status]}>{app.status.replace('_', ' ')}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1"><Mail size={12} /> {app.email}</span>
                      <span className="flex items-center gap-1"><Phone size={12} /> {app.phone}</span>
                      <span className="flex items-center gap-1"><MapPin size={12} /> {CITY_LABELS[app.city]}</span>
                      {app.position && <span className="flex items-center gap-1"><Briefcase size={12} /> {app.position.title}</span>}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
          {!isLoading && data?.data?.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">No hay postulaciones con este filtro</div>
          )}
        </div>

        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div key={selected.id}
                variants={fadeInRight} initial="hidden" animate="visible" exit={{ opacity: 0, x: 20 }}
                className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650] sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-800 dark:text-gray-100">Detalle</h2>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={() => setConfirm({ title: '¿Eliminar postulación?', message: `Se eliminará la postulación de ${selected.name} permanentemente.`, onConfirm: () => { deleteMutation.mutate(selected.id); setConfirm(null); } })}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 size={20} />
                  </motion.button>
                </div>

                <div className="space-y-3 mb-5 text-sm">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">{selected.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {selected.email} · {selected.phone} · {CITY_LABELS[selected.city]}
                    </p>
                  </div>
                  {[
                    { label: 'Experiencia', value: expLabel[selected.experience] },
                    { label: 'Vacante', value: selected.position?.title || 'Postulación general' },
                  ].map(({ label, value }) => value && (
                    <div key={label}>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
                      <p className="font-medium text-gray-800 dark:text-gray-100">{value}</p>
                    </div>
                  ))}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Vehículo propio: <span className="font-medium text-gray-700 dark:text-gray-300">{selected.hasVehicle ? 'Sí' : 'No'}</span>
                  </p>
                  {selected.motivation && (
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Motivación</p>
                      <p className="text-gray-600 dark:text-gray-300 text-sm">{selected.motivation}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Estatus</label>
                    <select value={selected.status}
                      onChange={(e) => {
                        updateMutation.mutate({ id: selected.id, data: { status: e.target.value } });
                        setSelected((s) => ({ ...s, status: e.target.value }));
                      }}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none">
                      <option value="nueva">Nueva</option>
                      <option value="en_revision">En revisión</option>
                      <option value="entrevista">Entrevista</option>
                      <option value="aceptada">Aceptada</option>
                      <option value="rechazada">Rechazada</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notas</label>
                    <textarea defaultValue={selected.notes || ''}
                      onBlur={(e) => updateMutation.mutate({ id: selected.id, data: { notes: e.target.value } })}
                      rows={3} placeholder="Notas internas..."
                      className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500" />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" variants={fadeIn} initial="hidden" animate="visible" exit={{ opacity: 0 }}
                className="bg-white dark:bg-[#242938] rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-[#2e3650] text-center text-gray-400 dark:text-gray-500">
                <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                  <Briefcase size={32} className="mx-auto mb-2 opacity-30" />
                </motion.div>
                <p className="text-sm">Selecciona una postulación</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Eliminar"
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </motion.div>
  );
}
