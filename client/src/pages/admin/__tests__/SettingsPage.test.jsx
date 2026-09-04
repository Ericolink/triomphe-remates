import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SettingsPage from '../SettingsPage';
import {
  getInventoryDownloadSetting,
  updateInventoryDownloadSetting,
} from '../../../services/settingsService';

vi.mock('../../../services/settingsService', () => ({
  getInventoryDownloadSetting: vi.fn(),
  updateInventoryDownloadSetting: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
const toast = (await import('react-hot-toast')).default;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>
  );
}

describe('SettingsPage — toggle de descarga de inventario', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra el estado ACTIVADO cuando el backend responde enabled:true', async () => {
    getInventoryDownloadSetting.mockResolvedValue({ enabled: true });
    renderPage();

    expect(await screen.findByText('ACTIVADO')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('muestra el estado DESACTIVADO cuando el backend responde enabled:false', async () => {
    getInventoryDownloadSetting.mockResolvedValue({ enabled: false });
    renderPage();

    expect(await screen.findByText('DESACTIVADO')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('al cambiar el toggle, llama al servicio con el nuevo valor y confirma con un toast', async () => {
    const user = userEvent.setup();
    getInventoryDownloadSetting.mockResolvedValue({ enabled: true });
    updateInventoryDownloadSetting.mockResolvedValue({ enabled: false });
    renderPage();

    await screen.findByText('ACTIVADO');
    await user.click(screen.getByRole('switch'));

    await waitFor(() => expect(updateInventoryDownloadSetting).toHaveBeenCalled());
    expect(updateInventoryDownloadSetting.mock.calls[0][0]).toBe(false);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(await screen.findByText('DESACTIVADO')).toBeInTheDocument();
  });

  it('si falla el guardado, muestra un toast de error y no cambia el estado mostrado', async () => {
    const user = userEvent.setup();
    getInventoryDownloadSetting.mockResolvedValue({ enabled: true });
    updateInventoryDownloadSetting.mockRejectedValue(new Error('network error'));
    renderPage();

    await screen.findByText('ACTIVADO');
    await user.click(screen.getByRole('switch'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByText('ACTIVADO')).toBeInTheDocument();
  });

  it('recarga el estado correcto tras un refetch (simula recargar la página)', async () => {
    getInventoryDownloadSetting.mockResolvedValue({ enabled: false });
    const { unmount } = renderPage();
    expect(await screen.findByText('DESACTIVADO')).toBeInTheDocument();
    unmount();

    getInventoryDownloadSetting.mockResolvedValue({ enabled: true });
    renderPage();
    expect(await screen.findByText('ACTIVADO')).toBeInTheDocument();
  });
});
