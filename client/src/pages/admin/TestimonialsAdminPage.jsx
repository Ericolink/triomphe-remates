import { useId, useMemo, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  getAllTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
} from '../../services/testimonialService';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import OverflowMenu from '../../components/ui/OverflowMenu';
import AdminFormModal from '../../components/ui/AdminFormModal';
import Badge from '../../components/ui/Badge';
import { fadeIn, fadeInUp, staggerContainer, buttonHover, buttonTap } from '../../utils/animations';
import {
  CITY_LABELS,
  TESTIMONIAL_STATUS_LABELS,
  TESTIMONIAL_STATUS_VARIANTS,
  labelsToOptions,
} from '../../utils/constants';

const emptyForm = {
  clientName: '',
  clientRole: '',
  clientCity: '',
  testimonialText: '',
  rating: 5,
  status: 'pendiente',
  beforeImage: null,
  afterImage: null,
};

function TestimonialForm({ initial, onSave, onCancel, isPending }) {
  const [form, setForm] = useState(
    initial ? { ...emptyForm, ...initial, beforeImage: null, afterImage: null } : emptyForm
  );
  const formId = useId();

  const inputClass =
    'w-full px-3 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor={`${formId}-clientName`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Nombre del cliente *
          </label>
          <input
            id={`${formId}-clientName`}
            type="text"
            value={form.clientName}
            onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`${formId}-clientRole`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Rol (opcional, ej: Inversionista)
          </label>
          <input
            id={`${formId}-clientRole`}
            type="text"
            value={form.clientRole}
            onChange={(e) => setForm((f) => ({ ...f, clientRole: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`${formId}-clientCity`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Ciudad (opcional)
          </label>
          <select
            id={`${formId}-clientCity`}
            value={form.clientCity}
            onChange={(e) => setForm((f) => ({ ...f, clientCity: e.target.value }))}
            className={inputClass}
          >
            {[{ value: '', label: 'Sin ciudad' }, ...labelsToOptions(CITY_LABELS, ['otra'])].map(
              (o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              )
            )}
          </select>
        </div>
        <div>
          <label
            htmlFor={`${formId}-rating`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Calificación
          </label>
          <select
            id={`${formId}-rating`}
            value={form.rating}
            onChange={(e) => setForm((f) => ({ ...f, rating: parseInt(e.target.value, 10) }))}
            className={inputClass}
          >
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} estrellas
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`${formId}-status`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Estatus
          </label>
          <select
            id={`${formId}-status`}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className={inputClass}
          >
            {labelsToOptions(TESTIMONIAL_STATUS_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor={`${formId}-testimonialText`}
          className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
        >
          Testimonio *
        </label>
        <textarea
          id={`${formId}-testimonialText`}
          value={form.testimonialText}
          rows={4}
          onChange={(e) => setForm((f) => ({ ...f, testimonialText: e.target.value }))}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor={`${formId}-beforeImage`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Foto antes (opcional)
          </label>
          <input
            id={`${formId}-beforeImage`}
            type="file"
            accept="image/*"
            onChange={(e) => setForm((f) => ({ ...f, beforeImage: e.target.files[0] }))}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`${formId}-afterImage`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Foto después (opcional)
          </label>
          <input
            id={`${formId}-afterImage`}
            type="file"
            accept="image/*"
            onChange={(e) => setForm((f) => ({ ...f, afterImage: e.target.files[0] }))}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors dark:text-gray-300"
        >
          Cancelar
        </button>
        <motion.button
          type="button"
          onClick={() => onSave(form)}
          disabled={isPending}
          whileHover={buttonHover}
          whileTap={buttonTap}
          className="px-6 py-2.5 bg-accent-400 dark:bg-accent-500 text-primary-900 rounded-xl text-sm font-medium hover:bg-accent-300 dark:hover:bg-accent-400 transition-colors disabled:opacity-50"
        >
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

const TESTIMONIALS_PAGE_SIZE = 20;

export default function TestimonialsAdminPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null); // null | 'create' | testimonial
  const [statusFilter, setStatusFilter] = useState('');
  const [confirm, setConfirm] = useState(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['admin-testimonials', statusFilter],
    queryFn: ({ pageParam = 1 }) =>
      getAllTestimonials({
        page: pageParam,
        limit: TESTIMONIALS_PAGE_SIZE,
        status: statusFilter || undefined,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });
  const testimonials = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const testimonialsTotal = data?.pages?.[0]?.pagination?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: createTestimonial,
    onSuccess: () => {
      toast.success('Testimonio creado');
      queryClient.invalidateQueries(['admin-testimonials']);
      setModal(null);
    },
    onError: () => toast.error('Error al crear'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }) => updateTestimonial(id, formData),
    onSuccess: () => {
      toast.success('Testimonio actualizado');
      queryClient.invalidateQueries(['admin-testimonials']);
      setModal(null);
    },
    onError: () => toast.error('Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTestimonial,
    onSuccess: () => {
      toast.success('Testimonio eliminado');
      queryClient.invalidateQueries(['admin-testimonials']);
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const isEditing = modal && modal !== 'create';

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Testimonios</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {testimonialsTotal} testimonios en total
          </p>
        </div>
        <motion.button
          whileHover={buttonHover}
          whileTap={buttonTap}
          onClick={() => setModal('create')}
          className="flex items-center gap-2 bg-accent-400 dark:bg-accent-500 text-primary-900 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-accent-300 dark:hover:bg-accent-400 transition-colors"
        >
          <Plus size={16} /> Nuevo testimonio
        </motion.button>
      </motion.div>

      <div className="mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
        >
          {[{ value: '', label: 'Todos' }, ...labelsToOptions(TESTIMONIAL_STATUS_LABELS)].map(
            (o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            )
          )}
        </select>
      </div>

      {isLoading ? (
        <Spinner size="lg" className="py-16" />
      ) : (
        <motion.div
          className="space-y-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {testimonials.map((testimonial) => (
            <motion.div
              key={testimonial.id}
              variants={fadeInUp}
              className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant={TESTIMONIAL_STATUS_VARIANTS[testimonial.status]}>
                      {TESTIMONIAL_STATUS_LABELS[testimonial.status]}
                    </Badge>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {testimonial.rating}/5
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">
                    {testimonial.clientName}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {testimonial.clientRole}{' '}
                    {testimonial.clientCity && `· ${CITY_LABELS[testimonial.clientCity]}`}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-3 line-clamp-2">
                    {testimonial.testimonialText}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setModal(testimonial)}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-[#2e3650] rounded-lg transition-colors"
                  >
                    <Pencil size={20} />
                  </motion.button>
                  <OverflowMenu
                    items={[
                      {
                        label: 'Eliminar',
                        icon: <Trash2 size={14} />,
                        danger: true,
                        onClick: () =>
                          setConfirm({
                            title: `¿Eliminar testimonio de ${testimonial.clientName}?`,
                            onConfirm: () => {
                              deleteMutation.mutate(testimonial.id);
                              setConfirm(null);
                            },
                          }),
                      },
                    ]}
                  />
                </div>
              </div>
            </motion.div>
          ))}
          {testimonials.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              No hay testimonios. Crea el primero.
            </div>
          )}
          {hasNextPage && (
            <div className="flex justify-center mt-2">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-4 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-[#242938] hover:bg-gray-50 dark:hover:bg-[#2e3650] disabled:opacity-50 transition-colors"
              >
                {isFetchingNextPage ? 'Cargando...' : 'Cargar más'}
              </button>
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

      <AdminFormModal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={isEditing ? 'Editar testimonio' : 'Nuevo testimonio'}
      >
        <TestimonialForm
          initial={isEditing ? modal : undefined}
          onSave={(form) =>
            isEditing
              ? updateMutation.mutate({ id: modal.id, formData: buildFormData(form) })
              : createMutation.mutate(buildFormData(form))
          }
          onCancel={() => setModal(null)}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      </AdminFormModal>
    </motion.div>
  );
}
