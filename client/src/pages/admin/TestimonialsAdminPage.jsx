import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { getAllTestimonials, createTestimonial, updateTestimonial, deleteTestimonial } from '../../services/testimonialService';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import OverflowMenu from '../../components/ui/OverflowMenu';
import { fadeIn, fadeInUp, staggerContainer, buttonHover, buttonTap } from '../../utils/animations';
import { CITY_LABELS } from '../../utils/constants';

const statusLabel = { pendiente: 'Pendiente', publicado: 'Publicado', archivado: 'Archivado' };
const statusColors = {
  pendiente: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  publicado: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archivado: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

const emptyForm = {
  clientName: '', clientRole: '', clientCity: '', testimonialText: '',
  rating: 5, status: 'pendiente', beforeImage: null, afterImage: null,
};

function TestimonialForm({ initial, onSave, onCancel, isPending }) {
  const [form, setForm] = useState(initial ? { ...emptyForm, ...initial, beforeImage: null, afterImage: null } : emptyForm);

  const inputClass = "w-full px-3 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nombre del cliente *</label>
          <input type="text" value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Rol (opcional, ej: Inversionista)</label>
          <input type="text" value={form.clientRole} onChange={(e) => setForm((f) => ({ ...f, clientRole: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ciudad (opcional)</label>
          <select value={form.clientCity} onChange={(e) => setForm((f) => ({ ...f, clientCity: e.target.value }))} className={inputClass}>
            <option value="">Sin ciudad</option>
            <option value="juarez">Cd. Juárez</option>
            <option value="chihuahua">Chihuahua</option>
            <option value="queretaro">Querétaro</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Calificación</label>
          <select value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: parseInt(e.target.value, 10) }))} className={inputClass}>
            {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} estrellas</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Estatus</label>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputClass}>
            <option value="pendiente">Pendiente</option>
            <option value="publicado">Publicado</option>
            <option value="archivado">Archivado</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Testimonio *</label>
        <textarea value={form.testimonialText} rows={4}
          onChange={(e) => setForm((f) => ({ ...f, testimonialText: e.target.value }))}
          className={`${inputClass} resize-none`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Foto antes (opcional)</label>
          <input type="file" accept="image/*" onChange={(e) => setForm((f) => ({ ...f, beforeImage: e.target.files[0] }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Foto después (opcional)</label>
          <input type="file" accept="image/*" onChange={(e) => setForm((f) => ({ ...f, afterImage: e.target.files[0] }))} className={inputClass} />
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
          {isPending ? 'Guardando...' : 'Guardar testimonio'}
        </motion.button>
      </div>
    </div>
  );
}

function buildFormData(form) {
  const formData = new FormData();
  formData.append('clientName', form.clientName);
  formData.append('clientRole', form.clientRole);
  formData.append('clientCity', form.clientCity);
  formData.append('testimonialText', form.testimonialText);
  formData.append('rating', form.rating);
  formData.append('status', form.status);
  if (form.beforeImage) formData.append('beforeImage', form.beforeImage);
  if (form.afterImage) formData.append('afterImage', form.afterImage);
  return formData;
}

export default function TestimonialsAdminPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null); // null | 'create' | testimonial
  const [statusFilter, setStatusFilter] = useState('');
  const [confirm, setConfirm] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-testimonials', statusFilter],
    queryFn: () => getAllTestimonials({ status: statusFilter || undefined, limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: createTestimonial,
    onSuccess: () => { toast.success('Testimonio creado'); queryClient.invalidateQueries(['admin-testimonials']); setModal(null); },
    onError: () => toast.error('Error al crear'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }) => updateTestimonial(id, formData),
    onSuccess: () => { toast.success('Testimonio actualizado'); queryClient.invalidateQueries(['admin-testimonials']); setModal(null); },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTestimonial,
    onSuccess: () => { toast.success('Testimonio eliminado'); queryClient.invalidateQueries(['admin-testimonials']); },
    onError: () => toast.error('Error al eliminar'),
  });

  const isEditing = modal && modal !== 'create';

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} initial="hidden" animate="visible"
        className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Testimonios</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{data?.pagination?.total ?? 0} testimonios en total</p>
        </div>
        <motion.button whileHover={buttonHover} whileTap={buttonTap}
          onClick={() => setModal('create')}
          className="flex items-center gap-2 bg-blue-900 dark:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> Nuevo testimonio
        </motion.button>
      </motion.div>

      <div className="mb-6">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none">
          <option value="">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="publicado">Publicado</option>
          <option value="archivado">Archivado</option>
        </select>
      </div>

      {isLoading ? <Spinner size="lg" className="py-16" /> : (
        <motion.div className="space-y-4" variants={staggerContainer} initial="hidden" animate="visible">
          {data?.data?.map((testimonial) => (
            <motion.div key={testimonial.id} variants={fadeInUp}
              className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColors[testimonial.status]}`}>
                      {statusLabel[testimonial.status]}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{testimonial.rating}/5</span>
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">{testimonial.clientName}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {testimonial.clientRole} {testimonial.clientCity && `· ${CITY_LABELS[testimonial.clientCity]}`}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-3 line-clamp-2">{testimonial.testimonialText}</p>
                </div>
                <div className="flex items-center gap-1">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={() => setModal(testimonial)}
                    className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors">
                    <Pencil size={20} />
                  </motion.button>
                  <OverflowMenu items={[
                    { label: 'Eliminar', icon: <Trash2 size={14} />, danger: true, onClick: () => setConfirm({ title: `¿Eliminar testimonio de ${testimonial.clientName}?`, onConfirm: () => { deleteMutation.mutate(testimonial.id); setConfirm(null); } }) },
                  ]} />
                </div>
              </div>
            </motion.div>
          ))}
          {data?.data?.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              No hay testimonios. Crea el primero.
            </div>
          )}
        </motion.div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        confirmLabel="Eliminar"
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />

      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.2 }}
              className="bg-white dark:bg-[#242938] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2e3650] w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-[#2e3650]">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  {isEditing ? 'Editar testimonio' : 'Nuevo testimonio'}
                </h2>
                <button onClick={() => setModal(null)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2e3650] transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6">
                <TestimonialForm
                  initial={isEditing ? modal : undefined}
                  onSave={(form) => isEditing ? updateMutation.mutate({ id: modal.id, formData: buildFormData(form) }) : createMutation.mutate(buildFormData(form))}
                  onCancel={() => setModal(null)}
                  isPending={createMutation.isPending || updateMutation.isPending}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
