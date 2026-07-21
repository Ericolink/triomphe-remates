import { useState } from 'react';
import { Bell, CheckCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { subscribe } from '../../services/alertService';
import { motion } from 'framer-motion';
import { fadeInUp } from '../../utils/animations';
import { CITY_LABELS, TYPE_LABELS, labelsToOptions } from '../../utils/constants';

const CITIES = [
  { value: '', label: 'Cualquier ciudad' },
  ...labelsToOptions(CITY_LABELS, ['otra']),
];
const TYPES = [{ value: '', label: 'Cualquier tipo' }, ...labelsToOptions(TYPE_LABELS)];

const INIT = { name: '', email: '', phone: '', city: '', type: '', maxPrice: '' };

export default function AlertSubscriptionForm() {
  const [form, setForm] = useState(INIT);
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: subscribe,
    onSuccess: () => setSent(true),
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al suscribirse'),
  });

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Nombre y email son requeridos');
      return;
    }
    mutation.mutate({
      ...form,
      maxPrice: form.maxPrice ? form.maxPrice.replace(/[^0-9]/g, '') : undefined,
    });
  };

  const inputCls =
    'w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-500';

  if (sent)
    return (
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center gap-3 py-6 text-center"
      >
        <CheckCircle size={36} className="text-green-500" />
        <p className="font-semibold text-gray-800 dark:text-gray-100">¡Alerta activada!</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Te avisaremos cuando llegue una propiedad que coincida.
        </p>
      </motion.div>
    );

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Nombre *
          </label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Tu nombre"
            maxLength={100}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Email *
          </label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="tu@email.com"
            maxLength={150}
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Teléfono / WhatsApp (opcional)
        </label>
        <input
          name="phone"
          type="tel"
          value={form.phone}
          onChange={handleChange}
          placeholder="Ej: 6561234567"
          maxLength={20}
          pattern="^(\+?52)?\d{10}$"
          title="10 dígitos, con o sin +52"
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Ciudad
          </label>
          <select name="city" value={form.city} onChange={handleChange} className={inputCls}>
            {CITIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Tipo
          </label>
          <select name="type" value={form.type} onChange={handleChange} className={inputCls}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Precio máximo (opcional)
        </label>
        <input
          name="maxPrice"
          value={
            form.maxPrice
              ? Number(form.maxPrice.replace(/[^0-9]/g, '')).toLocaleString('es-MX')
              : ''
          }
          onChange={handleChange}
          placeholder="Ej: 1,500,000"
          className={inputCls}
        />
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-900 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors disabled:opacity-60"
      >
        {mutation.isPending ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Bell size={15} />
        )}
        {mutation.isPending ? 'Activando...' : 'Activar alerta'}
      </button>
    </form>
  );
}
