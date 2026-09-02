import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ShieldCheck, Activity, Users2, AlertTriangle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuditLogs, getAuditSummary } from '../../services/auditService';
import Spinner from '../../components/ui/Spinner';
import AuditFilters from '../../components/admin/audit/AuditFilters';
import AuditEventCard from '../../components/admin/audit/AuditEventCard';
import AuditDetailModal from '../../components/admin/audit/AuditDetailModal';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { groupAuditLogsByDay } from '../../utils/groupAuditLogsByDay';
import { fadeIn, fadeInUp, staggerContainer } from '../../utils/animations';

const AUDIT_PAGE_SIZE = 30;

function useAuditFilters() {
  const [area, setArea] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [result, setResult] = useState('');
  const [range, setRange] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [critical, setCritical] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);

  const params = useMemo(
    () => ({
      area: area || undefined,
      action: action || undefined,
      userId: userId || undefined,
      result: result || undefined,
      range: range && range !== 'custom' ? range : undefined,
      from: range === 'custom' && from ? from : undefined,
      to: range === 'custom' && to ? to : undefined,
      q: debouncedSearch || undefined,
      critical: critical ? 'true' : undefined,
    }),
    [area, action, userId, result, range, from, to, debouncedSearch, critical]
  );

  return {
    filters: { area, action, userId, result, range, from, to, search, critical },
    setters: {
      setArea,
      setAction,
      setUserId,
      setResult,
      setRange,
      setFrom,
      setTo,
      setSearch,
      setCritical,
    },
    params,
  };
}

// El slot de contenido clickeable NO es un <button> aunque `onClick` esté presente: el
// popover de "Usuarios activos hoy" (children) anida sus propios botones, y anidar
// <button> dentro de <button> es HTML inválido — role="button" en un <div> da el mismo
// comportamiento/accesibilidad sin ese problema.
function KpiCard({ icon, label, value, tone, onClick, active, children }) {
  const handleKeyDown = (e) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <motion.div
      variants={fadeInUp}
      className={`relative bg-white dark:bg-[#242938] rounded-2xl shadow-sm border transition-colors ${
        active
          ? 'border-primary-400 dark:border-primary-600 ring-1 ring-primary-300 dark:ring-primary-700'
          : 'border-gray-100 dark:border-[#2e3650]'
      }`}
    >
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className={`p-5 rounded-2xl ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a3145]' : ''}`}
      >
        <div className={`w-10 h-10 ${tone} rounded-xl flex items-center justify-center text-white mb-3`}>
          {icon}
        </div>
        <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value ?? '—'}</p>
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 flex items-center gap-1">
          {label}
          {onClick && <ChevronDown size={12} className="opacity-50" />}
        </p>
      </div>
      {children}
    </motion.div>
  );
}

function ActiveUsersKpi({ users, onPickUser }) {
  const [open, setOpen] = useState(false);

  return (
    <KpiCard
      icon={<Users2 size={18} />}
      label="Usuarios activos hoy"
      value={users?.length}
      tone="bg-violet-600"
      onClick={() => setOpen((v) => !v)}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 right-0 top-full mt-2 z-20 bg-white dark:bg-[#242938] rounded-xl shadow-lg border border-gray-100 dark:border-[#2e3650] p-2 max-h-56 overflow-y-auto"
          >
            {users?.length ? (
              users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPickUser(u.id);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2e3650]"
                >
                  {u.name}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Nadie ha tenido actividad hoy</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </KpiCard>
  );
}

export default function AuditPage() {
  const { filters, setters, params } = useAuditFilters();
  const [selectedLog, setSelectedLog] = useState(null);

  const { data: summary } = useQuery({
    queryKey: ['audit-summary', params],
    queryFn: () => getAuditSummary(params),
  });

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['audit', params],
    queryFn: ({ pageParam = 1 }) => getAuditLogs({ ...params, page: pageParam, limit: AUDIT_PAGE_SIZE }),
    getNextPageParam: (lastPage) => (lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined),
    initialPageParam: 1,
  });

  const logs = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const groups = useMemo(() => groupAuditLogsByDay(logs), [logs]);
  const total = data?.pages?.[0]?.pagination?.total ?? 0;

  const isTodayActive = filters.range === 'hoy' && !filters.critical;
  const isCriticalActive = Boolean(filters.critical);

  const showOnlyToday = () => {
    setters.setRange('hoy');
    setters.setCritical(false);
  };
  const showOnlyCriticalToday = () => {
    setters.setRange('hoy');
    setters.setCritical(true);
  };
  const resetQuickFilters = () => {
    setters.setRange('');
    setters.setCritical(false);
  };
  const pickUser = (userId) => {
    setters.setUserId(String(userId));
    setters.setRange('hoy');
  };

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <ShieldCheck size={22} className="text-primary-700 dark:text-primary-400" /> Audit Log
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Centro de actividad y trazabilidad del sistema — haz click en un número para ver el detalle
        </p>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      >
        <KpiCard
          icon={<Activity size={18} />}
          label="Eventos registrados"
          value={summary?.data?.total ?? total}
          tone="bg-primary-700"
          onClick={resetQuickFilters}
        />
        <KpiCard
          icon={<ShieldCheck size={18} />}
          label="Hoy"
          value={summary?.data?.today}
          tone="bg-emerald-600"
          onClick={showOnlyToday}
          active={isTodayActive}
        />
        <ActiveUsersKpi users={summary?.data?.activeUsersTodayList} onPickUser={pickUser} />
        <KpiCard
          icon={<AlertTriangle size={18} />}
          label="Acciones críticas hoy"
          value={summary?.data?.criticalToday}
          tone="bg-red-600"
          onClick={showOnlyCriticalToday}
          active={isCriticalActive}
        />
      </motion.div>

      <AuditFilters
        area={filters.area}
        onAreaChange={setters.setArea}
        action={filters.action}
        onActionChange={setters.setAction}
        userId={filters.userId}
        onUserIdChange={setters.setUserId}
        result={filters.result}
        onResultChange={setters.setResult}
        range={filters.range}
        onRangeChange={setters.setRange}
        from={filters.from}
        onFromChange={setters.setFrom}
        to={filters.to}
        onToChange={setters.setTo}
        search={filters.search}
        onSearchChange={setters.setSearch}
        critical={filters.critical}
        onCriticalChange={setters.setCritical}
      />

      {isLoading ? (
        <Spinner size="lg" className="py-16" />
      ) : isError ? (
        <div className="text-center py-16 text-red-500 dark:text-red-400">
          No se pudo cargar el historial de actividad. Intenta de nuevo.
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          No hay eventos con este filtro
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key}>
              <p className="text-xs font-semibold tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                {group.label}
              </p>
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                {group.logs.map((log) => (
                  <AuditEventCard key={log.id} log={log} onClick={() => setSelectedLog(log)} />
                ))}
              </motion.div>
            </div>
          ))}

          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-4 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-[#242938] hover:bg-gray-50 dark:hover:bg-[#2e3650] disabled:opacity-50 transition-colors"
              >
                {isFetchingNextPage ? 'Cargando...' : 'Cargar más'}
              </button>
            </div>
          )}
        </div>
      )}

      <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </motion.div>
  );
}
