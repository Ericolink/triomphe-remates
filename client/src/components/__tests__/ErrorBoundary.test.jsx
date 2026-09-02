import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense, lazy } from 'react';
import ErrorBoundary from '../ErrorBoundary';

// Lanza en el render cuando `shouldThrow` es true — mismo patrón estándar de RTL para
// probar error boundaries (React no ofrece otra forma de "forzar" un error de renderizado).
function Bomb({ shouldThrow }) {
  if (shouldThrow) throw new Error('Boom: fallo intencional de prueba con stack sensible');
  return <div>Contenido normal</div>;
}

describe('ErrorBoundary', () => {
  let reloadMock;

  beforeEach(() => {
    // React (y nuestro propio componentDidCatch) loguean a console.error a propósito —
    // se silencia aquí para no ensuciar la salida de test, no para ocultar un fallo real:
    // las aserciones de cada test siguen verificando el comportamiento, no el log.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza normalmente cuando no hay error (comportamiento sin cambios)', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Contenido normal')).toBeInTheDocument();
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('cuando un hijo lanza un error, muestra la pantalla de recuperación en vez de quedar en blanco', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No pudimos cargar esta sección.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar página' })).toBeInTheDocument();
    expect(screen.queryByText('Contenido normal')).not.toBeInTheDocument();
  });

  it('el botón "Recargar página" llama a window.location.reload() y solo ante un click explícito', async () => {
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    // No debe recargar automáticamente al capturar el error — solo tras la acción del usuario.
    expect(reloadMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Recargar página' }));

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('nunca expone el mensaje ni el stack del error real al usuario', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.queryByText(/boom/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stack sensible/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/at Bomb|\.jsx:\d+/);
  });

  it('registra el error en consola para que siga siendo diagnosticable en desarrollo', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    // console.error está espiado (mockImplementation) pero sigue registrando la llamada —
    // confirma que componentDidCatch de verdad reporta el error, no lo descarta en silencio.
    const loggedOurError = console.error.mock.calls.some((call) =>
      String(call[0]).includes('[ErrorBoundary]')
    );
    expect(loggedOurError).toBe(true);
  });

  it('un import() dinámico que falla (chunk viejo tras un deploy) también cae en el fallback, no en una pantalla en blanco', async () => {
    const FailingLazyPage = lazy(() =>
      Promise.reject(new Error('Failed to fetch dynamically imported module: /assets/Old-abc123.js'))
    );

    render(
      <ErrorBoundary>
        <Suspense fallback={<div>Cargando…</div>}>
          <FailingLazyPage />
        </Suspense>
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('No pudimos cargar esta sección.')).toBeInTheDocument();
    });
  });
});
