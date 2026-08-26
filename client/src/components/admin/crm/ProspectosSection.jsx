import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Phone,
  Building2,
  FileSpreadsheet,
  LayoutList,
  Columns,
  Plus,
  Search,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  batchUpdateLeads,
  batchDeleteLeads,
  closeLeadAsWon,
  closeLeadAsLost,
  reopenLead,
} from '../../../services/leadService';
import { getTasks } from '../../../services/taskService';
import { getUsers } from '../../../services/usersService';
import useAuthStore from '../../../store/authStore';
import { canCreateLeads, isAdmin } from '../../../utils/permissions';
import { downloadBlob } from '../../../utils/download';
import Badge from '../../ui/Badge';
import Spinner from '../../ui/Spinner';
import ConfirmDialog from '../../ui/ConfirmDialog';
import BatchActionBar from '../../ui/BatchActionBar';
import CloseLeadModal from '../CloseLeadModal';
import ReopenLeadModal from '../ReopenLeadModal';
import StageBottomSheet from '../StageBottomSheet';
import CreateLeadModal from '../CreateLeadModal';
import KanbanBoard, { NextActionLine } from '../KanbanBoard';
import { DetailPanelSlot } from '../LeadDetailPanel';
import { fadeIn, fadeInUp, staggerContainer } from '../../../utils/animations';
import { formatDate, formatBudget } from '../../../utils/formatters';
import {
  SOURCE_LABELS,
  LEAD_TYPE_LABELS as typeLabel,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_VARIANTS,
  TERMINAL_STAGES,
  NON_TERMINAL_PIPELINE_STAGE_OPTIONS,
  PAYMENT_METHOD_LABELS,
} from '../../../utils/constants';

const LEADS_LIST_PAGE_SIZE = 20;

export default function ProspectosSection() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?.id;
  // Permite llegar aquí ya filtrado desde el dashboard (ej. tarjeta "Prospectos nuevos"),
  // vía ?stage= en la URL en vez de location.state — así sobrevive un refresh.
  const [stage, setStage] = useState(searchParams.get('stage') || '');
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [checked, setChecked] = useState([]);
  const [view, setView] = useState('list');
  const [closeTarget, setCloseTarget] = useState(null); // { lead, targetStage }
  const [reopenTarget, setReopenTarget] = useState(null); // { lead, targetStage }
  const [sheetLead, setSheetLead] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const assignedToUserId = onlyMine ? currentUserId : '';

  // Búsqueda y "Mis prospectos" son compartidos entre Lista y Kanban — barra persistente
  // por encima de ambas vistas, tal como pide CRM_UX_DESIGN.md §2g.
  // AUDIT: pedía `limit: 100` y nunca avanzaba de página — el backend (getLeads) ya pagina
  // correctamente, así que con >100 prospectos el conteo mostrado era real pero la lista
  // se veía truncada en silencio. Ahora usa el mismo patrón useInfiniteQuery + "Cargar más"
  // que ya prueba el Kanban de esta misma pantalla (useColumnLeads en KanbanBoard.jsx).
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['leads', stage, search, assignedToUserId],
    queryFn: ({ pageParam = 1 }) =>
      getLeads({
        pipelineStage: stage,
        page: pageParam,
        limit: LEADS_LIST_PAGE_SIZE,
        search: search || undefined,
        assignedToUserId: assignedToUserId || undefined,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });
  const leads = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const leadsTotal = data?.pages?.[0]?.pagination?.total ?? 0;

  const { data: usersData } = useQuery({ queryKey: ['users-all'], queryFn: getUsers });
  const users = usersData?.data ?? [];

  // Usada por la vista Lista (que sigue trayendo un solo lote de prospectos). El Kanban
  // ya no depende de esto: cada columna resuelve sus propias tareas abiertas. `leadIds` se
  // recorta a MAX_BATCH_IDS (100) porque /api/tasks lo exige — con "Cargar más" acumulando
  // páginas, una sesión larga puede superar ese tope; el indicador de "próxima acción" solo
  // deja de calcularse para el excedente, no rompe el resto de la lista.
  const leadIds = useMemo(() => leads.slice(0, 100).map((l) => l.id), [leads]);
  const { data: openTasksData } = useQuery({
    queryKey: ['open-tasks', leadIds.join(',')],
    queryFn: () => getTasks({ leadIds: leadIds.join(','), done: false }),
    enabled: leadIds.length > 0,
  });
  const openTaskByLead = useMemo(() => {
    const map = {};
    (openTasksData?.data ?? []).forEach((t) => {
      map[t.leadId] = t;
    });
    return map;
  }, [openTasksData]);

  const { data: closeLeadDetail } = useQuery({
    queryKey: ['lead-detail-for-close', closeTarget?.lead?.id],
    queryFn: () => getLeadById(closeTarget.lead.id),
    enabled: !!closeTarget?.lead?.id,
  });

  // Sin toast global de éxito: cada campo editado desde LeadDetailPanel confirma junto al
  // propio campo (ver FieldStatus ahí), y un movimiento de etapa por drag/hoja ya es
  // visible por sí mismo (la tarjeta cambia de columna / la etapa del encabezado cambia).
  // El error sí necesita feedback explícito en ambos casos — cada punto de llamada de
  // `.mutate()` pasa su propio onError (LeadDetailPanel usa el suyo por-campo; el drag/
  // hoja de abajo usa un toast, porque ahí no hay un campo visible contra el cual mostrarlo).
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateLead(id, data),
    onSuccess: (res, { data: updated }) => {
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['lead-detail']);
      // Este mutation se usa para cualquier campo editable del detalle (fuente, forma de
      // pago, monto, fecha de primer contacto, etc.), pero las 8 columnas del Kanban y sus
      // tareas abiertas solo cambian si se movió de etapa o se (re)asignó responsable —
      // invalidar siempre esas ~16 queries en cada edición menor agotaba el rate limit
      // (ver AUDIT: 429 en /api/leads tras editar un campo cualquiera del detalle).
      const affectsColumns = updated.pipelineStage !== undefined;
      const affectsTasks = affectsColumns || updated.assignedToUserId !== undefined;
      if (affectsColumns) queryClient.invalidateQueries(['leads-column']);
      if (affectsTasks) {
        queryClient.invalidateQueries(['open-tasks']);
        queryClient.invalidateQueries(['open-tasks-column']);
      }
      if (updated.pipelineStage)
        setSelected((s) => (s ? { ...s, pipelineStage: updated.pipelineStage } : s));
    },
  });

  const closeWonMutation = useMutation({
    mutationFn: ({ id, data }) => closeLeadAsWon(id, data),
    onSuccess: () => {
      toast.success('Venta registrada exitosamente');
      setCloseTarget(null);
      setSelected(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
      queryClient.invalidateQueries(['open-tasks']);
      queryClient.invalidateQueries(['open-tasks-column']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al registrar la venta'),
  });

  const closeLostMutation = useMutation({
    mutationFn: ({ id, data }) => closeLeadAsLost(id, data),
    onSuccess: () => {
      toast.success('Prospecto cerrado');
      setCloseTarget(null);
      setSelected(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
      queryClient.invalidateQueries(['open-tasks']);
      queryClient.invalidateQueries(['open-tasks-column']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al cerrar el prospecto'),
  });

  const reopenMutation = useMutation({
    mutationFn: ({ id, pipelineStage }) => reopenLead(id, { pipelineStage }),
    onSuccess: (res) => {
      toast.success('Prospecto reabierto');
      setReopenTarget(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
      queryClient.invalidateQueries(['lead-detail']);
      queryClient.invalidateQueries(['open-tasks']);
      queryClient.invalidateQueries(['open-tasks-column']);
      // A diferencia de close-won/close-lost (que deseleccionan al cerrar), aquí conviene
      // dejar el panel abierto: reabrir es el punto de partida para seguir trabajando el
      // prospecto (asignar responsable, etc.), no el final de su ciclo de vida.
      setSelected((s) => (s ? { ...s, pipelineStage: res.data.pipelineStage } : s));
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al reabrir el prospecto'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLead,
    onSuccess: () => {
      toast.success('Prospecto eliminado');
      setSelected(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
    },
  });

  const createMutation = useMutation({
    mutationFn: createLead,
    onSuccess: () => {
      toast.success('Prospecto creado exitosamente');
      setCreateOpen(false);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al crear el prospecto'),
  });

  const batchStatusMutation = useMutation({
    mutationFn: ({ ids, stage: s }) => batchUpdateLeads(ids, s),
    onSuccess: (_, { ids }) => {
      toast.success(`${ids.length} prospecto(s) actualizados`);
      setChecked([]);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
      queryClient.invalidateQueries(['open-tasks-column']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al actualizar en lote'),
  });

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteLeads,
    onSuccess: (_, ids) => {
      toast.success(`${ids.length} prospecto(s) eliminados`);
      setChecked([]);
      setSelected(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
    },
  });

  // Único punto de entrada para cambiar de etapa (drag, bottom sheet o botón del
  // detalle): las etapas terminales siempre pasan por el modal de cierre, y sacar un
  // prospecto YA cerrado de su etapa terminal siempre pasa por el modal de reapertura —
  // el PUT genérico (updateMutation) rechaza ese caso en el backend (ver updateLead), así
  // que nunca debe intentarse directamente desde aquí.
  const attemptStageChange = (lead, newStage) => {
    if (newStage === lead.pipelineStage) return;
    if (TERMINAL_STAGES.includes(newStage)) {
      setCloseTarget({ lead, targetStage: newStage });
      setSheetLead(null);
    } else if (TERMINAL_STAGES.includes(lead.pipelineStage)) {
      setReopenTarget({ lead, targetStage: newStage });
      setSheetLead(null);
    } else {
      updateMutation.mutate(
        { id: lead.id, data: { pipelineStage: newStage } },
        { onError: (e) => toast.error(e?.response?.data?.error || 'Error al cambiar de etapa') }
      );
      setSheetLead(null);
    }
  };

  const toggleCheck = (e, id) => {
    e.stopPropagation();
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    const ids = leads.map((l) => l.id);
    setChecked(checked.length === ids.length ? [] : ids);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (stage) params.append('status', stage);
      const response = await api.get(`/export/leads/excel?${params}`, { responseType: 'blob' });
      downloadBlob(response.data, `triomphe-prospectos-${Date.now()}.xlsx`);
    } catch {
      toast.error('Error al exportar');
    }
  };

  const allChecked = leads.length > 0 && checked.length === leads.length;
  const closeLeadForModal = closeLeadDetail?.data || closeTarget?.lead;

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-wrap items-center justify-between gap-3 mb-6"
      >
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {leadsTotal} prospectos registrados
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white dark:bg-[#242938] border border-gray-200 dark:border-[#2e3650] rounded-xl px-3 py-2 w-full sm:w-auto">
            <Search size={16} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 sm:w-48 text-sm focus:outline-none bg-transparent dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>
          {currentUserId && (
            <button
              onClick={() => setOnlyMine((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                onlyMine
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white dark:bg-[#242938] border-gray-200 dark:border-[#2e3650] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650]'
              }`}
            >
              <UserCheck size={15} /> Mis prospectos
            </button>
          )}
          {canCreateLeads(currentUser) && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-accent-400 text-primary-900 rounded-xl text-sm font-medium hover:bg-accent-300 transition-colors"
            >
              <Plus size={16} /> Nuevo prospecto
            </button>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
          >
            <FileSpreadsheet size={16} className="text-green-600" /> Excel
          </button>
          <div className="flex border border-gray-200 dark:border-[#2e3650] rounded-xl overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${view === 'list' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-[#242938] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2e3650]'}`}
            >
              <LayoutList size={15} /> Lista
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${view === 'kanban' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-[#242938] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2e3650]'}`}
            >
              <Columns size={15} /> Kanban
            </button>
          </div>
          <select
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setChecked([]);
            }}
            className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
          >
            <option value="">Todas las etapas</option>
            {Object.entries(PIPELINE_STAGE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {view === 'kanban' ? (
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <KanbanBoard
              filters={{ search, assignedToUserId }}
              focusStage={stage}
              currentUser={currentUser}
              onSelect={setSelected}
              onAttemptStageChange={attemptStageChange}
            />
          </div>
          {/* Sin prospecto seleccionado no se reserva ancho para el panel — así el Kanban
              usa el espacio completo para mostrar las 8 columnas; en cuanto se selecciona
              un prospecto, el panel reclama sus 320px habituales. */}
          <div
            className={
              selected ? 'xl:w-80 flex-shrink-0' : 'xl:w-0 xl:flex-shrink-0 xl:overflow-hidden'
            }
          >
            <DetailPanelSlot
              selected={selected}
              updateMutation={updateMutation}
              users={users}
              onOpenStagePicker={(lead) => setSheetLead(lead)}
              onChangeStage={attemptStageChange}
              onDeselect={() => setSelected(null)}
              emptyText="Haz clic en un prospecto para ver el detalle"
              onDelete={() =>
                setConfirm({
                  title: '¿Eliminar este prospecto?',
                  message: `Se eliminará el contacto de ${selected.name} permanentemente.`,
                  onConfirm: () => {
                    deleteMutation.mutate(selected.id);
                    setConfirm(null);
                  },
                })
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Lista */}
          <div className="xl:col-span-2 space-y-3">
            {leads.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded accent-accent-400 cursor-pointer"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {allChecked ? 'Deseleccionar todos' : 'Seleccionar todos'}
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
                  {leads.map((lead) => (
                    <motion.div
                      key={lead.id}
                      variants={fadeInUp}
                      layout
                      onClick={() => setSelected(lead)}
                      whileHover={{ x: 4, transition: { duration: 0.15 } }}
                      className={`bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border cursor-pointer transition-all ${
                        selected?.id === lead.id
                          ? 'border-accent-500 dark:border-accent-400 ring-1 ring-accent-500'
                          : 'border-gray-100 dark:border-[#2e3650]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked.includes(lead.id)}
                          onChange={(e) => toggleCheck(e, lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 w-4 h-4 rounded accent-accent-400 flex-shrink-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-gray-100">
                                {lead.name}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {formatDate(lead.createdAt)} · {typeLabel[lead.type]}
                                {lead.source && lead.source !== 'directo'
                                  ? ` · ${SOURCE_LABELS[lead.source]}`
                                  : ''}
                              </p>
                            </div>
                            <Badge variant={PIPELINE_STAGE_VARIANTS[lead.pipelineStage]}>
                              {PIPELINE_STAGE_LABELS[lead.pipelineStage]}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                            {lead.email && (
                              <span className="flex items-center gap-1">
                                <Mail size={12} /> {lead.email}
                              </span>
                            )}
                            {lead.phone && (
                              <span className="flex items-center gap-1">
                                <Phone size={12} /> {lead.phone}
                              </span>
                            )}
                            {lead.property && (
                              <span className="flex items-center gap-1">
                                <Building2 size={12} /> {lead.property.title}
                              </span>
                            )}
                            {lead.paymentMethod && (
                              <span className="flex items-center gap-1">
                                <Wallet size={12} /> {PAYMENT_METHOD_LABELS[lead.paymentMethod]} ·{' '}
                                {formatBudget(lead.budgetAmount, lead.budgetNotSpecified)}
                              </span>
                            )}
                          </div>
                          <NextActionLine task={openTaskByLead[lead.id]} />
                          {lead.message && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 line-clamp-2">
                              {lead.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
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
            {!isLoading && leads.length === 0 && (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="text-center py-16 text-gray-400 dark:text-gray-500"
              >
                {stage ? (
                  <>
                    <p>No hay prospectos en esta etapa.</p>
                    <button
                      type="button"
                      onClick={() => setStage('')}
                      className="mt-2 text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                    >
                      Ver todos los prospectos
                    </button>
                  </>
                ) : (
                  <p>Todavía no se ha recibido ningún prospecto.</p>
                )}
              </motion.div>
            )}
          </div>

          {/* Detalle */}
          <div className="xl:col-span-1">
            <DetailPanelSlot
              selected={selected}
              updateMutation={updateMutation}
              users={users}
              onOpenStagePicker={(lead) => setSheetLead(lead)}
              onChangeStage={attemptStageChange}
              onDeselect={() => setSelected(null)}
              emptyText="Selecciona un prospecto para ver el detalle"
              onDelete={() =>
                setConfirm({
                  title: '¿Eliminar este prospecto?',
                  message: `Se eliminará el contacto de ${selected.name} permanentemente.`,
                  onConfirm: () => {
                    deleteMutation.mutate(selected.id);
                    setConfirm(null);
                  },
                })
              }
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Eliminar"
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />

      <CloseLeadModal
        key={closeTarget ? `${closeTarget.lead.id}:${closeTarget.targetStage}` : 'close-empty'}
        open={!!closeTarget}
        lead={closeLeadForModal}
        targetStage={closeTarget?.targetStage}
        isPending={closeWonMutation.isPending || closeLostMutation.isPending}
        onClose={() => setCloseTarget(null)}
        onConfirmWon={(payload) =>
          closeWonMutation.mutate({ id: closeTarget.lead.id, data: payload })
        }
        onConfirmLost={(payload) =>
          closeLostMutation.mutate({ id: closeTarget.lead.id, data: payload })
        }
      />

      <ReopenLeadModal
        key={reopenTarget ? `${reopenTarget.lead.id}:${reopenTarget.targetStage}` : 'reopen-empty'}
        open={!!reopenTarget}
        lead={reopenTarget?.lead}
        targetStage={reopenTarget?.targetStage}
        isPending={reopenMutation.isPending}
        onClose={() => setReopenTarget(null)}
        onConfirm={(pipelineStage) =>
          reopenMutation.mutate({ id: reopenTarget.lead.id, pipelineStage })
        }
      />

      <StageBottomSheet
        open={!!sheetLead}
        lead={sheetLead}
        onClose={() => setSheetLead(null)}
        onSelectStage={(newStage) => attemptStageChange(sheetLead, newStage)}
      />

      <CreateLeadModal
        open={createOpen}
        isPending={createMutation.isPending}
        onClose={() => setCreateOpen(false)}
        onSubmit={(payload) => createMutation.mutate(payload)}
      />

      {view === 'list' && (
        <BatchActionBar
          count={checked.length}
          onClear={() => setChecked([])}
          statusOptions={NON_TERMINAL_PIPELINE_STAGE_OPTIONS}
          onStatus={(s) => batchStatusMutation.mutate({ ids: checked, stage: s })}
          // DELETE /leads/batch es admin-exclusivo en el backend (routes/leads.js) — sin
          // onDelete, BatchActionBar oculta el botón en vez de ofrecer una acción que
          // siempre devolverá 403.
          onDelete={
            isAdmin(currentUser)
              ? () =>
                  setConfirm({
                    title: `¿Eliminar ${checked.length} prospecto(s)?`,
                    message: 'Esta acción no se puede deshacer.',
                    onConfirm: () => {
                      batchDeleteMutation.mutate(checked);
                      setConfirm(null);
                    },
                  })
              : undefined
          }
        />
      )}
    </motion.div>
  );
}
