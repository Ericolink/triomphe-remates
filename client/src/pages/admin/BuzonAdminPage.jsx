import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, MessageSquare, AlertCircle, Lightbulb, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getFeedbacks, updateFeedback, deleteFeedback, batchUpdateFeedback, batchDeleteFeedback } from '../../services/feedbackService';
import BatchActionBar from '../../components/ui/BatchActionBar';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fadeIn, fadeInUp, fadeInRight, staggerContainer } from '../../utils/animations';
import { formatDate } from '../../utils/formatters';

const categoryVariant = { queja: 'danger', comentario: 'primary', sugerencia: 'success' };
const categoryIcon = {
  queja:      <AlertCircle size={14} />,
  comentario: <MessageSquare size={14} />,
  sugerencia: <Lightbulb size={14} />,
};
const statusVariant = { nuevo: 'primary', leido: 'warning', archivado: 'default' };

export default function BuzonAdminPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [checked, setChecked] = useState([]);

  const { data, isLoading } = useQuery({
    queryKey: ['feedback', statusFilter, categoryFilter],
    queryFn: () => getFeedbacks({ status: statusFilter || undefined, category: categoryFilter || undefined, limit: 50 }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateFeedback(id, data),
    onSuccess: (_, { data: updated }) => {
      toast.success('Actualizado');
      queryClient.invalidateQueries(['feedback']);
      if (updated.status) setSelected((s) => s ? { ...s, status: updated.status } : s);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFeedback,
    onSuccess: () => {
      toast.success('Eliminado');
      setSelected(null);
      queryClient.invalidateQueries(['feedback']);
    },
  });

  const batchStatusMutation = useMutation({
    mutationFn: ({ ids, status }) => batchUpdateFeedback(ids, status),
    onSuccess: (_, { ids }) => { toast.success(`${ids.length} mensaje(s) actualizados`); setChecked([]); queryClient.invalidateQueries(['feedback']); },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteFeedback,
    onSuccess: (_, ids) => { toast.success(`${ids.length} mensaje(s) eliminados`); setChecked([]); setSelected(null); queryClient.invalidateQueries(['feedback']); },
  });

  const toggleCheck = (e, id) => { e.stopPropagation(); setChecked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]); };
  const toggleAll = () => { const ids = data?.data?.map((i) => i.id) ?? []; setChecked(checked.length === ids.length ? [] : ids); };
  const items = data?.data ?? [];

  const handleSelect = (item) => {
    setSelected(item);
    if (item.status === 'nuevo') {
      updateMutation.mutate({ id: item.id, data: { status: 'leido' } });
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      const response = await api.get(`/export/feedback/excel?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `triomphe-buzon-${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al exportar');
    }
  };

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} initial="hidden" animate="visible"
        className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Buzón de opiniones</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{data?.pagination?.total ?? 0} mensajes recibidos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors">
            <FileSpreadsheet size={16} className="text-green-600" /> Excel
          </button>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none">
            <option value="">Todos</option>
            <option value="queja">Quejas</option>
            <option value="comentario">Comentarios</option>
            <option value="sugerencia">Sugerencias</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none">
            <option value="">Todos</option>
            <option value="nuevo">Nuevos</option>
            <option value="leido">Leídos</option>
            <option value="archivado">Archivados</option>
          </select>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista */}
        <div className="lg:col-span-2 space-y-3">
          {items.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <input type="checkbox" checked={checked.length === items.length} onChange={toggleAll}
                className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {checked.length === items.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </span>
            </div>
          )}

          {isLoading ? <Spinner size="lg" className="py-16" /> : (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
              <AnimatePresence>
                {items.map((item) => (
                  <motion.div key={item.id}
                    variants={fadeInUp} layout
                    onClick={() => handleSelect(item)}
                    whileHover={{ x: 4, transition: { duration: 0.15 } }}
                    className={`bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border cursor-pointer transition-all ${
                      selected?.id === item.id
                        ? 'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500'
                        : 'border-gray-100 dark:border-[#2e3650]'
                    }`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={checked.includes(item.id)} onChange={(e) => toggleCheck(e, item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 w-4 h-4 rounded accent-blue-600 flex-shrink-0 cursor-pointer" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0 mr-3">
                            <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">{item.subject}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{item.name} · {formatDate(item.createdAt)}</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Badge variant={categoryVariant[item.category]}>
                              <span className="flex items-center gap-1">{categoryIcon[item.category]} {item.category}</span>
                            </Badge>
                            <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2">{item.message}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
          {!isLoading && data?.data?.length === 0 && (
            <motion.div variants={fadeIn} initial="hidden" animate="visible"
              className="text-center py-16 text-gray-400 dark:text-gray-500">
              No hay mensajes con este filtro
            </motion.div>
          )}
        </div>

        {/* Detalle */}
        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div key={selected.id}
                variants={fadeInRight} initial="hidden" animate="visible" exit={{ opacity: 0, x: 20 }}
                className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650] sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-800 dark:text-gray-100">Detalle</h2>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={() => setConfirm({
                      title: '¿Eliminar este mensaje?',
                      message: `Se eliminará el mensaje de ${selected.name} permanentemente.`,
                      onConfirm: () => { deleteMutation.mutate(selected.id); setConfirm(null); },
                    })}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 size={20} />
                  </motion.button>
                </div>

                <div className="space-y-3 mb-6 text-sm">
                  {[
                    { label: 'Nombre', value: selected.name },
                    { label: 'Email', value: selected.email },
                    { label: 'Asunto', value: selected.subject },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
                      <p className="font-medium text-gray-800 dark:text-gray-100 break-words">{value}</p>
                    </div>
                  ))}
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Categoría</p>
                    <Badge variant={categoryVariant[selected.category]}>
                      <span className="flex items-center gap-1">{categoryIcon[selected.category]} {selected.category}</span>
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Mensaje</p>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{selected.message}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Estatus</label>
                    <select value={selected.status}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        updateMutation.mutate({ id: selected.id, data: { status: newStatus } });
                        setSelected((s) => ({ ...s, status: newStatus }));
                      }}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none">
                      <option value="nuevo">Nuevo</option>
                      <option value="leido">Leído</option>
                      <option value="archivado">Archivado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notas internas</label>
                    <textarea defaultValue={selected.notes || ''}
                      onBlur={(e) => updateMutation.mutate({ id: selected.id, data: { notes: e.target.value } })}
                      rows={3} placeholder="Agrega notas sobre este mensaje..."
                      className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500" />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty"
                variants={fadeIn} initial="hidden" animate="visible" exit={{ opacity: 0 }}
                className="bg-white dark:bg-[#242938] rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-[#2e3650] text-center text-gray-400 dark:text-gray-500">
                <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                </motion.div>
                <p className="text-sm">Selecciona un mensaje para ver el detalle</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message}
        confirmLabel="Eliminar" onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />

      <BatchActionBar
        count={checked.length}
        onClear={() => setChecked([])}
        statusOptions={[{ value: 'leido', label: 'Leído' }, { value: 'archivado', label: 'Archivado' }]}
        onStatus={(s) => batchStatusMutation.mutate({ ids: checked, status: s })}
        onDelete={() => setConfirm({
          title: `¿Eliminar ${checked.length} mensaje(s)?`,
          message: 'Esta acción no se puede deshacer.',
          onConfirm: () => { batchDeleteMutation.mutate(checked); setConfirm(null); },
        })}
      />
    </motion.div>
  );
}
