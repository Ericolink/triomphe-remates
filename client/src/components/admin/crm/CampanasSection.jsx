import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Megaphone, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  getCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from '../../../services/campaignService';
import { getLeads } from '../../../services/leadService';
import Spinner from '../../ui/Spinner';
import Badge from '../../ui/Badge';
import ConfirmDialog from '../../ui/ConfirmDialog';
import OverflowMenu from '../../ui/OverflowMenu';
import {
  fadeIn,
  fadeInUp,
  staggerContainer,
  buttonHover,
  buttonTap,
} from '../../../utils/animations';
import { formatPrice, formatDate } from '../../../utils/formatters';
import {
  CAMPAIGN_PLATFORM_LABELS,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_VARIANTS,
} from '../../../utils/constants';
import useModalA11y from '../../../hooks/useModalA11y';

const CAMPAIGN_LEADS_PAGE_SIZE = 10;

const emptyForm = {
  platform: 'facebook',
  name: '',
  startDate: '',
  endDate: '',
  budget: '',
};
const CAMPAIGNS_PAGE_SIZE = 20;

function CampaignForm({ initial, onSave, onCancel, isPending }) {
  const [form, setForm] = useState(initial || emptyForm);
  const formId = useId();
  const inputClass =
    'w-full px-3 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label
            htmlFor={`${formId}-name`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Nombre de la campaña *
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            value={form.name}
            placeholder="Ej: Remate Polanco Julio"
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`${formId}-platform`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Plataforma
          </label>
          <select
            id={`${formId}-platform`}
            value={form.platform}
            onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
            className={inputClass}
          >
            {Object.entries(CAMPAIGN_PLATFORM_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`${formId}-budget`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Presupuesto (opcional)
          </label>
          <input
            id={`${formId}-budget`}
            type="number"
            value={form.budget}
            placeholder="50000"
            onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`${formId}-startDate`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Fecha de inicio *
          </label>
          <input
            id={`${formId}-startDate`}
            type="date"
            value={form.startDate?.slice(0, 10) || ''}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`${formId}-endDate`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Fecha de fin (opcional)
          </label>
          <input
            id={`${formId}-endDate`}
            type="date"
            value={form.endDate?.slice(0, 10) || ''}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
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
          disabled={isPending || !form.name || !form.startDate}
          whileHover={buttonHover}
          whileTap={buttonTap}
          className="px-6 py-2.5 bg-accent-400 dark:bg-accent-500 text-primary-900 rounded-xl text-sm font-medium hover:bg-accent-300 dark:hover:bg-accent-400 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Guardando...' : 'Guardar campaña'}
        </motion.button>
      </div>
    </div>
  );
}

function CampaignDetail({ campaignId, onClose }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['campaign-detail', campaignId],
    queryFn: () => getCampaignById(campaignId),
    enabled: !!campaignId,
  });
  const c = data?.data;
  const titleId = useId();
  const panelRef = useModalA11y(true, onClose);

  // Prospectos que llegaron por esta campaña — mismo endpoint/filtro que ya soporta
  // ProspectosSection (?campaignId=), solo que aquí ya viene fijo. Mismo patrón
  // useInfiniteQuery + "Cargar más" que el resto de los listados del CRM (ver
  // ProspectosSection/CampanasSection), en vez de traer todo de una vez.
  const {
    data: leadsData,
    isLoading: leadsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['campaign-leads', campaignId],
    queryFn: ({ pageParam = 1 }) =>
      getLeads({ campaignId, page: pageParam, limit: CAMPAIGN_LEADS_PAGE_SIZE, allStages: true }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!campaignId,
  });
  const leads = useMemo(() => leadsData?.pages.flatMap((p) => p.data) ?? [], [leadsData]);
  const leadsTotal = leadsData?.pages?.[0]?.pagination?.total ?? 0;

  const openLead = (leadId) => {
    onClose();
    navigate(`/admin/crm?tab=prospectos&leadId=${leadId}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-[#242938] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2e3650] w-full max-w-lg max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id={titleId} className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {c?.name || '...'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2e3650]"
          >
            <X size={18} />
          </button>
        </div>
        {isLoading || !c ? (
          <Spinner size="md" className="py-8" />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Prospectos generados', value: c.metrics.leadCount },
                {
                  label: 'Ventas',
                  value: `${c.metrics.dealCount} · ${formatPrice(c.metrics.revenue)}`,
                },
                { label: 'Presupuesto', value: c.budget ? formatPrice(c.budget) : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-[#1a1f2e] rounded-xl p-3">
                  <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
                  <p className="font-bold text-gray-800 dark:text-gray-100">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-[#2e3650]">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
                Prospectos {leadsTotal > 0 ? `(${leadsTotal})` : ''}
              </p>
              {leadsLoading ? (
                <Spinner size="sm" className="py-4" />
              ) : leads.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic py-2">
                  Sin prospectos todavía.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {leads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => openLead(lead.id)}
                      className="w-full flex items-center justify-between gap-2 bg-gray-50 dark:bg-[#1a1f2e] hover:bg-gray-100 dark:hover:bg-[#2e3650] rounded-xl px-3 py-2 text-left transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                          {lead.name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{lead.phone}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge variant={PIPELINE_STAGE_VARIANTS[lead.pipelineStage]}>
                          {PIPELINE_STAGE_LABELS[lead.pipelineStage]}
                        </Badge>
                        <ChevronRight size={14} className="text-gray-300 dark:text-gray-600" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {hasNextPage && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="px-4 py-1.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-[#242938] hover:bg-gray-50 dark:hover:bg-[#2e3650] disabled:opacity-50 transition-colors"
                  >
                    {isFetchingNextPage ? 'Cargando...' : 'Cargar más'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function CampanasSection() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null); // null | 'create' | campaign
  const [confirm, setConfirm] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const modalTitleId = useId();

  // AUDIT: pedía `limit: 100` y nunca avanzaba de página aunque el backend
  // (campaignController.getCampaigns) ya pagina — mismo patrón useInfiniteQuery +
  // "Cargar más" que el resto de listados del CRM.
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['campaigns'],
    queryFn: ({ pageParam = 1 }) => getCampaigns({ page: pageParam, limit: CAMPAIGNS_PAGE_SIZE }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });
  const campaigns = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const campaignsTotal = data?.pages?.[0]?.pagination?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      toast.success('Campaña creada');
      queryClient.invalidateQueries(['campaigns']);
      setModal(null);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al crear'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }) => updateCampaign(id, d),
    onSuccess: () => {
      toast.success('Campaña actualizada');
      queryClient.invalidateQueries(['campaigns']);
      setModal(null);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => {
      toast.success('Campaña eliminada');
      queryClient.invalidateQueries(['campaigns']);
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const isEditing = modal && modal !== 'create';
  const modalPanelRef = useModalA11y(Boolean(modal), () => setModal(null));

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex items-center justify-between mb-6"
      >
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {campaignsTotal} campañas registradas
        </p>
        <motion.button
          whileHover={buttonHover}
          whileTap={buttonTap}
          onClick={() => setModal('create')}
          className="flex items-center gap-2 bg-accent-400 dark:bg-accent-500 text-primary-900 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-accent-300 dark:hover:bg-accent-400 transition-colors"
        >
          <Plus size={16} /> Nueva campaña
        </motion.button>
      </motion.div>

      {isLoading ? (
        <Spinner size="lg" className="py-16" />
      ) : (
        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {campaigns.map((c) => (
            // role="button" en vez de <button>: contiene sus propios botones (editar,
            // menú de opciones) — un <button> no puede envolver otro <button>. El guard
            // target===currentTarget evita que Enter/Espacio en esos controles internos
            // dispare también la apertura del detalle (ver div de acciones más abajo).
            <motion.div
              key={c.id}
              variants={fadeInUp}
              role="button"
              tabIndex={0}
              className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] p-5 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setDetailId(c.id)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDetailId(c.id);
                }
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Megaphone size={14} className="text-indigo-500 flex-shrink-0" />
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 truncate">
                      {c.name}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {CAMPAIGN_PLATFORM_LABELS[c.platform]} · desde {formatDate(c.startDate)}
                    {c.endDate ? ` hasta ${formatDate(c.endDate)}` : ''}
                    {c.budget ? ` · ${formatPrice(c.budget)}` : ''}
                  </p>
                </div>
                {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
                    Solo contiene el click para que no llegue a la tarjeta; no es un control en sí — sus hijos
                    (botón editar, menú de opciones) ya son focalizables y accesibles por teclado por sí mismos. */}
                <div
                  className="flex items-center gap-1 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setModal(c)}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-[#2e3650] rounded-lg transition-colors"
                  >
                    <Pencil size={18} />
                  </motion.button>
                  <OverflowMenu
                    items={[
                      {
                        label: 'Eliminar',
                        icon: <Trash2 size={14} />,
                        danger: true,
                        onClick: () =>
                          setConfirm({
                            title: `¿Eliminar "${c.name}"?`,
                            message:
                              'Los prospectos asociados no se eliminan, solo quedan sin campaña.',
                            onConfirm: () => {
                              deleteMutation.mutate(c.id);
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
          {campaigns.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              No hay campañas. Crea la primera.
            </div>
          )}
          {hasNextPage && (
            <div className="flex justify-center pt-1">
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
        message={confirm?.message}
        confirmLabel="Eliminar"
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />

      <AnimatePresence>
        {detailId && <CampaignDetail campaignId={detailId} onClose={() => setDetailId(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setModal(null);
            }}
          >
            <motion.div
              ref={modalPanelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={modalTitleId}
              tabIndex={-1}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-[#242938] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2e3650] w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-[#2e3650]">
                <h2
                  id={modalTitleId}
                  className="text-lg font-bold text-gray-800 dark:text-gray-100"
                >
                  {isEditing ? 'Editar campaña' : 'Nueva campaña'}
                </h2>
                <button
                  onClick={() => setModal(null)}
                  aria-label="Cerrar"
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2e3650] transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6">
                <CampaignForm
                  initial={isEditing ? modal : undefined}
                  onSave={(form) =>
                    isEditing
                      ? updateMutation.mutate({ id: modal.id, data: form })
                      : createMutation.mutate(form)
                  }
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
