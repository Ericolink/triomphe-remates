import { useId, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Monitor, Smartphone, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSessions, revokeSession, revokeOtherSessions } from '../../services/authService';
import ConfirmDialog from '../ui/ConfirmDialog';
import { buttonHover, buttonTap } from '../../utils/animations';
import { formatRelativeTime, formatDateTime } from '../../utils/formatters';
import useModalA11y from '../../hooks/useModalA11y';

const MOBILE_DEVICES = new Set(['iPhone', 'iPad', 'Android']);

function SessionCard({ session, onRequestRevoke }) {
  const isMobile = MOBILE_DEVICES.has(session.device);
  const label = [session.browser, session.device].filter(Boolean).join(' · ') || 'Dispositivo desconocido';

  return (
    <div
      className={`p-4 rounded-2xl border ${
        session.isCurrent
          ? 'border-accent-400 bg-accent-50/60 dark:bg-accent-400/10 dark:border-accent-400/60'
          : 'border-gray-100 dark:border-[#2e3650]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-[#2e3650] flex items-center justify-center text-gray-500 dark:text-gray-300 shrink-0">
          {isMobile ? <Smartphone size={16} /> : <Monitor size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{label}</p>
          {session.ip && (
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin size={11} aria-hidden="true" /> {session.ip}
            </p>
          )}
          <p
            className="text-xs text-gray-400 dark:text-gray-500 mt-0.5"
            title={formatDateTime(session.lastActivity)}
          >
            Última actividad: {formatRelativeTime(session.lastActivity)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        {session.isCurrent ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-700 dark:text-accent-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Sesión actual
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onRequestRevoke(session)}
            className="text-xs font-medium text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            Cerrar sesión
          </button>
        )}
      </div>
    </div>
  );
}

// Único consumidor de GET/DELETE /api/auth/sessions y POST /api/auth/sessions/revoke-others
// — ver server/src/services/sessionService.js para el diseño (sid por-dispositivo, separado
// de tokenVersion). Mismo patrón de modal que ChangePasswordModal.jsx (misma pestaña del
// UserMenu en AdminLayout.jsx).
export default function SessionsModal({ open, onClose }) {
  const [sessionToRevoke, setSessionToRevoke] = useState(null);
  const [confirmRevokeOthers, setConfirmRevokeOthers] = useState(false);
  const titleId = useId();
  const queryClient = useQueryClient();
  const panelRef = useModalA11y(open, onClose);

  const { data: sessions, isLoading, isError } = useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
    enabled: open,
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId) => revokeSession(sessionId),
    onSuccess: () => {
      toast.success('Sesión cerrada');
      queryClient.invalidateQueries(['sessions']);
      setSessionToRevoke(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || 'No se pudo cerrar la sesión');
      setSessionToRevoke(null);
    },
  });

  const revokeOthersMutation = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: ({ revoked }) => {
      toast.success(revoked > 0 ? `${revoked} sesión${revoked === 1 ? '' : 'es'} cerrada${revoked === 1 ? '' : 's'}` : 'No había otras sesiones activas');
      queryClient.invalidateQueries(['sessions']);
      setConfirmRevokeOthers(false);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || 'No se pudieron cerrar las demás sesiones');
      setConfirmRevokeOthers(false);
    },
  });

  const otherSessionsCount = (sessions || []).filter((s) => !s.isCurrent).length;

  return (
    <>
      {/* AnimatePresence de este modal solo envuelve SU panel — los ConfirmDialog de abajo
          manejan su propio AnimatePresence internamente. Meterlos como hermanos dentro del
          mismo AnimatePresence (sin `key`) hacía que framer-motion los tratara como hijos
          indistinguibles entre sí, disparando el warning de React de "same key ``". */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#242938] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2e3650] w-full max-w-md p-6 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 id={titleId} className="text-base font-bold text-gray-800 dark:text-gray-100">
                  Sesiones activas
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              {isLoading && <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">Cargando…</p>}
              {isError && (
                <p className="text-sm text-red-500 py-6 text-center">No se pudieron cargar tus sesiones.</p>
              )}

              {sessions && sessions.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
                  No hay sesiones activas registradas.
                </p>
              )}

              {sessions && sessions.length > 0 && (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <SessionCard key={session.id} session={session} onRequestRevoke={setSessionToRevoke} />
                  ))}
                </div>
              )}

              {otherSessionsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmRevokeOthers(true)}
                  className="mt-5 w-full py-2.5 rounded-xl text-sm font-medium text-red-500 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                  Cerrar todas las demás sesiones
                </button>
              )}

              <motion.button
                type="button"
                onClick={onClose}
                whileHover={buttonHover}
                whileTap={buttonTap}
                className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
              >
                Cerrar
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!sessionToRevoke}
        title="¿Cerrar esta sesión?"
        message="El dispositivo dejará de tener acceso a tu cuenta de inmediato."
        confirmLabel="Cerrar sesión"
        onConfirm={() => revokeMutation.mutate(sessionToRevoke.id)}
        onCancel={() => setSessionToRevoke(null)}
      />

      <ConfirmDialog
        open={confirmRevokeOthers}
        title="¿Cerrar todas las demás sesiones?"
        message="Las sesiones abiertas en otros dispositivos dejarán de tener acceso a tu cuenta. Esta sesión seguirá activa."
        confirmLabel="Cerrar todas las demás sesiones"
        onConfirm={() => revokeOthersMutation.mutate()}
        onCancel={() => setConfirmRevokeOthers(false)}
      />
    </>
  );
}
