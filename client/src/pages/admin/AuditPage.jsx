import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAuditLogs } from '../../services/auditService';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Pagination from '../../components/ui/Pagination';
import { fadeIn, fadeInUp, staggerContainer } from '../../utils/animations';
import { formatDateTime } from '../../utils/formatters';

const actionVariant = {
  create: 'success',
  update: 'warning',
  delete: 'danger',
  login: 'primary',
  logout: 'default',
  export: 'default',
};
const actionLabel = {
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  login: 'Login',
  logout: 'Logout',
  export: 'Exportar',
};
const resourceLabel = {
  property: 'Propiedad',
  lead: 'Lead',
  feedback: 'Buzón',
  user: 'Usuario',
  job: 'Vacante',
  application: 'Postulación',
  alert: 'Alerta',
};

const ACTIONS = ['', 'create', 'update', 'delete', 'login', 'export'];
const RESOURCES = ['', 'property', 'lead', 'feedback', 'user', 'job', 'alert'];

export default function AuditPage() {
  const [action, setAction] = useState('');
  const [resource, setResource] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', action, resource, page],
    queryFn: () =>
      getAuditLogs({
        action: action || undefined,
        resource: resource || undefined,
        page,
        limit: 30,
      }),
  });

  const select =
    'px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none';

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-wrap items-center justify-between gap-3 mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <ShieldCheck size={22} className="text-blue-700 dark:text-blue-400" /> Audit Log
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {data?.pagination?.total ?? 0} eventos registrados
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className={select}
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a ? actionLabel[a] : 'Todas las acciones'}
              </option>
            ))}
          </select>
          <select
            value={resource}
            onChange={(e) => {
              setResource(e.target.value);
              setPage(1);
            }}
            className={select}
          >
            {RESOURCES.map((r) => (
              <option key={r} value={r}>
                {r ? resourceLabel[r] : 'Todos los recursos'}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {isLoading ? (
        <Spinner size="lg" className="py-16" />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-2"
        >
          {data?.data?.map((log) => {
            let detail = null;
            try {
              detail = log.detail ? JSON.parse(log.detail) : null;
            } catch {
              /* ignore */
            }
            return (
              <motion.div
                key={log.id}
                variants={fadeInUp}
                className="bg-white dark:bg-[#242938] rounded-xl px-5 py-3.5 shadow-sm border border-gray-100 dark:border-[#2e3650]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={actionVariant[log.action] || 'default'}>
                    {actionLabel[log.action] || log.action}
                  </Badge>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {resourceLabel[log.resource] || log.resource}
                    {log.resourceId && (
                      <span className="text-xs text-gray-400"> #{log.resourceId}</span>
                    )}
                  </span>
                  {detail?.title && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                      {detail.title}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {log.userName && (
                    <span className="font-medium text-gray-500 dark:text-gray-400">
                      {log.userName}
                    </span>
                  )}
                  <span>{formatDateTime(log.createdAt)}</span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {!isLoading && data?.data?.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          No hay eventos con este filtro
        </div>
      )}

      <Pagination pagination={data?.pagination} page={page} onPageChange={setPage} className="mt-8" />
    </motion.div>
  );
}
