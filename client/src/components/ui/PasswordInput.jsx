import { Eye, EyeOff } from 'lucide-react';

// Input de contraseña con botón mostrar/ocultar — usado por cualquier formulario que
// capture contraseñas en el panel admin (UsersPage, ChangePasswordModal).
export default function PasswordInput({
  value,
  onChange,
  placeholder,
  required,
  showPass,
  onToggle,
  ...props
}) {
  return (
    <div className="relative">
      <input
        type={showPass ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 pr-10 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white dark:placeholder-gray-500"
        {...props}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={showPass}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      >
        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}
