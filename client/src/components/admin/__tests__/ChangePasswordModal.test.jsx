import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChangePasswordModal from '../ChangePasswordModal';
import { changePassword } from '../../../services/authService';

vi.mock('../../../services/authService', () => ({
  changePassword: vi.fn(),
}));

const mockSetToken = vi.fn();
const mockLogout = vi.fn();
vi.mock('../../../store/authStore', () => ({
  default: () => ({ setToken: mockSetToken, logout: mockLogout }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
const toast = (await import('react-hot-toast')).default;

const fillForm = async (user, { current = 'OldPassword123', next = 'NewPassword456', confirm = next } = {}) => {
  if (current !== undefined) await user.type(screen.getByLabelText('Contraseña actual'), current);
  if (next !== undefined) await user.type(screen.getByLabelText('Nueva contraseña'), next);
  if (confirm !== undefined) await user.type(screen.getByLabelText('Confirmar nueva contraseña'), confirm);
};

const renderModal = (props) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ChangePasswordModal {...props} />
    </QueryClientProvider>
  );
};

describe('ChangePasswordModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no renderiza nada cuando open=false', () => {
    renderModal({ open: false, onClose: vi.fn() });
    expect(screen.queryByText('Cambiar contraseña')).not.toBeInTheDocument();
  });

  it('muestra errores de validación y no llama a la API si los campos están vacíos', async () => {
    const user = userEvent.setup();
    renderModal({ open: true, onClose: vi.fn() });

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Ingresa tu contraseña actual')).toBeInTheDocument();
    expect(screen.getByText('Ingresa una nueva contraseña')).toBeInTheDocument();
    expect(screen.getByText('Confirma la nueva contraseña')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('rechaza una nueva contraseña igual a la actual antes de enviarla', async () => {
    const user = userEvent.setup();
    renderModal({ open: true, onClose: vi.fn() });

    await fillForm(user, { current: 'SamePassword1', next: 'SamePassword1', confirm: 'SamePassword1' });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Debe ser diferente de la contraseña actual')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('rechaza cuando la confirmación no coincide con la nueva contraseña', async () => {
    const user = userEvent.setup();
    renderModal({ open: true, onClose: vi.fn() });

    await fillForm(user, { confirm: 'Different789' });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('en éxito: llama al endpoint, actualiza el token, notifica y limpia/cierra el modal', async () => {
    changePassword.mockResolvedValueOnce({ message: 'ok', token: 'new-jwt-token' });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ open: true, onClose });

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('OldPassword123', 'NewPassword456'));
    await waitFor(() => expect(mockSetToken).toHaveBeenCalledWith('new-jwt-token'));
    expect(toast.success).toHaveBeenCalledWith('Contraseña actualizada exitosamente');
    expect(onClose).toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('contraseña actual incorrecta: muestra el error en el campo sin cerrar sesión', async () => {
    changePassword.mockRejectedValueOnce({
      response: { status: 401, data: { error: 'Contraseña actual incorrecta' } },
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ open: true, onClose });

    await fillForm(user, { current: 'WrongPassword1' });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Contraseña actual incorrecta')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('sesión expirada (401 de authMiddleware, no del controlador): cierra sesión y redirige', async () => {
    changePassword.mockRejectedValueOnce({
      response: { status: 401, data: { error: 'No autorizado' } },
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal({ open: true, onClose });

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/admin/login');
    expect(toast.error).toHaveBeenCalledWith('Tu sesión expiró. Inicia sesión de nuevo.');
    expect(onClose).toHaveBeenCalled();
  });

  it('error de validación del servidor (400): muestra el mensaje bajo el campo de nueva contraseña', async () => {
    changePassword.mockRejectedValueOnce({
      response: { status: 400, data: { error: 'La nueva contraseña debe tener al menos 8 caracteres' } },
    });
    const user = userEvent.setup();
    renderModal({ open: true, onClose: vi.fn() });

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('La nueva contraseña debe tener al menos 8 caracteres')
    ).toBeInTheDocument();
  });

  it('error de red (sin response): muestra un toast de conexión', async () => {
    changePassword.mockRejectedValueOnce(new Error('Network Error'));
    const user = userEvent.setup();
    renderModal({ open: true, onClose: vi.fn() });

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.'
      )
    );
  });

  it('error inesperado del servidor (500): muestra un mensaje genérico', async () => {
    changePassword.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    const user = userEvent.setup();
    renderModal({ open: true, onClose: vi.fn() });

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Error inesperado del servidor. Intenta de nuevo más tarde.')
    );
  });

  it('deshabilita el botón de guardar mientras la petición está en curso', async () => {
    let resolvePromise;
    changePassword.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );
    const user = userEvent.setup();
    renderModal({ open: true, onClose: vi.fn() });

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('button', { name: 'Guardando...' })).toBeDisabled();
    expect(changePassword).toHaveBeenCalledTimes(1);

    resolvePromise({ message: 'ok', token: 't' });
    await waitFor(() => expect(mockSetToken).toHaveBeenCalled());
  });
});
