import { useMemo, useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Search, X, Building2, Wallet, Activity, FileText, Calendar } from 'lucide-react';
import { getDeals } from '../../../services/dealService';
import { getLeadActivities } from '../../../services/activityService';
import { getLeadNotes } from '../../../services/leadService';
import { getLeadAppointments } from '../../../services/appointmentService';
import { getUsers } from '../../../services/usersService';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import Spinner from '../../ui/Spinner';
import Badge from '../../ui/Badge';
import { fadeIn, fadeInUp, fadeInRight, staggerContainer } from '../../../utils/animations';
import { formatPrice, formatDate, formatDateTime } from '../../../utils/formatters';
import { CITY_LABELS, ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS } from '../../../utils/constants';
import { buildImageUrl } from '../../../utils/images';
import useModalA11y from '../../../hooks/useModalA11y';

const sectionLabelClass =
  'text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5';
const cardClass = 'rounded-xl bg-gray-50 dark:bg-[#1a1f2e] p-3';

function dealCover(deal) {
  const cover = deal.property?.images?.find((i) => i.isCover) || deal.property?.images?.[0];
  return cover ? buildImageUrl(cover.url, 500) : null;
}

function DealCard({ deal, isSelected, onSelect }) {
  const imageUrl = dealCover(deal);
  return (
    <motion.div
      variants={fadeInUp}
      layout
      onClick={() => onSelect(deal)}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className={`bg-white dark:bg-[#242938] rounded-2xl overflow-hidden shadow-sm border cursor-pointer transition-all ${
        isSelected
          ? 'border-accent-500 dark:border-accent-400 ring-1 ring-accent-500'
          : 'border-gray-100 dark:border-[#2e3650]'
      }`}
    >
      <div className="h-32 bg-gray-100 dark:bg-[#1a1f2e] flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={deal.property?.title} className="w-full h-full object-cover" />
        ) : (
          <Building2 size={28} className="text-gray-300 dark:text-gray-600" />
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">{deal.lead?.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1 mt-0.5">
          <Building2 size={11} className="flex-shrink-0" />
          {deal.property?.title}
          {deal.property?.city ? ` · ${CITY_LABELS[deal.property.city] || deal.property.city}` : ''}
        </p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-base font-bold text-green-600 dark:text-green-400">
            {formatPrice(deal.amount)}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {formatDate(deal.closedAt)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// Panel de solo lectura: el caso ya está cerrado, así que a diferencia de LeadDetailPanel
// no hay controles para editar ni registrar nueva actividad — reutiliza los mismos
// endpoints de actividades/notas/citas del prospecto (un Deal siempre tiene un Lead)
// en vez de duplicar esos datos en el backend de /deals.
function DealDetailPanel({ deal, users, onDeselect }) {
  const leadId = deal.leadId;

  const { data: activitiesData } = useQuery({
    queryKey: ['lead-activities', leadId],
    queryFn: () => getLeadActivities(leadId),
  });
  const activities = activitiesData?.data ?? [];

  const { data: notesData } = useQuery({
    queryKey: ['lead-notes', leadId],
    queryFn: () => getLeadNotes(leadId),
  });
  const notes = notesData?.data ?? [];

  const { data: appointmentsData } = useQuery({
    queryKey: ['lead-appointments', leadId],
    queryFn: () => getLeadAppointments(leadId),
  });
  const appointments = appointmentsData?.data ?? [];

  const advisor = users.find((u) => u.id === deal.lead?.assignedToUserId);
  const imageUrl = dealCover(deal);

  return (
    <motion.div
      key={deal.id}
      variants={fadeInRight}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, x: 20 }}
      className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] sticky top-6 overflow-y-auto max-h-[calc(100vh-170px)]"
    >
      {imageUrl && (
        <div className="h-36 overflow-hidden rounded-t-2xl">
          <img src={imageUrl} alt={deal.property?.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-6">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              Caso de éxito
            </p>
            <h2 className="font-bold text-gray-800 dark:text-gray-100 truncate">
              {deal.lead?.name}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1 min-w-0">
              <Building2 size={11} className="flex-shrink-0" />
              <span className="truncate">{deal.property?.title}</span>
            </p>
          </div>
          <button
            onClick={onDeselect}
            title="Cerrar detalle"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-[#2e3650] rounded-lg transition-colors flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className={`space-y-2.5 mb-4 ${cardClass}`}>
          <p className={sectionLabelClass}>
            <Wallet size={13} /> Datos de la venta
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Monto</span>
            <span className="text-lg font-bold text-green-600 dark:text-green-400">
              {formatPrice(deal.amount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Fecha de cierre</span>
            <span className="text-sm text-gray-700 dark:text-gray-200">
              {formatDate(deal.closedAt)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Asesor</span>
            <span className="text-sm text-gray-700 dark:text-gray-200">
              {advisor?.name || 'Sin asignar'}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <p className={sectionLabelClass}>
            <Activity size={13} /> Seguimiento realizado
          </p>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {activities.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                Sin actividad registrada.
              </p>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-xs">
                  <span
                    className={`px-1.5 py-0.5 rounded-full flex-shrink-0 ${ACTIVITY_TYPE_COLORS[a.type]}`}
                  >
                    {ACTIVITY_TYPE_LABELS[a.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 dark:text-gray-300">{a.content}</p>
                    <p className="text-gray-400 mt-0.5">
                      {formatDateTime(a.occurredAt)}
                      {a.user ? ` · ${a.user.name}` : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {appointments.length > 0 && (
          <div className="mb-4">
            <p className={sectionLabelClass}>
              <Calendar size={13} /> Citas
            </p>
            <div className="space-y-1.5">
              {appointments.map((a) => (
                <div
                  key={a.id}
                  className="bg-gray-50 dark:bg-[#1a1f2e] rounded-lg px-3 py-1.5 text-xs flex items-center justify-between"
                >
                  <span className="text-gray-700 dark:text-gray-300">
                    {formatDateTime(a.scheduledAt)}
                  </span>
                  <Badge
                    variant={
                      a.status === 'completada'
                        ? 'success'
                        : a.status === 'cancelada'
                          ? 'default'
                          : 'primary'
                    }
                  >
                    {a.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {notes.length > 0 && (
          <div>
            <p className={sectionLabelClass}>
              <FileText size={13} /> Notas
            </p>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-gray-50 dark:bg-[#1a1f2e] rounded-lg px-3 py-2 text-xs"
                >
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{note.content}</p>
                  <span className="text-gray-400 block mt-1">{formatDateTime(note.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Mismo patrón responsive que DetailPanelSlot en ProspectosSection.jsx: overlay a pantalla
// completa en mobile/tablet, columna lateral fija de xl en adelante.
function DealDetailSlot({ selected, users, onDeselect }) {
  const panelRef = useModalA11y(Boolean(selected), onDeselect);
  return (
    <>
      <AnimatePresence>
        {selected && (
          <motion.div
            key="deal-detail-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDeselect}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end xl:hidden"
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={selected?.lead?.name || 'Detalle de caso de éxito'}
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="w-full max-w-md h-full overflow-y-auto bg-white dark:bg-[#242938]"
            >
              <DealDetailPanel deal={selected} users={users} onDeselect={onDeselect} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="hidden xl:block">
        <AnimatePresence mode="wait">
          {selected ? (
            <DealDetailPanel
              key={selected.id}
              deal={selected}
              users={users}
              onDeselect={onDeselect}
            />
          ) : (
            <motion.div
              key="deal-empty"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-[#242938] rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-[#2e3650] text-center text-gray-400 dark:text-gray-500"
            >
              <Trophy size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Selecciona un caso para ver el seguimiento completo</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

const DEALS_PAGE_SIZE = 12;

// Casos de éxito — galería de ventas cerradas (un Deal solo existe si el prospecto llegó
// a "Venta realizada"; ver leadController.closeLeadAsWon/closeLeadAsLost). Separado de
// Prospectos porque aquí el objetivo es revisar lo ya ganado, no seguir trabajando el caso.
// AUDIT: antes pedía getDeals() sin params, descargando todo el historial de ventas en
// cada visita y filtrando/sumando en el cliente. Ahora pagina con el mismo patrón
// useInfiniteQuery + "Cargar más" que ya usa el Kanban de Prospectos (useColumnLeads en
// KanbanBoard.jsx) y la búsqueda va debounced al backend en vez de filtrar localmente —
// así el conteo y el monto total mostrados reflejan siempre TODO el historial que
// coincide con la búsqueda, no solo lo que ya se cargó.
export default function CasosExitoSection() {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  const [selected, setSelected] = useState(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['deals', search],
    queryFn: ({ pageParam = 1 }) =>
      getDeals({ page: pageParam, limit: DEALS_PAGE_SIZE, search: search || undefined }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });
  const deals = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const dealsTotal = data?.pages?.[0]?.pagination?.total ?? 0;
  const totalAmount = Number(data?.pages?.[0]?.totalAmount ?? 0);

  const { data: usersData } = useQuery({ queryKey: ['users-all'], queryFn: getUsers });
  const users = usersData?.data ?? [];

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-wrap items-center justify-between gap-3 mb-6"
      >
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {dealsTotal} venta{dealsTotal === 1 ? '' : 's'} registrada
          {dealsTotal === 1 ? '' : 's'} · {formatPrice(totalAmount)} en total
        </p>
        <div className="flex items-center gap-2 bg-white dark:bg-[#242938] border border-gray-200 dark:border-[#2e3650] rounded-xl px-3 py-2 w-full sm:w-auto">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Buscar por cliente o propiedad..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 sm:w-56 text-sm focus:outline-none bg-transparent dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>
      </motion.div>

      {isLoading ? (
        <Spinner size="lg" className="py-16" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            {deals.length === 0 ? (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="text-center py-16 text-gray-400 dark:text-gray-500"
              >
                <Trophy size={32} className="mx-auto mb-2 opacity-30" />
                <p>
                  {search
                    ? 'Ningún caso coincide con la búsqueda.'
                    : 'Aún no hay ventas registradas.'}
                </p>
              </motion.div>
            ) : (
              <>
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  <AnimatePresence>
                    {deals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        isSelected={selected?.id === deal.id}
                        onSelect={setSelected}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
                {hasNextPage && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="px-4 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-[#242938] hover:bg-gray-50 dark:hover:bg-[#2e3650] disabled:opacity-50 transition-colors"
                    >
                      {isFetchingNextPage ? 'Cargando...' : 'Cargar más'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="xl:col-span-1">
            <DealDetailSlot
              selected={selected}
              users={users}
              onDeselect={() => setSelected(null)}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
