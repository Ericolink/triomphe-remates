import { Component } from 'react';
import { isChunkLoadError } from '../utils/chunkLoadError';

// Sin framer-motion/lucide-react ni ningún otro componente de la app a propósito: si TODA la
// carga de chunks está fallando (el escenario que este componente existe para cubrir), el
// fallback debe poder renderizar solo con lo que ya viene en el bundle principal — React y
// las clases de Tailwind del CSS global, nunca JS de un chunk separado que podría estar
// fallando también.
function ErrorFallback({ onReload }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-[#1a1f2e]">
      <div className="max-w-sm w-full text-center bg-white dark:bg-[#242938] rounded-2xl shadow-lg border border-gray-100 dark:border-[#2e3650] p-8">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No pudimos cargar esta sección.
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Es posible que Triomphe se haya actualizado. Recarga la página para continuar.
        </p>
        <button
          type="button"
          onClick={onReload}
          className="w-full px-4 py-2.5 rounded-xl bg-primary-900 text-white text-sm font-medium hover:bg-primary-800 transition-colors"
        >
          Recargar página
        </button>
      </div>
    </div>
  );
}

// Red de seguridad alrededor del <Suspense> global de App.jsx. Los error boundaries de React
// solo pueden implementarse como componente de clase (no existe un hook equivalente) — es la
// única razón de que este archivo use `class` en un código base que por lo demás es 100%
// componentes de función.
//
// No intenta "recuperarse solo": una vez que `hasError` es true, se queda mostrando el
// fallback hasta que el usuario pulsa "Recargar página" (recarga completa del navegador, no
// una re-renderización de React) — a propósito, para no arriesgar un loop de error→
// recuperación automática→mismo error de nuevo.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Hoy no existe un servicio de reporte de errores del lado del cliente (Sentry o
    // similar) al que enganchar esto — console.error es la única vía real, y es
    // precisamente lo que se necesita en desarrollo para seguir viendo el stack trace
    // completo en la consola del navegador. Nunca llega al usuario (ver ErrorFallback).
    console.error(
      isChunkLoadError(error)
        ? '[ErrorBoundary] Falló la carga de un chunk (posible deploy nuevo mientras la página estaba abierta):'
        : '[ErrorBoundary] Error de renderizado:',
      error,
      errorInfo
    );
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReload={this.handleReload} />;
    }
    return this.props.children;
  }
}
