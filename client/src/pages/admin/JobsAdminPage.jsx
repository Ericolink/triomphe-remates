import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Users, Briefcase, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getAllPositions, createPosition, updatePosition, deletePosition } from '../../services/jobService';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { fadeIn, fadeInUp, staggerContainer, buttonHover, buttonTap } from '../../utils/animations';
import { CITY_LABELS } from '../../utils/constants';

// 'todas' es propio del dominio de vacantes (no existe en CITY_LABELS, que es para propiedades)
const cityLabel = { ...CITY_LABELS, todas: 'Todas' };
const typeLabel = { tiempo_completo: 'Tiempo completo', medio_tiempo: 'Medio tiempo', por_comision: 'Por comisión' };
const statusColors = {
  activa: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cerrada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  pausada: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const emptyForm = { title: '', description: '', requirements: '', benefits: '', city: 'todas', type: 'por_comision', status: 'activa', isUrgent: false };

function PositionForm({ initial, onSave, onCancel, isPending }) {
  const [form, setForm] = useState(initial || emptyForm);

  const inputClass = "w-full px-3 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100";
  const textareaClass = `${inputClass} resize-none`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Título del puesto *</label>
          <input type="text" value={form.title} placeholder="Ej: Asesor de Ventas Inmobiliarias"
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ciudad</label>
          <select value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className={inputClass}>
            <option value="todas">Todas las ciudades</option>
            <option value="juarez">Cd. Juárez</option>
            <option value="chihuahua">Chihuahua</option>
            <option value="queretaro">Querétaro</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo</label>
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inputClass}>
            <option value="por_comision">Por comisión</option>
            <option value="tiempo_completo">Tiempo completo</option>
            <option value="medio_tiempo">Medio tiempo</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Estatus</label>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputClass}>
            <option value="activa">Activa</option>
            <option value="pausada">Pausada</option>
            <option value="cerrada">Cerrada</option>
          </select>
        </div>
        <div className="flex items-center gap-3 pt-4">
          <input type="checkbox" id="isUrgent" checked={form.isUrgent}
            onChange={(e) => setForm((f) => ({ ...f, isUrgent: e.target.checked }))}
            className="w-4 h-4 accent-blue-900" />
          <label htmlFor="isUrgent" className="text-sm text-gray-700 dark:text-gray-300">Marcar como urgente</label>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Descripción *</label>
          <textarea value={form.description} rows={3} placeholder="Descripción del puesto..."
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={textareaClass} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Requisitos *</label>
          <textarea value={form.requirements} rows={3} placeholder="Lista los requisitos..."
            onChange={(e) => setForm((f) => ({ ...f, requirements: e.target.value }))}
            className={textareaClass} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Beneficios</label>
          <textarea value={form.benefits} rows={2} placeholder="Lista los beneficios..."
            onChange={(e) => setForm((f) => ({ ...f, benefits: e.target.value }))}
            className={textareaClass} />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onCancel}
          className="px-5 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors dark:text-gray-300">
          Cancelar
        </button>
        <motion.button type="button" onClick={() => onSave(form)}
          disabled={isPending} whileHover={buttonHover} whileTap={buttonTap}
          className="px-6 py-2.5 bg-blue-900 dark:bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
          {isPending ? 'Guardando...' : 'Guardar vacante'}
        </motion.button>
      </div>
    </div>
  );
}

export default function JobsAdminPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-jobs'],
    queryFn: getAllPositions,
  });

  const createMutation = useMutation({
    mutationFn: createPosition,
    onSuccess: () => { toast.success('Vacante creada'); queryClient.invalidateQueries(['admin-jobs']); setCreating(false); },
    onError: () => toast.error('Error al crear'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updatePosition(id, data),
    onSuccess: () => { toast.success('Vacante actualizada'); queryClient.invalidateQueries(['admin-jobs']); setEditing(null); },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePosition,
    onSuccess: () => { toast.success('Vacante eliminada'); queryClient.invalidateQueries(['admin-jobs']); },
    onError: () => toast.error('Error al eliminar'),
  });

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} initial="hidden" animate="visible"
        className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Vacantes</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{data?.data?.length ?? 0} vacantes en total</p>
        </div>
        <motion.button whileHover={buttonHover} whileTap={buttonTap}
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-2 bg-blue-900 dark:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Nueva vacante
        </motion.button>
      </motion.div>

      {/* Formulario de creación */}
      {creating && (
        <motion.div variants={fadeInUp} initial="hidden" animate="visible"
          className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-blue-200 dark:border-blue-800 mb-6">
          <h2 className="font-bold text-blue-900 dark:text-white mb-4">Nueva vacante</h2>
          <PositionForm
            onSave={(form) => createMutation.mutate(form)}
            onCancel={() => setCreating(false)}
            isPending={createMutation.isPending}
          />
        </motion.div>
      )}

      {/* Lista de vacantes */}
      {isLoading ? <Spinner size="lg" className="py-16" /> : (
        <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="visible">
          {data?.data?.map((position) => (
            <motion.div key={position.id} variants={fadeInUp}
              className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] overflow-hidden">
              {editing?.id === position.id ? (
                <div className="p-6">
                  <h2 className="font-bold text-blue-900 dark:text-white mb-4">Editar vacante</h2>
                  <PositionForm
                    initial={editing}
                    onSave={(form) => updateMutation.mutate({ id: position.id, data: form })}
                    onCancel={() => setEditing(null)}
                    isPending={updateMutation.isPending}
                  />
                </div>
              ) : (
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {position.isUrgent && (
                          <span className="inline-flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
                            <Star size={10} /> Urgente
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColors[position.status]}`}>
                          {position.status}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-800 dark:text-gray-100">{position.title}</h3>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span className="flex items-center gap-1"><Briefcase size={11} /> {typeLabel[position.type]}</span>
                        <span className="flex items-center gap-1"><Users size={11} /> {position.applications?.length ?? 0} postulaciones</span>
                        <span>{cityLabel[position.city]}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        onClick={() => { setEditing(position); setCreating(false); }}
                        className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors">
                        <Pencil size={20} />
                      </motion.button>
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        onClick={() => setConfirm({ title: `¿Eliminar "${position.title}"?`, message: 'La vacante y sus postulaciones asociadas serán eliminadas permanentemente.', onConfirm: () => { deleteMutation.mutate(position.id); setConfirm(null); } })}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 size={20} />
                      </motion.button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
          {data?.data?.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              No hay vacantes. Crea la primera.
            </div>
          )}
        </motion.div>
      )}

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
