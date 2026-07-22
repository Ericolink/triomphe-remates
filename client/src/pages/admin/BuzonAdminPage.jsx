import { useId, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trash2,
  MessageSquare,
  AlertCircle,
  Lightbulb,
  FileSpreadsheet,
  Archive,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../services/api';
import {
  getFeedbacks,
  updateFeedback,
  deleteFeedback,
  batchUpdateFeedback,
  batchDeleteFeedback,
} from '../../services/feedbackService';
import BatchActionBar from '../../components/ui/BatchActionBar';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fadeIn, fadeInUp, fadeInRight, staggerContainer } from '../../utils/animations';
import { formatDate } from '../../utils/formatters';
import { downloadBlob } from '../../utils/download';
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_CATEGORY_VARIANTS,
  FEEDBACK_CATEGORY_GRADIENT,
  FEEDBACK_STATUS_LABELS,
} from '../../utils/constants';

const categoryIcon = {
  queja: <AlertCircle size={14} />,
  comentario: <MessageSquare size={14} />,
  sugerencia: <Lightbulb size={14} />,
};

export default function BuzonAdminPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [checked, setChecked] = useState([]);
  const detailFormId = useId();

  const { data, isLoading } = useQuery({
    queryKey: ['feedback', statusFilter, categoryFilter],
    queryFn: () =>
      getFeedbacks({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        limit: 50,
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateFeedback(id, data),
    onSuccess: (_, { data: updated }) => {
      toast.success('Actualizado');
      queryClient.invalidateQueries(['feedback']);
      if (updated.status) setSelected((s) => (s ? { ...s, status: updated.status } : s));
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
    onSuccess: (_, { ids }) => {
      toast.success(`${ids.length} mensaje(s) actualizados`);
      setChecked([]);
      queryClient.invalidateQueries(['feedback']);
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteFeedback,
    onSuccess: (_, ids) => {
      toast.success(`${ids.length} mensaje(s) eliminados`);
      setChecked([]);
      setSelected(null);
      queryClient.invalidateQueries(['feedback']);
    },
  });

  const allItems = data?.data ?? [];
  const items = search.trim()
    ? allItems.filter((i) => {
        const q = search.trim().toLowerCase();
        return (
          i.name?.toLowerCase().includes(q) ||
          i.subject?.toLowerCase().includes(q) ||
          i.message?.toLowerCase().includes(q)
        );
      })
    : allItems;
  const newCount = allItems.filter((i) => i.status === 'nuevo').length;
  const archivedCount = allItems.filter((i) => i.status === 'archivado').length;

  const toggleCheck = (e, id) => {
    e.stopPropagation();
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleAll = () => {
    const ids = items.map((i) => i.id);
    setChecked(checked.length === ids.length ? [] : ids);
  };
  const handleArchive = (e, item) => {
    e.stopPropagation();
    updateMutation.mutate({ id: item.id, data: { status: 'archivado' } });
  };
  const handleQuickDelete = (e, item) => {
    e.stopPropagation();
    setConfirm({
      title: '¿Eliminar este mensaje?',
      message: `Se eliminará el mensaje de ${item.name} permanentemente.`,
      onConfirm: () => {
        deleteMutation.mutate(item.id);
        setConfirm(null);
      },
    });
  };

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
      downloadBlob(response.data, `triomphe-buzon-${Date.now()}.xlsx`);
    } catch {
      toast.error('Error al exportar');
    }
  };

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Buzón de opiniones
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-[#1a1f2e] text-gray-600 dark:text-gray-300">
                {allItems.length} total
              </span>
              {newCount > 0 && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {newCount} nuevo{newCount !== 1 ? 's' : ''}
                </span>
              )}
              {archivedCount > 0 && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-[#1a1f2e] text-gray-500 dark:text-gray-400">
                  {archivedCount} archivado{archivedCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
          >
            <FileSpreadsheet size={16} className="text-green-600" /> Excel
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-white dark:bg-[#242938] border border-gray-200 dark:border-[#2e3650] rounded-xl px-3 py-2 flex-1 min-w-[220px]">
            <Search size={16} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nombre, asunto o mensaje..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-sm focus:outline-none bg-transparent dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
          >
            <option value="">Todas las categorías</option>
            <option value="queja">Quejas</option>
            <option value="comentario">Comentarios</option>
            <option value="sugerencia">Sugerencias</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
          >
            <option value="">Todos los estados</option>
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
              <input
                type="checkbox"
                checked={checked.length === items.length}
                onChange={toggleAll}
                className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
              />
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {checked.length === items.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </span>
            </div>
          )}

          {isLoading ? (
            <Spinner size="lg" className="py-16" />
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              <AnimatePresence>
                {items.map((item) => {
                  const isUnread = item.status === 'nuevo';
                  const isArchived = item.status === 'archivado';
                  return (
                    <motion.div
                      key={item.id}
                      variants={fadeInUp}
                      layout
                      onClick={() => handleSelect(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelect(item);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      whileHover={{ x: 4, transition: { duration: 0.15 } }}
                      className={`group relative overflow-hidden rounded-2xl p-5 shadow-sm border cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        isArchived ? 'opacity-60' : ''
                      } ${
                        isUnread
                          ? 'bg-blue-50/50 dark:bg-blue-900/10'
                          : 'bg-white dark:bg-[#242938]'
                      } ${
                        selected?.id === item.id
                          ? 'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500'
                          : 'border-gray-100 dark:border-[#2e3650]'
                      }`}
                    >
                      <div
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-y-0 right-0 w-1/3 sm:w-2/5 bg-gradient-to-l ${FEEDBACK_CATEGORY_GRADIENT[item.category]} to-transparent`}
                      />
                      <div className="relative z-10 flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked.includes(item.id)}
                          onChange={(e) => toggleCheck(e, item.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Seleccionar mensaje de ${item.name}`}
                          className="mt-1 w-4 h-4 rounded accent-blue-600 flex-shrink-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0 mr-3">
                              <p className="flex items-center gap-2 truncate">
                                {isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                )}
                                <span
                                  className={`truncate ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}
                                >
                                  {item.subject}
                                </span>
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {item.name} · {formatDate(item.createdAt)}
                                {isArchived && (
                                  <span className="ml-1 italic">
                                    · {FEEDBACK_STATUS_LABELS.archivado}
                                  </span>
                                )}
                              </p>
                            </div>
                            <Badge variant={FEEDBACK_CATEGORY_VARIANTS[item.category]}>
                              <span className="flex items-center gap-1">
                                {categoryIcon[item.category]}{' '}
                                {FEEDBACK_CATEGORY_LABELS[item.category]}
                              </span>
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 pr-12">
                            {item.message}
                          </p>
                        </div>
                      </div>
                      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {!isArchived && (
                          <button
                            onClick={(e) => handleArchive(e, item)}
                            title="Archivar"
                            aria-label={`Archivar mensaje de ${item.name}`}
                            className="p-1.5 bg-white/90 dark:bg-[#1a1f2e]/90 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors shadow-sm"
                          >
                            <Archive size={15} />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleQuickDelete(e, item)}
                          title="Eliminar"
                          aria-label={`Eliminar mensaje de ${item.name}`}
                          className="p-1.5 bg-white/90 dark:bg-[#1a1f2e]/90 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors shadow-sm"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
          {!isLoading && items.length === 0 && (
            <motion.div
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              className="text-center py-16 text-gray-400 dark:text-gray-500"
            >
              {search.trim()
                ? 'Ningún mensaje coincide con la búsqueda'
                : 'No hay mensajes con este filtro'}
            </motion.div>
          )}
        </div>

        {/* Detalle */}
        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                variants={fadeInRight}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, x: 20 }}
                className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650] sticky top-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-800 dark:text-gray-100">Detalle</h2>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() =>
                      setConfirm({
                        title: '¿Eliminar este mensaje?',
                        message: `Se eliminará el mensaje de ${selected.name} permanentemente.`,
                        onConfirm: () => {
                          deleteMutation.mutate(selected.id);
                          setConfirm(null);
                        },
                      })
                    }
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
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
                      <p className="font-medium text-gray-800 dark:text-gray-100 break-words">
                        {value}
                      </p>
                    </div>
                  ))}
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Categoría</p>
                    <Badge variant={FEEDBACK_CATEGORY_VARIANTS[selected.category]}>
                      <span className="flex items-center gap-1">
                        {categoryIcon[selected.category]}{' '}
                        {FEEDBACK_CATEGORY_LABELS[selected.category]}
                      </span>
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Mensaje</p>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {selected.message}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor={`${detailFormId}-status`}
                      className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                    >
                      Estatus
                    </label>
                    <select
                      id={`${detailFormId}-status`}
                      value={selected.status}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        updateMutation.mutate({ id: selected.id, data: { status: newStatus } });
                        setSelected((s) => ({ ...s, status: newStatus }));
                      }}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none"
                    >
                      {Object.entries(FEEDBACK_STATUS_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={`${detailFormId}-notes`}
                      className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                    >
                      Notas internas
                    </label>
                    <textarea
                      id={`${detailFormId}-notes`}
                      defaultValue={selected.notes || ''}
                      onBlur={(e) =>
                        updateMutation.mutate({ id: selected.id, data: { notes: e.target.value } })
                      }
                      rows={3}
                      placeholder="Agrega notas sobre este mensaje..."
                      className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500"
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
                className="bg-white dark:bg-[#242938] rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-[#2e3650] text-center text-gray-400 dark:text-gray-500"
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                </motion.div>
                <p className="text-sm">Selecciona un mensaje para ver el detalle</p>
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

      <BatchActionBar
        count={checked.length}
        onClear={() => setChecked([])}
        statusOptions={[
          { value: 'leido', label: 'Leído' },
          { value: 'archivado', label: 'Archivado' },
        ]}
        onStatus={(s) => batchStatusMutation.mutate({ ids: checked, status: s })}
        onDelete={() =>
          setConfirm({
            title: `¿Eliminar ${checked.length} mensaje(s)?`,
            message: 'Esta acción no se puede deshacer.',
            onConfirm: () => {
              batchDeleteMutation.mutate(checked);
              setConfirm(null);
            },
          })
        }
      />
    </motion.div>
  );
}
