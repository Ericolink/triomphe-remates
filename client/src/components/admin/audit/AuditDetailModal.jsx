import AdminFormModal from '../../ui/AdminFormModal';
import Badge from '../../ui/Badge';
import { renderAuditIcon, getAuditAreaColor } from '../../../utils/auditIcons';
import { AUDIT_RESULT_LABELS, AUDIT_RESULT_VARIANTS } from '../../../utils/constants';
import { formatDateTime } from '../../../utils/formatters';

function Field({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="text-sm text-gray-800 dark:text-gray-100">{value}</p>
    </div>
  );
}

// El resto de `detail` (más allá de `changes`, ya mostrado en su propia tabla) puede traer
// campos útiles pero de forma libre según el call site (dealId, propertyAlertId, reason,
// etc.) — se listan tal cual, sin intentar traducir cada clave posible una por una.
function otherDetailEntries(detail) {
  if (!detail || typeof detail !== 'object') return [];
  return Object.entries(detail).filter(([key]) => key !== 'changes');
}

export default function AuditDetailModal({ log, onClose }) {
  if (!log) return null;
  const areaColor = getAuditAreaColor(log.area);
  const changes = Array.isArray(log.detail?.changes) ? log.detail.changes : [];
  const otherEntries = otherDetailEntries(log.detail);

  return (
    <AdminFormModal open={Boolean(log)} onClose={onClose} title={log.label} maxWidth="max-w-lg">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${areaColor}`}>
          {renderAuditIcon(log.icon, 18)}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {log.area} {log.subarea && `→ ${log.subarea}`}
          </p>
          {log.critical && <p className="text-xs text-red-500 dark:text-red-400">Evento crítico</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <Field label="Usuario" value={log.userName} />
        <Field label="Registro" value={log.resourceLabel} />
        <Field label="Fecha" value={formatDateTime(log.createdAt)} />
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Resultado</p>
          <Badge variant={AUDIT_RESULT_VARIANTS[log.result] || 'default'}>
            {AUDIT_RESULT_LABELS[log.result] || log.result}
          </Badge>
        </div>
      </div>

      {changes.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Cambios realizados</p>
          <div className="border border-gray-100 dark:border-[#2e3650] rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#2e3650]/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Campo</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Antes</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Después</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change) => (
                  <tr key={change.field} className="border-t border-gray-100 dark:border-[#2e3650]">
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{change.field}</td>
                    <td className="px-3 py-2 text-gray-400 dark:text-gray-500">{String(change.before ?? '—')}</td>
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-100">{String(change.after ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {otherEntries.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Información adicional</p>
          <div className="space-y-1.5">
            {otherEntries.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3 text-sm">
                <span className="text-gray-400 dark:text-gray-500">{key}</span>
                <span className="text-gray-700 dark:text-gray-200 text-right break-all">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {changes.length === 0 && otherEntries.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Este evento no tiene información adicional registrada.
        </p>
      )}
    </AdminFormModal>
  );
}
