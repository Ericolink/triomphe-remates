import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from '../LoginPage';
import { login } from '../../../services/authService';

vi.mock('../../../services/authService', () => ({
  login: vi.fn(),
}));

const mockSetAuth = vi.fn();
vi.mock('../../../store/authStore', () => ({
  default: () => ({ isAuthenticated: false, user: null, setAuth: mockSetAuth }),
}));

vi.mock('../../../components/ui/WelcomeScreen', () => ({
  default: ({ name }) => <div data-testid="welcome-screen">{name}</div>,
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
const toast = (await import('react-hot-toast')).default;

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const submitLogin = async (user, { email = 'admin@triomphe.test', password = 'Password123' } = {}) => {
  await user.type(screen.getByPlaceholderText('admin@triomphe.com'), email);
  await user.type(screen.getByPlaceholderText('••••••••'), password);
  await user.click(screen.getByRole('button', { name: /ingresar/i }));
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('login exitoso: llama a setAuth y muestra la pantalla de bienvenida', async () => {
    login.mockResolvedValueOnce({ token: 'jwt-token', user: { id: 1, name: 'Ana Admin', role: 'admin' } });
    const user = userEvent.setup();
    renderPage();

    await submitLogin(user);

    await waitFor(() => expect(login).toHaveBeenCalledWith('admin@triomphe.test', 'Password123'));
    await waitFor(() => expect(mockSetAuth).toHaveBeenCalledWith({ id: 1, name: 'Ana Admin', role: 'admin' }, 'jwt-token'));
    expect(await screen.findByTestId('welcome-screen')).toHaveTextContent('Ana Admin');
  });

  it('credenciales incorrectas (401 genérico): muestra "Credenciales incorrectas" y deja reintentar de inmediato', async () => {
    login.mockRejectedValueOnce({ response: { status: 401, data: { error: 'Credenciales inválidas' } } });
    const user = userEvent.setup();
    renderPage();

    await submitLogin(user, { password: 'wrong-password' });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Credenciales incorrectas'));
    // No debe haber quedado ninguna cuenta regresiva activa — el usuario puede reintentar ya.
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
  });

  it('429 (rate limit): muestra el mensaje de "demasiados intentos" y arranca la cuenta regresiva visual con Retry-After', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    login.mockRejectedValueOnce({
      response: { status: 429, headers: { 'retry-after': '3' }, data: { error: 'Demasiados intentos.' } },
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await submitLogin(user, { password: 'wrong-password' });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Demasiados intentos. Intenta nuevamente en unos minutos.'));
    expect(screen.getByRole('button', { name: 'Intenta de nuevo en 3s' })).toBeDisabled();

    // Avanza el reloj virtual segundo a segundo — el efecto reprograma su propio setTimeout
    // en cada tick, así que hace falta darle a React una vuelta de act() por segundo para
    // que el nuevo timer quede registrado antes de la siguiente ronda. El detalle intermedio
    // (3→2→1) es solo estético; lo que importa es que llega a 0 y vuelve a habilitar el
    // botón — el backend sigue siendo quien decide si el próximo intento real se acepta o no.
    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
  });

  it('429 sin Retry-After: usa un techo defensivo en vez de romperse o dejar el botón deshabilitado para siempre', async () => {
    login.mockRejectedValueOnce({
      response: { status: 429, headers: {}, data: { error: 'Demasiados intentos.' } },
    });
    const user = userEvent.setup();
    renderPage();

    await submitLogin(user, { password: 'wrong-password' });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Demasiados intentos. Intenta nuevamente en unos minutos.'));
    expect(screen.getByRole('button', { name: 'Intenta de nuevo en 60s' })).toBeDisabled();
  });

  it('timeout de la petición (ECONNABORTED): muestra el mensaje de "tardó demasiado", no un error genérico de backend', async () => {
    login.mockRejectedValueOnce({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' });
    const user = userEvent.setup();
    renderPage();

    await submitLogin(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('La solicitud tardó demasiado. Intenta nuevamente.')
    );
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringMatching(/credenciales/i));
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
  });

  it('un intento fallido seguido de uno exitoso funciona con normalidad (recuperación tras error)', async () => {
    login.mockRejectedValueOnce({ response: { status: 401, data: { error: 'Credenciales inválidas' } } });
    login.mockResolvedValueOnce({ token: 'jwt-token', user: { id: 2, name: 'Beto Admin', role: 'admin' } });
    const user = userEvent.setup();
    renderPage();

    await submitLogin(user, { password: 'wrong-password' });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Credenciales incorrectas'));

    await user.clear(screen.getByPlaceholderText('••••••••'));
    await user.type(screen.getByPlaceholderText('••••••••'), 'Password123');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(mockSetAuth).toHaveBeenCalledWith({ id: 2, name: 'Beto Admin', role: 'admin' }, 'jwt-token'));
  });

  it('no envía la petición si el email o la contraseña están vacíos', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(toast.error).toHaveBeenCalledWith('Completa todos los campos');
    expect(login).not.toHaveBeenCalled();
  });
});
