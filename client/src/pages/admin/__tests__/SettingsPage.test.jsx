import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SettingsPage from '../SettingsPage';
import {
  getInventoryDownloadSetting,
  updateInventoryDownloadSetting,
  getPublicPropertiesSetting,
  updatePublicPropertiesSetting,
} from '../../../services/settingsService';

vi.mock('../../../services/settingsService', () => ({
  getInventoryDownloadSetting: vi.fn(),
  updateInventoryDownloadSetting: vi.fn(),
  getPublicPropertiesSetting: vi.fn(),
  updatePublicPropertiesSetting: vi.fn(),
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

// Cada tarjeta se identifica por su título (heading) — de ahí se navega al switch/badge
// dentro de esa misma tarjeta con `within`, para no colisionar con la otra tarjeta que
// puede mostrar el mismo texto "ACTIVADO"/"DESACTIVADO" al mismo tiempo.
const cardFor = async (titleText) => {
  const heading = await screen.findByText(titleText);
  return within(heading.closest('div').parentElement.parentElement);
};

describe('SettingsPage — toggle de descarga de inventario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPublicPropertiesSetting.mockResolvedValue({ enabled: true });
  });

  it('muestra el estado ACTIVADO cuando el backend responde enabled:true', async () => {
    getInventoryDownloadSetting.mockResolvedValue({ enabled: true });
    renderPage();

    const card = await cardFor('Inventario de propiedades');
    expect(card.getByText('ACTIVADO')).toBeInTheDocument();
    expect(card.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('muestra el estado DESACTIVADO cuando el backend responde enabled:false', async () => {
    getInventoryDownloadSetting.mockResolvedValue({ enabled: false });
    renderPage();

    const card = await cardFor('Inventario de propiedades');
    expect(card.getByText('DESACTIVADO')).toBeInTheDocument();
    expect(card.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('al cambiar el toggle, llama al servicio con el nuevo valor y confirma con un toast', async () => {
    const user = userEvent.setup();
    getInventoryDownloadSetting.mockResolvedValue({ enabled: true });
    updateInventoryDownloadSetting.mockResolvedValue({ enabled: false });
    renderPage();

    const card = await cardFor('Inventario de propiedades');
    await card.findByText('ACTIVADO');
    await user.click(card.getByRole('switch'));

    await waitFor(() => expect(updateInventoryDownloadSetting).toHaveBeenCalled());
    expect(updateInventoryDownloadSetting.mock.calls[0][0]).toBe(false);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Descarga de inventario desactivada'));
    expect(await card.findByText('DESACTIVADO')).toBeInTheDocument();
  });

  it('si falla el guardado, muestra un toast de error y no cambia el estado mostrado', async () => {
    const user = userEvent.setup();
    getInventoryDownloadSetting.mockResolvedValue({ enabled: true });
    updateInventoryDownloadSetting.mockRejectedValue(new Error('network error'));
    renderPage();

    const card = await cardFor('Inventario de propiedades');
    await card.findByText('ACTIVADO');
    await user.click(card.getByRole('switch'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(card.getByText('ACTIVADO')).toBeInTheDocument();
  });

  it('recarga el estado correcto tras un refetch (simula recargar la página)', async () => {
    getInventoryDownloadSetting.mockResolvedValue({ enabled: false });
    const { unmount } = renderPage();
    let card = await cardFor('Inventario de propiedades');
    expect(await card.findByText('DESACTIVADO')).toBeInTheDocument();
    unmount();

    getInventoryDownloadSetting.mockResolvedValue({ enabled: true });
    renderPage();
    card = await cardFor('Inventario de propiedades');
    expect(await card.findByText('ACTIVADO')).toBeInTheDocument();
  });
});

describe('SettingsPage — toggle de propiedades públicas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInventoryDownloadSetting.mockResolvedValue({ enabled: true });
  });

  it('muestra el estado ACTIVADO cuando el backend responde enabled:true', async () => {
    getPublicPropertiesSetting.mockResolvedValue({ enabled: true });
    renderPage();

    const card = await cardFor('Propiedades públicas');
    expect(card.getByText('ACTIVADO')).toBeInTheDocument();
    expect(card.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('muestra el estado DESACTIVADO cuando el backend responde enabled:false', async () => {
    getPublicPropertiesSetting.mockResolvedValue({ enabled: false });
    renderPage();

    const card = await cardFor('Propiedades públicas');
    expect(card.getByText('DESACTIVADO')).toBeInTheDocument();
    expect(card.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('al cambiar el toggle, llama al servicio con el nuevo valor y confirma con un toast', async () => {
    const user = userEvent.setup();
    getPublicPropertiesSetting.mockResolvedValue({ enabled: true });
    updatePublicPropertiesSetting.mockResolvedValue({ enabled: false });
    renderPage();

    const card = await cardFor('Propiedades públicas');
    await card.findByText('ACTIVADO');
    await user.click(card.getByRole('switch'));

    await waitFor(() => expect(updatePublicPropertiesSetting).toHaveBeenCalled());
    expect(updatePublicPropertiesSetting.mock.calls[0][0]).toBe(false);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Propiedades públicas desactivadas')
    );
    expect(await card.findByText('DESACTIVADO')).toBeInTheDocument();
  });

  it('si falla el guardado, muestra un toast de error y no cambia el estado mostrado (revierte visualmente)', async () => {
    const user = userEvent.setup();
    getPublicPropertiesSetting.mockResolvedValue({ enabled: true });
    updatePublicPropertiesSetting.mockRejectedValue(new Error('network error'));
    renderPage();

    const card = await cardFor('Propiedades públicas');
    await card.findByText('ACTIVADO');
    await user.click(card.getByRole('switch'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(card.getByText('ACTIVADO')).toBeInTheDocument();
    expect(card.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('el toggle de propiedades públicas y el de inventario son independientes entre sí', async () => {
    const user = userEvent.setup();
    getPublicPropertiesSetting.mockResolvedValue({ enabled: true });
    getInventoryDownloadSetting.mockResolvedValue({ enabled: true });
    updatePublicPropertiesSetting.mockResolvedValue({ enabled: false });
    renderPage();

    const publicCard = await cardFor('Propiedades públicas');
    const inventoryCard = await cardFor('Inventario de propiedades');
    await publicCard.findByText('ACTIVADO');
    await inventoryCard.findByText('ACTIVADO');

    await user.click(publicCard.getByRole('switch'));

    await waitFor(() => expect(updatePublicPropertiesSetting).toHaveBeenCalled());
    expect(updatePublicPropertiesSetting.mock.calls[0][0]).toBe(false);
    expect(updateInventoryDownloadSetting).not.toHaveBeenCalled();
    expect(await publicCard.findByText('DESACTIVADO')).toBeInTheDocument();
    expect(inventoryCard.getByText('ACTIVADO')).toBeInTheDocument();
  });
});
