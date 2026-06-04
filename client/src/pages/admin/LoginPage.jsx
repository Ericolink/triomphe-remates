import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { login } from '../../services/authService';
import useAuthStore from '../../store/authStore';
import WelcomeScreen from '../../components/ui/WelcomeScreen';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [welcome, setWelcome] = useState(null); // nombre del usuario

  const { mutate, isPending } = useMutation({
    mutationFn: ({ email, password }) => login(email, password),
    onSuccess: ({ token, user }) => {
      setAuth(user, token);
      setWelcome(user.name);
    },
    onError: () => toast.error('Credenciales incorrectas'),
  });

  if (isAuthenticated && !welcome) return <Navigate to="/admin/dashboard" replace />;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Completa todos los campos');
    mutate(form);
  };

  return (
    <>
    <AnimatePresence>
      {welcome && (
        <WelcomeScreen name={welcome} onDone={() => navigate('/admin/dashboard')} />
      )}
    </AnimatePresence>

    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 dark:from-[#0f1621] dark:to-[#242938] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#242938] rounded-2xl shadow-2xl w-full max-w-md p-8 border border-transparent dark:border-[#2e3650]">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Triomphe" className="h-16 w-auto mx-auto mb-4 dark:brightness-0 dark:invert" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Panel de administración</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input type="email" value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="admin@triomphe.com"
              className="w-full px-4 py-3 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-white dark:placeholder-gray-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12 bg-white dark:bg-[#1a1f2e] dark:text-white dark:placeholder-gray-500" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={isPending}
            className="w-full bg-blue-900 dark:bg-blue-700 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50">
            {isPending ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}
