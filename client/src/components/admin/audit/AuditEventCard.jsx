import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import Badge from '../../ui/Badge';
import { renderAuditIcon, getAuditAreaColor } from '../../../utils/auditIcons';
import { AUDIT_RESULT_LABELS, AUDIT_RESULT_VARIANTS } from '../../../utils/constants';
import { formatDateTime } from '../../../utils/formatters';
import { fadeInUp } from '../../../utils/animations';

// Un dato de "nombre" ya viene en `detail` de varios call sites (title/name/clientName) —
// se usa si está, nunca se inventa. Sin esto, "Prospecto #581" es lo único disponible.
function entityName(detail) {
  return detail?.title || detail?.name || detail?.clientName || null;
}

export default function AuditEventCard({ log, onClick }) {
  const areaColor = getAuditAreaColor(log.area);
  const name = entityName(log.detail);

  return (
    <motion.button
      type="button"
      variants={fadeInUp}
      onClick={onClick}
      className={`w-full text-left bg-white dark:bg-[#242938] rounded-xl px-4 py-3.5 shadow-sm border transition-colors hover:border-primary-300 dark:hover:border-primary-700 ${
        log.critical
          ? 'border-red-200 dark:border-red-900/40'
          : 'border-gray-100 dark:border-[#2e3650]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${areaColor}`}>
          {renderAuditIcon(log.icon, 16)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <span>{log.area}</span>
            {log.subarea && (
              <>
                <span>·</span>
                <span>{log.subarea}</span>
              </>
            )}
            {log.critical && (
              <span className="inline-flex items-center gap-0.5 text-red-500 dark:text-red-400 ml-1">
                <AlertTriangle size={11} /> Crítico
              </span>
            )}
            {log.result === 'failed' && (
              <Badge variant={AUDIT_RESULT_VARIANTS.failed}>{AUDIT_RESULT_LABELS.failed}</Badge>
            )}
          </div>

          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mt-0.5 truncate">
            {log.label}
            {log.resourceLabel && (
              <span className="font-normal text-gray-500 dark:text-gray-400">
                {' — '}
                {log.resourceLabel}
                {name && ` · ${name}`}
              </span>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-400 dark:text-gray-500">
            {log.userName && <span className="font-medium text-gray-500 dark:text-gray-400">{log.userName}</span>}
            <span>{formatDateTime(log.createdAt)}</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
