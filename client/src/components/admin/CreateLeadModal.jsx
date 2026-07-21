import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { buttonHover, buttonTap } from '../../utils/animations';
import { getCampaigns } from '../../services/campaignService';
import { getProperties } from '../../services/propertyService';
import { getUsers } from '../../services/usersService';
import { SOURCE_LABELS, PAYMENT_METHOD_LABELS } from '../../utils/constants';
import { todayISODate } from '../../utils/formatters';
import useModalA11y from '../../hooks/useModalA11y';

const emptyForm = {
  name: '',
  phone: '',
  source: 'directo',
  firstContactDate: '',
  paymentMethod: '',
  budgetAmount: '',
  budgetNotSpecified: false,
  campaignId: '',
  propertyId: '',
  assignedToUserId: '',
};

// Flujo "Registrar un nuevo prospecto" (CRM_UX_DESIGN.md §2.a): modal corto, sin
// navegar de página, con los campos mínimos — ningún campo es obligatorio (un prospecto
// capturado de prisa a veces solo trae teléfono; el backend rellena un nombre
// placeholder si se deja en blanco). El correo se eliminó del formulario (el equipo
// comercial casi nunca lo usa); el modelo lo conserva para los prospectos que llegan
// por el formulario público del sitio.
export default function CreateLeadModal({ open, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState(emptyForm);
  const titleId = useId();

  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns-for-picker'],
    queryFn: () => getCampaigns({ limit: 100 }),
    enabled: open,
  });
  const { data: propertiesData } = useQuery({
    queryKey: ['properties-for-picker'],
    queryFn: () => getProperties({ limit: 50 }),
    enabled: open,
  });
  const { data: usersData } = useQuery({
    queryKey: ['users-all'],
    queryFn: getUsers,
    enabled: open,
  });

  const campaigns = campaignsData?.data ?? [];
  const properties = propertiesData?.data ?? [];
  const users = (usersData?.data ?? []).filter((u) => u.isActive);

  const inputClass =
    'w-full px-3 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100';

  const handleClose = () => {
    setForm(emptyForm);
    onClose();
  };
  const panelRef = useModalA11y(open, handleClose);

  // Solo bloquea el envío si el monto viene mal formado; nunca es obligatorio (ver
  // requerimiento "no especificó el monto").
  const budgetInvalid =
    !form.budgetNotSpecified &&
    form.budgetAmount.trim() !== '' &&
    (Number.isNaN(Number(form.budgetAmount)) || Number(form.budgetAmount) < 0);

  const handleSubmit = () => {
    if (budgetInvalid) return;
    onSubmit({
      name: form.name.trim() || undefined,
      phone: form.phone.trim() || undefined,
      source: form.source,
      firstContactDate: form.firstContactDate || undefined,
      paymentMethod: form.paymentMethod || undefined,
      budgetNotSpecified: form.budgetNotSpecified,
      budgetAmount: form.budgetNotSpecified
        ? null
        : form.budgetAmount.trim() !== ''
          ? Number(form.budgetAmount)
          : undefined,
      campaignId: form.campaignId ? Number(form.campaignId) : undefined,
      propertyId: form.propertyId ? Number(form.propertyId) : undefined,
      assignedToUserId: form.assignedToUserId ? Number(form.assignedToUserId) : undefined,
    });
    setForm(emptyForm);
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
            className="bg-white dark:bg-[#242938] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2e3650] w-full max-w-md p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id={titleId} className="text-base font-bold text-gray-800 dark:text-gray-100">
                Nuevo prospecto
              </h3>
              <button
                onClick={handleClose}
                aria-label="Cerrar"
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Nombre (opcional)
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nombre del prospecto"
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="6141234567"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Origen
                  </label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                    className={inputClass}
                  >
                    {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Fecha de primer contacto (opcional)
                </label>
                <input
                  type="date"
                  max={todayISODate()}
                  value={form.firstContactDate}
                  onChange={(e) => setForm((f) => ({ ...f, firstContactDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Forma de pago (opcional)
                </label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Sin especificar</option>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              {/* El monto solo se pregunta una vez que se sabe cómo planea comprar el
                  prospecto — reduce el formulario a un campo menos cuando aún no aplica. */}
              {form.paymentMethod && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                      Monto disponible
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.budgetNotSpecified}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            budgetNotSpecified: e.target.checked,
                            budgetAmount: e.target.checked ? '' : f.budgetAmount,
                          }))
                        }
                        className="w-3.5 h-3.5 rounded accent-blue-600"
                      />
                      No especificó el monto
                    </label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={form.budgetAmount}
                    disabled={form.budgetNotSpecified}
                    onChange={(e) => setForm((f) => ({ ...f, budgetAmount: e.target.value }))}
                    placeholder="Ej. 1500000"
                    className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed ${budgetInvalid ? 'ring-2 ring-red-400' : ''}`}
                  />
                  {budgetInvalid && (
                    <p className="text-xs text-red-500 mt-1">Ingresa un monto válido</p>
                  )}
                </div>
              )}
              {campaigns.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Campaña (opcional)
                  </label>
                  <select
                    value={form.campaignId}
                    onChange={(e) => setForm((f) => ({ ...f, campaignId: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Sin campaña</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {properties.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Propiedad de interés (opcional)
                  </label>
                  <select
                    value={form.propertyId}
                    onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Ninguna</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Responsable (opcional)
                </label>
                <select
                  value={form.assignedToUserId}
                  onChange={(e) => setForm((f) => ({ ...f, assignedToUserId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Sin asignar</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
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
                disabled={budgetInvalid || isPending}
                whileHover={buttonHover}
                whileTap={buttonTap}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {isPending ? 'Guardando...' : 'Crear prospecto'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
