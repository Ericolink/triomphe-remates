import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ManageAlertPage from '../ManageAlertPage';
import { getAlertByToken, updateAlertByToken } from '../../../services/alertService';

vi.mock('../../../services/alertService', () => ({
  getAlertByToken: vi.fn(),
  updateAlertByToken: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
const toast = (await import('react-hot-toast')).default;

const ACTIVE_ALERT = {
  name: 'Ana Torres',
  email: 'ana@test.com',
  phone: '6561234567',
  city: 'juarez',
  type: 'casa',
  minPrice: 500000,
  maxPrice: 1500000,
  isActive: true,
};

function renderPage(route = '/mi-alerta?token=abc123') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/mi-alerta" element={<ManageAlertPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ManageAlertPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin token en la URL muestra enlace inválido y no llama al backend', () => {
    renderPage('/mi-alerta');
    expect(screen.getByText('Enlace inválido')).toBeInTheDocument();
    expect(getAlertByToken).not.toHaveBeenCalled();
  });

  it('carga y muestra los criterios actuales de la alerta', async () => {
    getAlertByToken.mockResolvedValue({ data: ACTIVE_ALERT });
    renderPage();

    await waitFor(() => expect(getAlertByToken).toHaveBeenCalledWith('abc123'));
    expect(await screen.findByDisplayValue('Ana Torres')).toBeInTheDocument();
    expect(screen.getByText(/ana@test.com/)).toBeInTheDocument();
  });

  it('modifica un criterio y guarda, actualizando la misma alerta', async () => {
    getAlertByToken.mockResolvedValue({ data: ACTIVE_ALERT });
    updateAlertByToken.mockResolvedValue({
      message: 'Tu alerta fue actualizada correctamente.',
      data: { ...ACTIVE_ALERT, city: 'chihuahua' },
    });
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue('Ana Torres');
    await user.selectOptions(screen.getByDisplayValue('Cd. Juárez'), ['chihuahua']);
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(updateAlertByToken).toHaveBeenCalledTimes(1));
    const [token, payload] = updateAlertByToken.mock.calls[0];
    expect(token).toBe('abc123');
    expect(payload.city).toBe('chihuahua');
    expect(payload.name).toBe('Ana Torres');
    expect(await screen.findByText(/actualizada correctamente/i)).toBeInTheDocument();
  });

  it('muestra el enlace para cancelar la alerta con el mismo token', async () => {
    getAlertByToken.mockResolvedValue({ data: ACTIVE_ALERT });
    renderPage();

    const link = await screen.findByRole('link', { name: /cancelar esta alerta/i });
    expect(link.getAttribute('href')).toBe('/cancelar-alerta?token=abc123');
  });

  it('token inexistente muestra un mensaje de error, sin exponer si el email existe', async () => {
    getAlertByToken.mockRejectedValue({ response: { status: 404, data: { error: 'Alerta no encontrada' } } });
    renderPage();

    expect(await screen.findByText('No se pudo cargar la alerta')).toBeInTheDocument();
    expect(screen.queryByText(/@test.com/)).not.toBeInTheDocument();
  });

  it('alerta ya cancelada muestra el aviso correspondiente y no permite editar', async () => {
    getAlertByToken.mockResolvedValue({ data: { ...ACTIVE_ALERT, isActive: false } });
    renderPage();

    expect(await screen.findByText('Esta alerta ya no está activa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /guardar cambios/i })).not.toBeInTheDocument();
  });

  it('muestra un error de mutación sin marcar la alerta como guardada', async () => {
    getAlertByToken.mockResolvedValue({ data: ACTIVE_ALERT });
    updateAlertByToken.mockRejectedValue({ response: { data: { error: 'Teléfono inválido' } } });
    const user = userEvent.setup();
    renderPage();

    await screen.findByDisplayValue('Ana Torres');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Teléfono inválido'));
    expect(screen.queryByText(/actualizada correctamente/i)).not.toBeInTheDocument();
  });
});
