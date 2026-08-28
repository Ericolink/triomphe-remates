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
import { createLead, getLeads, batchUpdateLeads, batchDeleteLeads } from '../../../services/leadService';
import { getTasks } from '../../../services/taskService';
import { getUsers } from '../../../services/usersService';
import useAuthStore from '../../../store/authStore';
import { canCreateLeads, canDeleteLeads } from '../../../utils/permissions';
import { downloadBlob } from '../../../utils/download';
import Badge from '../../ui/Badge';
import Spinner from '../../ui/Spinner';
import ConfirmDialog from '../../ui/ConfirmDialog';
import BatchActionBar from '../../ui/BatchActionBar';
import CreateLeadModal from '../CreateLeadModal';
import KanbanBoard, { NextActionLine } from '../KanbanBoard';
import { DetailPanelSlot } from '../LeadDetailPanel';
import useLeadDetailActions from './useLeadDetailActions';
import LeadDetailModals from './LeadDetailModals';
import { fadeIn, fadeInUp, staggerContainer } from '../../../utils/animations';
import { formatDate, formatBudget } from '../../../utils/formatters';
import {
  SOURCE_LABELS,
  LEAD_TYPE_LABELS as typeLabel,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_VARIANTS,
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
  // Separado del `confirm` interno de useLeadDetailActions (que es para eliminar UN
  // prospecto desde su detalle) — este es específicamente para el borrado en lote de
  // BatchActionBar, que no pasa por ahí.
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(null);
  const [checked, setChecked] = useState([]);
  const [view, setView] = useState('list');
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const assignedToUserId = onlyMine ? currentUserId : '';

  const leadActions = useLeadDetailActions({ selected, setSelected });
  const { attemptStageChange, setSheetLead } = leadActions;

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
              updateMutation={leadActions.updateMutation}
              users={users}
              onOpenStagePicker={(lead) => setSheetLead(lead)}
              onChangeStage={attemptStageChange}
              onDeselect={() => setSelected(null)}
              emptyText="Haz clic en un prospecto para ver el detalle"
              onDelete={leadActions.handleDelete}
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
              updateMutation={leadActions.updateMutation}
              users={users}
              onOpenStagePicker={(lead) => setSheetLead(lead)}
              onChangeStage={attemptStageChange}
              onDeselect={() => setSelected(null)}
              emptyText="Selecciona un prospecto para ver el detalle"
              onDelete={leadActions.handleDelete}
            />
          </div>
        </div>
      )}

      <LeadDetailModals actions={leadActions} />

      <ConfirmDialog
        open={!!batchDeleteConfirm}
        title={batchDeleteConfirm?.title}
        message={batchDeleteConfirm?.message}
        confirmLabel="Eliminar"
        onConfirm={batchDeleteConfirm?.onConfirm}
        onCancel={() => setBatchDeleteConfirm(null)}
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
          // Sin onDelete, BatchActionBar oculta el botón en vez de ofrecer una acción que
          // el backend rechazaría con 403 (ver canDeleteLeads / routes/leads.js).
          onDelete={
            canDeleteLeads(currentUser)
              ? () =>
                  setBatchDeleteConfirm({
                    title: `¿Eliminar ${checked.length} prospecto(s)?`,
                    message: 'Esta acción no se puede deshacer.',
                    onConfirm: () => {
                      batchDeleteMutation.mutate(checked);
                      setBatchDeleteConfirm(null);
                    },
                  })
              : undefined
          }
        />
      )}
    </motion.div>
  );
}
