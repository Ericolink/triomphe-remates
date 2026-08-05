import { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { changePassword } from '../../services/authService';
import PasswordInput from '../ui/PasswordInput';
import useAuthStore from '../../store/authStore';
import { buttonHover, buttonTap } from '../../utils/animations';
import useModalA11y from '../../hooks/useModalA11y';

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };
const EMPTY_SHOW = { currentPassword: false, newPassword: false, confirmPassword: false };

// Único consumidor de PUT /api/auth/change-password — antes ese endpoint no tenía ningún
// componente que lo usara. Deliberadamente separado del modal "Editar usuario" de
// UsersPage (que también puede cambiar la propia contraseña vía PUT /users/:id): este es
// accesible para cualquier rol autenticado desde el header, mientras que UsersPage es
// admin-only, así que un editor no tenía forma de cambiar su contraseña.
export default function ChangePasswordModal({ open, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPass, setShowPass] = useState(EMPTY_SHOW);
  const [fieldErrors, setFieldErrors] = useState({});
  const { setToken } = useAuthStore();
  const titleId = useId();
  const formId = useId();

  const reset = () => {
    setForm(EMPTY_FORM);
    setShowPass(EMPTY_SHOW);
    setFieldErrors({});
  };

  const handleClose = () => {
    if (mutation.isPending) return;
    reset();
    onClose();
  };
  const panelRef = useModalA11y(open, handleClose);

  const mutation = useMutation({
    mutationFn: () => changePassword(form.currentPassword, form.newPassword),
    onSuccess: (data) => {
      toast.success('Contraseña actualizada exitosamente');
      // El backend invalida el token anterior (tokenVersion) y reemite uno nuevo para
      // no cerrar la sesión — hay que guardarlo o la siguiente petición dará 401.
      if (data?.token) setToken(data.token);
      reset();
      onClose();
    },
    onError: (err) => {
      if (!err?.response) {
        toast.error('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.');
        return;
      }

      const { status, data } = err.response;

      if (status === 401) {
        // Un 401 con code 'INVALID_CURRENT_PASSWORD' (ver authController.js) es el único
        // 401 que este endpoint puede devolver sin que el interceptor global de axios
        // (client/src/services/api.js) ya haya cerrado la sesión y redirigido — cualquier
        // otro 401 (token vencido/inválido) es manejado enteramente por ese interceptor
        // antes de llegar aquí, así que no hay nada más que hacer en ese caso.
        if (data?.code === 'INVALID_CURRENT_PASSWORD') {
          setFieldErrors({ currentPassword: data.error || 'Contraseña actual incorrecta' });
        }
        return;
      }

      if (status === 400) {
        setFieldErrors({ newPassword: data?.error || 'La nueva contraseña no es válida' });
        return;
      }

      toast.error(data?.error || 'Error inesperado del servidor. Intenta de nuevo más tarde.');
    },
  });

  const validate = () => {
    const errors = {};
    if (!form.currentPassword) errors.currentPassword = 'Ingresa tu contraseña actual';
    if (!form.newPassword) {
      errors.newPassword = 'Ingresa una nueva contraseña';
    } else if (form.newPassword.length < 8) {
      errors.newPassword = 'Debe tener al menos 8 caracteres';
    } else if (form.currentPassword && form.newPassword === form.currentPassword) {
      errors.newPassword = 'Debe ser diferente de la contraseña actual';
    }
    if (!form.confirmPassword) {
      errors.confirmPassword = 'Confirma la nueva contraseña';
    } else if (form.newPassword && form.confirmPassword !== form.newPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden';
    }
    return errors;
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const togglePass = (field) => setShowPass((prev) => ({ ...prev, [field]: !prev[field] }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mutation.isPending) return;

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    mutation.mutate();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#242938] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2e3650] w-full max-w-sm p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id={titleId} className="text-base font-bold text-gray-800 dark:text-gray-100">
                Cambiar contraseña
              </h3>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Cerrar"
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-3 mb-5">
                <div>
                  <label
                    htmlFor={`${formId}-currentPassword`}
                    className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                  >
                    Contraseña actual
                  </label>
                  <PasswordInput
                    id={`${formId}-currentPassword`}
                    value={form.currentPassword}
                    onChange={handleChange('currentPassword')}
                    showPass={showPass.currentPassword}
                    onToggle={() => togglePass('currentPassword')}
                    autoComplete="current-password"
                    aria-invalid={Boolean(fieldErrors.currentPassword)}
                    aria-describedby={
                      fieldErrors.currentPassword ? `${formId}-currentPassword-error` : undefined
                    }
                    disabled={mutation.isPending}
                  />
                  {fieldErrors.currentPassword && (
                    <p
                      id={`${formId}-currentPassword-error`}
                      role="alert"
                      className="text-xs text-red-500 mt-1"
                    >
                      {fieldErrors.currentPassword}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor={`${formId}-newPassword`}
                    className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                  >
                    Nueva contraseña
                  </label>
                  <PasswordInput
                    id={`${formId}-newPassword`}
                    value={form.newPassword}
                    onChange={handleChange('newPassword')}
                    showPass={showPass.newPassword}
                    onToggle={() => togglePass('newPassword')}
                    autoComplete="new-password"
                    aria-invalid={Boolean(fieldErrors.newPassword)}
                    aria-describedby={
                      fieldErrors.newPassword ? `${formId}-newPassword-error` : undefined
                    }
                    disabled={mutation.isPending}
                  />
                  {fieldErrors.newPassword ? (
                    <p
                      id={`${formId}-newPassword-error`}
                      role="alert"
                      className="text-xs text-red-500 mt-1"
                    >
                      {fieldErrors.newPassword}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Mínimo 8 caracteres
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor={`${formId}-confirmPassword`}
                    className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                  >
                    Confirmar nueva contraseña
                  </label>
                  <PasswordInput
                    id={`${formId}-confirmPassword`}
                    value={form.confirmPassword}
                    onChange={handleChange('confirmPassword')}
                    showPass={showPass.confirmPassword}
                    onToggle={() => togglePass('confirmPassword')}
                    autoComplete="new-password"
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    aria-describedby={
                      fieldErrors.confirmPassword ? `${formId}-confirmPassword-error` : undefined
                    }
                    disabled={mutation.isPending}
                  />
                  {fieldErrors.confirmPassword && (
                    <p
                      id={`${formId}-confirmPassword-error`}
                      role="alert"
                      className="text-xs text-red-500 mt-1"
                    >
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  type="button"
                  onClick={handleClose}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                  disabled={mutation.isPending}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors disabled:opacity-40"
                >
                  Cancelar
                </motion.button>
                <motion.button
                  type="submit"
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                  disabled={mutation.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-primary-900 bg-accent-400 hover:bg-accent-300 disabled:opacity-40 transition-colors"
                >
                  {mutation.isPending ? 'Guardando...' : 'Guardar'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
