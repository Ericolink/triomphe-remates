import { motion } from 'framer-motion';

// Toggle genérico reutilizable — no existía ninguno en el proyecto (ver auditoría del
// toggle de inventario); mismos tokens de color que el resto del panel admin
// (accent-400/primary-900 para "activado", gris para "desactivado").
export default function Switch({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 dark:focus:ring-offset-[#1a1f2e] disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-accent-400' : 'bg-gray-300 dark:bg-[#3a4258]'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
