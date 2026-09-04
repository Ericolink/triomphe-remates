import { useId, useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { login } from '../../services/authService';
import useAuthStore from '../../store/authStore';
import WelcomeScreen from '../../components/ui/WelcomeScreen';
import { defaultRouteFor } from '../../utils/permissions';

// Techo defensivo por si el backend no manda Retry-After (no debería pasar — express-rate-
// limit siempre lo agrega en un 429, ver rateLimitMiddleware.js) o manda un valor inválido.
const DEFAULT_RETRY_AFTER_SECONDS = 60;

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [welcome, setWelcome] = useState(null); // nombre del usuario
  // Solo cuenta regresiva visual (UX) — el backend es quien realmente sigue rechazando el
  // login mientras dure el bloqueo, sin importar si el usuario recarga la página o esta
  // cuenta llega a cero antes de tiempo.
  const [retryAfter, setRetryAfter] = useState(0);
  const formId = useId();

  useEffect(() => {
    if (retryAfter <= 0) return undefined;
    const timer = setTimeout(() => setRetryAfter((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [retryAfter]);

  const { mutate, isPending } = useMutation({
    mutationFn: ({ email, password }) => login(email, password),
    onSuccess: ({ token, user }) => {
      setRetryAfter(0);
      setAuth(user, token);
      setWelcome(user.name);
    },
    onError: (error) => {
      if (error.code === 'ECONNABORTED') {
        toast.error('La solicitud tardó demasiado. Intenta nuevamente.');
        return;
      }
      if (error.response?.status === 429) {
        const seconds = Number(error.response.headers?.['retry-after']);
        setRetryAfter(Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_AFTER_SECONDS);
        toast.error('Demasiados intentos. Intenta nuevamente en unos minutos.');
        return;
      }
      toast.error('Credenciales incorrectas');
    },
  });

  if (isAuthenticated && !welcome) return <Navigate to={defaultRouteFor(user)} replace />;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (retryAfter > 0) return;
    if (!form.email || !form.password) return toast.error('Completa todos los campos');
    mutate(form);
  };

  return (
    <>
      <AnimatePresence>
        {welcome && (
          <WelcomeScreen name={welcome} onDone={() => navigate(defaultRouteFor(user))} />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 dark:from-primary-950 dark:to-[#242938] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#242938] rounded-2xl shadow-2xl w-full max-w-md p-8 border border-transparent dark:border-[#2e3650]">
          <div className="text-center mb-8">
            <img
              src="/logo.png"
              alt="Triomphe"
              className="h-16 w-auto mx-auto mb-4 dark:brightness-0 dark:invert"
            />
            <p className="text-gray-500 dark:text-gray-400 text-sm">Panel de administración</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor={`${formId}-email`}
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Email
              </label>
              <input
                id={`${formId}-email`}
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="admin@triomphe.com"
                className="w-full px-4 py-3 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white dark:placeholder-gray-500"
              />
            </div>

            <div>
              <label
                htmlFor={`${formId}-password`}
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id={`${formId}-password`}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 pr-12 bg-white dark:bg-[#1a1f2e] dark:text-white dark:placeholder-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || retryAfter > 0}
              className="w-full bg-accent-400 dark:bg-accent-500 text-primary-900 py-3 rounded-xl font-semibold hover:bg-accent-300 dark:hover:bg-accent-400 transition-colors disabled:opacity-50"
            >
              {isPending
                ? 'Ingresando...'
                : retryAfter > 0
                  ? `Intenta de nuevo en ${retryAfter}s`
                  : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
