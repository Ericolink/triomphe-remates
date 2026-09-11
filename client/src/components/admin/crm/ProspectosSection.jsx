import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Phone,
  Building2,
  FileSpreadsheet,
  Plus,
  Search,
  User,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import {
  createLead,
  getLeads,
  getLeadsCountByResponsible,
  getLeadById,
  batchUpdateLeads,
  batchDeleteLeads,
} from '../../../services/leadService';
import { getUsers } from '../../../services/usersService';
import useAuthStore from '../../../store/authStore';
import {
  canCreateLeads,
  canDeleteLeads,
  canFilterLeadsByResponsible,
} from '../../../utils/permissions';
import { downloadBlob, fileTimestamp } from '../../../utils/download';
import Spinner from '../../ui/Spinner';
import ConfirmDialog from '../../ui/ConfirmDialog';
import BatchActionBar from '../../ui/BatchActionBar';
import GradientListCard from '../../ui/GradientListCard';
import Badge from '../../ui/Badge';
import CreateLeadModal from '../CreateLeadModal';
import { DetailPanelSlot } from '../LeadDetailPanel';
import useLeadDetailActions from './useLeadDetailActions';
import LeadDetailModals from './LeadDetailModals';
import { fadeIn, fadeInUp, staggerContainer } from '../../../utils/animations';
import { formatDate, formatBudget, daysSince } from '../../../utils/formatters';
import {
  SOURCE_LABELS,
  LEAD_TYPE_LABELS as typeLabel,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_CARD_COLORS,
  NON_TERMINAL_PIPELINE_STAGE_OPTIONS,
  PAYMENT_METHOD_LABELS,
  BUSINESS_LINE_LABELS,
  BUSINESS_LINE_VARIANTS,
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
  // Igual que `stage`: solo lee la URL una vez al montar, no se vuelve a sincronizar
  // después — sobrevive un refresh y un deep link desde el Dashboard (?staleDays=7).
  const [staleDays, setStaleDays] = useState(searchParams.get('staleDays') || '');
  const [selected, setSelected] = useState(null);

  // Deep-link "Ver prospecto" (ej. desde el dashboard del asesor, ?tab=prospectos&leadId=N)
  // — igual que CalendarioSection.handleViewLead, trae el registro completo (el que venga
  // en otro contexto puede estar recortado) y abre el mismo panel de detalle. Solo al
  // montar, mismo criterio que stage/staleDays arriba.
  useEffect(() => {
    const leadId = searchParams.get('leadId');
    if (!leadId) return;
    getLeadById(leadId)
      .then((res) => setSelected(res.data))
      .catch(() => toast.error('No se pudo abrir el prospecto'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Separado del `confirm` interno de useLeadDetailActions (que es para eliminar UN
  // prospecto desde su detalle) — este es específicamente para el borrado en lote de
  // BatchActionBar, que no pasa por ahí.
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(null);
  const [checked, setChecked] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [businessLine, setBusinessLine] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  // Filtro "Responsable" — exclusivo de admin/asistente_administrativo (los únicos roles
  // para los que ver/filtrar por CUALQUIER responsable tiene sentido, ver
  // canFilterLeadsByResponsible). '' = Todos, 'unassigned' = sin responsable, o el id de un
  // usuario. Mutuamente excluyente con "Mis prospectos" (activar uno resetea el otro) para
  // que ambos controles no compitan por el mismo parámetro `assignedToUserId`.
  const canFilterResponsible = canFilterLeadsByResponsible(currentUser);
  const [responsibleFilter, setResponsibleFilter] = useState('');
  const assignedToUserId = onlyMine
    ? currentUserId
    : (canFilterResponsible && responsibleFilter) || '';
  const hasActiveFilters =
    !!search ||
    !!stage ||
    !!staleDays ||
    onlyMine ||
    !!businessLine ||
    !!paymentMethod ||
    (canFilterResponsible && !!responsibleFilter);

  const clearFilters = () => {
    setSearch('');
    setStage('');
    setStaleDays('');
    setOnlyMine(false);
    setBusinessLine('');
    setPaymentMethod('');
    setResponsibleFilter('');
    setChecked([]);
  };

  const leadActions = useLeadDetailActions({ selected, setSelected });
  const { attemptStageChange, setSheetLead } = leadActions;

  // AUDIT: pedía `limit: 100` y nunca avanzaba de página — el backend (getLeads) ya pagina
  // correctamente, así que con >100 prospectos el conteo mostrado era real pero la lista
  // se veía truncada en silencio. Ahora usa useInfiniteQuery + "Cargar más".
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['leads', stage, staleDays, search, assignedToUserId, businessLine, paymentMethod],
    queryFn: ({ pageParam = 1 }) =>
      getLeads({
        pipelineStage: stage,
        staleDays: staleDays || undefined,
        page: pageParam,
        limit: LEADS_LIST_PAGE_SIZE,
        search: search || undefined,
        assignedToUserId: assignedToUserId || undefined,
        businessLine: businessLine || undefined,
        paymentMethod: paymentMethod || undefined,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });
  const leads = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const leadsTotal = data?.pages?.[0]?.pagination?.total ?? 0;

  const { data: usersData } = useQuery({ queryKey: ['users-all'], queryFn: getUsers });
  const users = usersData?.data ?? [];
  const assignableUsers = users.filter((u) => u.isActive);

  // Resumen "prospectos por responsable" — mismos filtros que la lista (menos el propio
  // responsable, que aquí se agrupa en vez de filtrarse a un valor puntual) para que refleje
  // exactamente lo que el admin/asistente tiene filtrado en pantalla. Solo se pide si el rol
  // puede ver el selector — evita una llamada de red que el backend rechazaría con 403 para
  // coordinador/asesor.
  const { data: countsData } = useQuery({
    queryKey: ['leads-counts-by-responsible', stage, staleDays, search, businessLine, paymentMethod],
    queryFn: () =>
      getLeadsCountByResponsible({
        pipelineStage: stage,
        staleDays: staleDays || undefined,
        search: search || undefined,
        businessLine: businessLine || undefined,
        paymentMethod: paymentMethod || undefined,
      }),
    enabled: canFilterResponsible,
  });
  const responsibleCounts = countsData?.data ?? [];

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
      downloadBlob(response.data, `triomphe-prospectos-${fileTimestamp()}.xlsx`);
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
          {canFilterResponsible && responsibleFilter && (
            <>
              {' · Responsable: '}
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {responsibleFilter === 'unassigned'
                  ? 'Sin asignar'
                  : assignableUsers.find((u) => String(u.id) === responsibleFilter)?.name ||
                    'Sin asignar'}
              </span>
            </>
          )}
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
              onClick={() => {
                setOnlyMine((v) => !v);
                setResponsibleFilter('');
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                onlyMine
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white dark:bg-[#242938] border-gray-200 dark:border-[#2e3650] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650]'
              }`}
            >
              <UserCheck size={15} /> Mis prospectos
            </button>
          )}
          {canFilterResponsible && (
            <select
              aria-label="Filtrar por responsable"
              value={responsibleFilter}
              onChange={(e) => {
                setResponsibleFilter(e.target.value);
                setOnlyMine(false);
                setChecked([]);
              }}
              className={`px-3 py-2 border rounded-xl text-sm focus:outline-none ${
                responsibleFilter
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                  : 'border-gray-200 dark:border-[#2e3650] bg-white dark:bg-[#242938] dark:text-gray-100'
              }`}
            >
              <option value="">Responsable: todos</option>
              <option value="unassigned">Sin asignar</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
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
          <select
            value={staleDays}
            onChange={(e) => {
              setStaleDays(e.target.value);
              setChecked([]);
            }}
            className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
          >
            <option value="">Actividad: todas</option>
            <option value="5">Sin actividad 5+ días</option>
            <option value="10">Sin actividad 10+ días</option>
            <option value="15">Sin actividad 15+ días</option>
            <option value="30">Sin actividad 30+ días</option>
          </select>
          <select
            value={businessLine}
            onChange={(e) => {
              setBusinessLine(e.target.value);
              setChecked([]);
            }}
            className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
          >
            <option value="">Todas las líneas de negocio</option>
            {Object.entries(BUSINESS_LINE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value);
              setChecked([]);
            }}
            className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
          >
            <option value="">Todos los métodos de pago</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-[#242938] hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </motion.div>

      {/* Resumen de supervisión "prospectos por responsable" — exclusivo de
          admin/asistente_administrativo (ver canFilterLeadsByResponsible). Cada pastilla es
          también un atajo: clic para filtrar la lista a ese responsable (clic de nuevo para
          quitarlo). Los conteos respetan los mismos filtros activos arriba (ciudad vía
          `search`, línea de negocio, forma de pago, etapa, actividad). */}
      {canFilterResponsible && responsibleCounts.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="flex flex-wrap items-center gap-2 mb-6 -mt-3"
        >
          <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">
            Prospectos por responsable:
          </span>
          {responsibleCounts.map(({ userId, user, count }) => {
            const value = userId === null ? 'unassigned' : String(userId);
            const label = userId === null ? 'Sin asignar' : user?.name || 'Sin asignar';
            const active = responsibleFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setResponsibleFilter(active ? '' : value);
                  setOnlyMine(false);
                  setChecked([]);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'bg-white dark:bg-[#242938] border-gray-200 dark:border-[#2e3650] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650]'
                }`}
              >
                {label} — {count}
              </button>
            );
          })}
        </motion.div>
      )}

      {/* xl:grid-cols-5 (60/40) solo se activa con un prospecto seleccionado — sin eso, el
          panel de detalle (columna derecha) reservaba 40% del ancho todo el tiempo, incluso
          vacío, dejando la tabla/lista comprimida en 60% de forma innecesaria. Sin selección
          la lista usa el ancho completo; DetailPanelSlot sigue montado siempre (solo se le
          quita la columna con `xl:hidden`, nunca se desmonta) para no interferir con sus
          transiciones de entrada/salida (AnimatePresence, overlay <xl y fade en xl+). */}
      <div className={`grid grid-cols-1 gap-6 ${selected ? 'xl:grid-cols-5' : ''}`}>
        <div className={`${selected ? 'xl:col-span-3' : ''} space-y-3`}>
            {isLoading ? (
              <Spinner size="lg" className="py-16" />
            ) : (
              <>
                {/* Mobile/tablet (<lg): tarjetas apiladas — una tabla no cabría sin scroll
                    horizontal en estos anchos, así que se conserva el patrón original. */}
                <div className="lg:hidden space-y-3">
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
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="space-y-3"
                  >
                    <AnimatePresence>
                      {leads.map((lead) => {
                        const colors = PIPELINE_STAGE_CARD_COLORS[lead.pipelineStage];
                        return (
                          <GradientListCard
                            key={lead.id}
                            checked={checked.includes(lead.id)}
                            onCheckToggle={(e) => toggleCheck(e, lead.id)}
                            checkLabel={`Seleccionar prospecto ${lead.name}`}
                            onClick={() => leadActions.requestSelectLead(lead)}
                            selected={selected?.id === lead.id}
                            gradientClass={colors.gradient}
                          >
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
                              <div className="flex flex-col items-end gap-1">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}
                                >
                                  {PIPELINE_STAGE_LABELS[lead.pipelineStage]}
                                </span>
                                {lead.businessLine && (
                                  <Badge variant={BUSINESS_LINE_VARIANTS[lead.businessLine]}>
                                    {BUSINESS_LINE_LABELS[lead.businessLine]}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <User size={12} /> {lead.assignedUser?.name || 'Sin asignar'}
                              </span>
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
                                  <Wallet size={12} /> {PAYMENT_METHOD_LABELS[lead.paymentMethod]}{' '}
                                  · {formatBudget(lead.budgetAmount, lead.budgetNotSpecified)}
                                </span>
                              )}
                            </div>
                            {staleDays && lead.lastTouchedAt && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                Sin actividad hace {daysSince(lead.lastTouchedAt)} día
                                {daysSince(lead.lastTouchedAt) !== 1 ? 's' : ''}
                              </p>
                            )}
                            {lead.message && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 line-clamp-2">
                                {lead.message}
                              </p>
                            )}
                          </GradientListCard>
                        );
                      })}
                    </AnimatePresence>
                  </motion.div>
                </div>

                {/* Desktop (lg+): tabla real, con encabezado sticky (top-0 relativo al
                    scroll de <main> en AdminLayout — mismo contenedor de scroll que ya usa
                    el panel de detalle con `sticky top-6`, ver LeadDetailPanel). No lleva
                    wrapper con overflow-x/overflow-hidden: cualquier ancestro con overflow
                    != visible rompe el `position: sticky` de los <th> porque se vuelve su
                    nuevo contenedor de scroll (uno que nunca se desplaza, porque su altura
                    es auto). table-fixed + <colgroup> (en vez de table-auto) es igual de
                    importante: con table-auto, `width:100%` en <table> es solo una sugerencia
                    — si el contenido no cabe (ej. con el panel de detalle abierto, 60% del
                    ancho) el navegador igual expande la tabla más allá de su contenedor en
                    vez de encogerla, y las columnas terminan solapadas con el panel. Con
                    table-fixed las columnas SÍ respetan el ancho asignado y el contenido que
                    no entra se trunca (truncate/line-clamp) o hace wrap, nunca desborda. */}
                {leads.length > 0 && (
                  <div className="hidden lg:block bg-white dark:bg-[#242938] rounded-2xl border border-gray-100 dark:border-[#2e3650]">
                    <table className="w-full text-sm border-collapse table-fixed">
                      <colgroup>
                        <col style={{ width: '3.5%' }} />
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '10.5%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '12.5%' }} />
                        <col style={{ width: '13.5%' }} />
                        {staleDays && <col style={{ width: '8%' }} />}
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="sticky top-0 z-10 bg-gray-50 dark:bg-[#1f2432] border-b border-gray-100 dark:border-[#2e3650] rounded-tl-2xl px-3 py-3 text-left w-10">
                            <input
                              type="checkbox"
                              checked={allChecked}
                              onChange={toggleAll}
                              aria-label={allChecked ? 'Deseleccionar todos' : 'Seleccionar todos'}
                              className="w-4 h-4 rounded accent-accent-400 cursor-pointer"
                            />
                          </th>
                          {(staleDays
                            ? [
                                'Prospecto',
                                'Etapa',
                                'Línea de negocio',
                                'Responsable',
                                'Contacto',
                                'Propiedad',
                                'Pago',
                                'Notas',
                                'Actividad',
                              ]
                            : [
                                'Prospecto',
                                'Etapa',
                                'Línea de negocio',
                                'Responsable',
                                'Contacto',
                                'Propiedad',
                                'Pago',
                                'Notas',
                              ]
                          ).map((label, i, arr) => (
                            <th
                              key={label}
                              className={`sticky top-0 z-10 bg-gray-50 dark:bg-[#1f2432] border-b border-gray-100 dark:border-[#2e3650] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 break-words ${
                                i === arr.length - 1 ? 'rounded-tr-2xl' : ''
                              }`}
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((lead) => {
                          const colors = PIPELINE_STAGE_CARD_COLORS[lead.pipelineStage];
                          const isSelected = selected?.id === lead.id;
                          return (
                            <tr
                              key={lead.id}
                              onClick={() => leadActions.requestSelectLead(lead)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  leadActions.requestSelectLead(lead);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              className={`border-b border-gray-50 dark:border-[#2e3650]/60 last:border-0 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500 ${
                                isSelected
                                  ? 'bg-accent-50 dark:bg-accent-900/10'
                                  : 'hover:bg-gray-50 dark:hover:bg-[#2e3650]/40'
                              }`}
                            >
                              <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={checked.includes(lead.id)}
                                  onChange={(e) => toggleCheck(e, lead.id)}
                                  aria-label={`Seleccionar prospecto ${lead.name}`}
                                  className="w-4 h-4 rounded accent-accent-400 cursor-pointer"
                                />
                              </td>
                              <td className="px-3 py-3 align-top">
                                <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                                  {lead.name}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                  {formatDate(lead.createdAt)} · {typeLabel[lead.type]}
                                  {lead.source && lead.source !== 'directo'
                                    ? ` · ${SOURCE_LABELS[lead.source]}`
                                    : ''}
                                </p>
                              </td>
                              <td className="px-3 py-3 align-top">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}
                                >
                                  {PIPELINE_STAGE_LABELS[lead.pipelineStage]}
                                </span>
                              </td>
                              <td className="px-3 py-3 align-top">
                                {lead.businessLine ? (
                                  <Badge variant={BUSINESS_LINE_VARIANTS[lead.businessLine]}>
                                    {BUSINESS_LINE_LABELS[lead.businessLine]}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-300 dark:text-gray-600">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3 align-top text-gray-600 dark:text-gray-300">
                                <span className="flex items-center gap-1 min-w-0">
                                  <User size={12} className="text-gray-400 flex-shrink-0" />
                                  <span className="truncate">
                                    {lead.assignedUser?.name || 'Sin asignar'}
                                  </span>
                                </span>
                              </td>
                              <td className="px-3 py-3 align-top text-gray-600 dark:text-gray-300">
                                {lead.email && (
                                  <p className="flex items-center gap-1 min-w-0" title={lead.email}>
                                    <Mail size={12} className="text-gray-400 flex-shrink-0" />
                                    <span className="truncate">{lead.email}</span>
                                  </p>
                                )}
                                {lead.phone && (
                                  <p className="flex items-center gap-1 mt-0.5">
                                    <Phone size={12} className="text-gray-400 flex-shrink-0" />
                                    {lead.phone}
                                  </p>
                                )}
                                {!lead.email && !lead.phone && (
                                  <span className="text-gray-300 dark:text-gray-600">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3 align-top text-gray-600 dark:text-gray-300">
                                {lead.property ? (
                                  <span
                                    className="flex items-center gap-1 min-w-0"
                                    title={lead.property.title}
                                  >
                                    <Building2 size={12} className="text-gray-400 flex-shrink-0" />
                                    <span className="truncate">{lead.property.title}</span>
                                  </span>
                                ) : (
                                  <span className="text-gray-300 dark:text-gray-600">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3 align-top text-gray-600 dark:text-gray-300">
                                {lead.paymentMethod ? (
                                  <span className="flex items-center gap-1">
                                    <Wallet size={12} className="text-gray-400 flex-shrink-0" />
                                    {PAYMENT_METHOD_LABELS[lead.paymentMethod]} ·{' '}
                                    {formatBudget(lead.budgetAmount, lead.budgetNotSpecified)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 dark:text-gray-600">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3 align-top text-gray-500 dark:text-gray-400">
                                {lead.message ? (
                                  <span className="line-clamp-2" title={lead.message}>
                                    {lead.message}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 dark:text-gray-600">—</span>
                                )}
                              </td>
                              {staleDays && (
                                <td className="px-3 py-3 align-top">
                                  {lead.lastTouchedAt ? (
                                    <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                                      {daysSince(lead.lastTouchedAt)} día
                                      {daysSince(lead.lastTouchedAt) !== 1 ? 's' : ''}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300 dark:text-gray-600">—</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
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
                {hasActiveFilters ? (
                  <>
                    <p>Ningún prospecto coincide con los filtros seleccionados.</p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-2 text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                    >
                      Limpiar filtros
                    </button>
                  </>
                ) : (
                  <p>Todavía no se ha recibido ningún prospecto.</p>
                )}
              </motion.div>
            )}
          </div>

          {/* Detalle — `xl:hidden` (no `hidden` a secas) cuando no hay selección: por debajo
              de xl ya era invisible por su propio "hidden xl:block" interno para la rama de
              escritorio, y el overlay móvil (fixed inset-0, con su propio `xl:hidden`) sigue
              intacto porque nunca se desmonta este wrapper. */}
          <div className={selected ? 'xl:col-span-2' : 'xl:hidden'}>
            <DetailPanelSlot
              selected={selected}
              pendingChanges={leadActions.pendingChanges}
              onFieldChange={leadActions.stageFieldChange}
              users={users}
              onOpenStagePicker={(lead) => setSheetLead(lead)}
              onChangeStage={attemptStageChange}
              onDeselect={leadActions.requestDeselect}
              emptyText="Selecciona un prospecto para ver el detalle"
              onDelete={leadActions.handleDelete}
            />
          </div>
        </div>
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
    </motion.div>
  );
}
