import { motion } from 'framer-motion';

const DEFAULT_BAR_COLOR = 'bg-blue-900 dark:bg-blue-500';

// Fila de barra de progreso reutilizada en los desgloses "categóricos" del Dashboard
// (embudo comercial, motivos de cierre, citas por estado, etc). El color depende de la
// categoría de cada fila (ver los mapas *_BAR_COLORS en utils/constants.js), no de un
// azul uniforme, para poder distinguir cada rama dentro de la misma gráfica.
export default function ProgressRow({ label, total, max, index, color = DEFAULT_BAR_COLOR }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600 dark:text-gray-300">{label}</span>
        <span className="font-semibold text-gray-800 dark:text-gray-100">{total}</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-[#2e3650] rounded-full overflow-hidden">
        <motion.div className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }} animate={{ width: `${max > 0 ? (total / max) * 100 : 0}%` }}
          transition={{ duration: 0.8, delay: 0.2 + index * 0.08, ease: 'easeOut' }} />
      </div>
    </div>
  );
}
