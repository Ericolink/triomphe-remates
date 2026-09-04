import { useId, useState } from 'react';
import { Bell, CheckCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { subscribe } from '../../services/alertService';
import { motion } from 'framer-motion';
import { fadeInUp } from '../../utils/animations';
import AlertCriteriaFields, { inputCls } from './AlertCriteriaFields';

const INIT = {
  name: '',
  email: '',
  phone: '',
  city: '',
  type: '',
  minPrice: '',
  maxPrice: '',
};

export default function AlertSubscriptionForm() {
  const [form, setForm] = useState(INIT);
  const [sent, setSent] = useState(false);
  const formId = useId();

  const mutation = useMutation({
    mutationFn: subscribe,
    onSuccess: () => setSent(true),
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al suscribirse'),
  });

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error('Nombre, email y teléfono son requeridos');
      return;
    }
    mutation.mutate({
      ...form,
      minPrice: form.minPrice || undefined,
      maxPrice: form.maxPrice || undefined,
    });
  };

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
      <div>
        <label
          htmlFor={`${formId}-email`}
          className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
        >
          Email *
        </label>
        <input
          id={`${formId}-email`}
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="tu@email.com"
          maxLength={150}
          className={inputCls}
        />
      </div>
      <AlertCriteriaFields form={form} onChange={handleChange} formId={formId} />
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent-400 text-primary-900 rounded-xl text-sm font-medium hover:bg-accent-300 transition-colors disabled:opacity-60"
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
