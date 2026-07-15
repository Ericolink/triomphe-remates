import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { buttonHover, buttonTap } from '../../utils/animations';
import { formatPrice } from '../../utils/formatters';
import { CLOSE_REASON_LABELS } from '../../utils/constants';

// Modal obligatorio y mínimo al cerrar un prospecto (drag a una columna terminal del
// Kanban, o botón directo en el detalle) — mismo patrón visual que ConfirmDialog, pero
// con un formulario corto en vez de solo confirmar/cancelar. Ver CRM_UX_DESIGN.md §10.c:
// debe sentirse rápido, no burocrático.
export default function CloseLeadModal({ open, lead, targetStage, onClose, onConfirmWon, onConfirmLost, isPending }) {
  const [propertyId, setPropertyId] = useState('');
  const [amount, setAmount] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [closeReasonDetail, setCloseReasonDetail] = useState('');

  if (!lead) return null;

  const propertyOptions = [lead.property, ...(lead.interestedProperties || [])]
    .filter(Boolean)
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
  const selectedProperty = propertyOptions.find((p) => String(p.id) === propertyId);

  const isWon = targetStage === 'venta_realizada';
  const canSubmit = isWon
    ? propertyId && amount
    : closeReason && (closeReason !== 'otro' || closeReasonDetail.trim());

  const reset = () => { setPropertyId(''); setAmount(''); setCloseReason(''); setCloseReasonDetail(''); };

  const handleClose = () => { reset(); onClose(); };

  // Preasigna el monto con el precio de la propiedad elegida (si lo tiene — puede estar
  // en "PENDIENTE"/null) para no obligar a ir a buscarlo aparte; sigue siendo editable
  // por si el precio de venta final fue distinto al de lista.
  const handlePropertyChange = (e) => {
    const id = e.target.value;
    setPropertyId(id);
    const selected = propertyOptions.find((p) => String(p.id) === id);
    if (selected?.price != null) setAmount(String(Number(selected.price)));
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (isWon) {
      onConfirmWon({ propertyId: Number(propertyId), amount: Number(amount) });
    } else {
      onConfirmLost({ closeReason, closeReasonDetail: closeReasonDetail.trim() || undefined });
    }
  };

  const inputClass = "w-full px-3 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100";

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}>
          <motion.div initial={{ scale: 0.95, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }} transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#242938] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2e3650] w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">
                {isWon ? 'Registrar venta' : 'Marcar como no interesado'}
              </h3>
              <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{lead.name}</p>

            {isWon ? (
              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Propiedad</label>
                  {propertyOptions.length === 0 ? (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2">
                      Agrega una propiedad de interés en el detalle del prospecto antes de registrar la venta.
                    </p>
                  ) : (
                    <select value={propertyId} onChange={handlePropertyChange} className={inputClass}>
                      <option value="">Selecciona una propiedad...</option>
                      {propertyOptions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Monto (MXN)</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder="1850000" className={inputClass} />
                  {selectedProperty && (
                    selectedProperty.price != null
                      ? <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Precio de lista: {formatPrice(selectedProperty.price)} · puedes ajustarlo si la venta fue por otro monto</p>
                      : <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Esta propiedad no tiene precio de lista (PENDIENTE) — captura el monto manualmente</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Motivo</label>
                  <select value={closeReason} onChange={(e) => setCloseReason(e.target.value)} className={inputClass}>
                    <option value="">Selecciona un motivo...</option>
                    {Object.entries(CLOSE_REASON_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                {closeReason === 'otro' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Detalle</label>
                    <textarea value={closeReasonDetail} onChange={(e) => setCloseReasonDetail(e.target.value)}
                      rows={2} className={`${inputClass} resize-none`} />
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <motion.button type="button" onClick={handleClose} whileHover={buttonHover} whileTap={buttonTap}
                className="flex-1 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors">
                Cancelar
              </motion.button>
              <motion.button type="button" onClick={handleSubmit} disabled={!canSubmit || isPending}
                whileHover={buttonHover} whileTap={buttonTap}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors">
                {isPending ? 'Guardando...' : 'Confirmar'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
