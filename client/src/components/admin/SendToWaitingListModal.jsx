import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { buttonHover, buttonTap } from '../../utils/animations';
import { CITY_LABELS, TYPE_LABELS, labelsToOptions } from '../../utils/constants';
import useModalA11y from '../../hooks/useModalA11y';

// Modal para mandar un prospecto a la lista de espera del panel admin (WaitingListPage,
// modelo PropertyAlert con source:'staff') — mismo shell visual que CloseLeadModal, pero
// hermano en vez de una 3ra rama ahí: los campos no tienen nada en común con cerrar como
// ganado/perdido. Nombre/teléfono/correo/línea de negocio se toman del prospecto ya
// registrado (el servidor los copia, no se vuelven a pedir aquí); todo lo demás es opcional.
export default function SendToWaitingListModal({ open, lead, onClose, onConfirm, isPending }) {
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [state, setState] = useState('');
  const titleId = useId();
  const formId = useId();

  const reset = () => {
    setCity('');
    setType('');
    setMinPrice('');
    setMaxPrice('');
    setState('');
  };
  const handleClose = () => {
    reset();
    onClose();
  };
  const panelRef = useModalA11y(open, handleClose);

  if (!lead) return null;

  const handleSubmit = () => {
    if (isPending) return;
    onConfirm({
      city: city || undefined,
      type: type || undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      state: state.trim() || undefined,
    });
  };

  const inputClass =
    'w-full px-3 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100';

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
                Enviar a lista de espera
              </h3>
              <button
                onClick={handleClose}
                aria-label="Cerrar"
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{lead.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Se usará el nombre, teléfono, correo y línea de negocio ya registrados en este
              prospecto. Este prospecto desaparecerá de la vista principal de Prospectos.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label
                  htmlFor={`${formId}-city`}
                  className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  Ciudad
                </label>
                <select
                  id={`${formId}-city`}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Cualquier ciudad</option>
                  {labelsToOptions(CITY_LABELS, ['otra']).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor={`${formId}-type`}
                  className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  Tipo de propiedad de interés
                </label>
                <select
                  id={`${formId}-type`}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Cualquier tipo</option>
                  {labelsToOptions(TYPE_LABELS).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor={`${formId}-minPrice`}
                    className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                  >
                    Precio mín.
                  </label>
                  <input
                    id={`${formId}-minPrice`}
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="800000"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${formId}-maxPrice`}
                    className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                  >
                    Precio máx.
                  </label>
                  <input
                    id={`${formId}-maxPrice`}
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="1500000"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor={`${formId}-state`}
                  className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  Estado
                </label>
                <input
                  id={`${formId}-state`}
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Chihuahua"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <motion.button
                type="button"
                onClick={handleClose}
                whileHover={buttonHover}
                whileTap={buttonTap}
                className="flex-1 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
              >
                Cancelar
              </motion.button>
              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                whileHover={buttonHover}
                whileTap={buttonTap}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-primary-900 bg-accent-400 hover:bg-accent-300 disabled:opacity-40 transition-colors"
              >
                {isPending ? 'Guardando...' : 'Confirmar'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
