import { RefreshCw, AlertTriangle } from 'lucide-react';

// Indicador discreto de sincronización en segundo plano — nunca bloquea
// ni reemplaza el contenido ya pintado, solo asoma un aviso pequeño.
export default function SyncStatusBar({ syncState, onRetry }) {
  if (syncState === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-4">
        <RefreshCw size={12} className="animate-spin" />
        Actualizando precios y disponibilidad…
      </div>
    );
  }

  if (syncState === 'error') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-4">
        <AlertTriangle size={12} />
        No se pudo verificar la disponibilidad más reciente.
        <button
          type="button"
          onClick={onRetry}
          className="underline hover:no-underline font-medium"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return null;
}
