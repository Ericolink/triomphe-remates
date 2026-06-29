import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createLead } from '../../services/leadService';

export default function ContactForm({ propertyId, propertyTitle, defaultSource }) {
  const [searchParams] = useSearchParams();
  const source = defaultSource || searchParams.get('source') || searchParams.get('utm_source') || 'directo';
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', type: 'contacto' });

  const { mutate, isPending } = useMutation({
    mutationFn: (data) => createLead(data),
    onSuccess: () => {
      toast.success('¡Mensaje enviado! Te contactaremos pronto.');
      setForm({ name: '', email: '', phone: '', message: '', type: 'contacto' });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al enviar. Intenta de nuevo.'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return toast.error('Nombre y email son requeridos');
    mutate({ ...form, propertyId, source });
  };

  const inputClass = "w-full px-3 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {propertyTitle && (
        <p className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-[#2e3650] px-3 py-2 rounded-lg line-clamp-2">
          {propertyTitle}
        </p>
      )}
      <input type="text" placeholder="Tu nombre *" value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className={inputClass} />
      <input type="email" placeholder="Tu email *" value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        className={inputClass} />
      <input type="tel" placeholder="Tu teléfono" value={form.phone} maxLength={20}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        pattern="^(\+?52)?\d{10}$" title="10 dígitos, con o sin +52"
        className={inputClass} />
      <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
        className={inputClass}>
        <option value="contacto">Solicitar información</option>
        <option value="cita">Agendar visita</option>
        <option value="informacion">Información del remate</option>
      </select>
      <textarea placeholder="Tu mensaje..." value={form.message}
        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
        rows={3} className={`${inputClass} resize-none`} />
      <button type="submit" disabled={isPending}
        className="w-full bg-yellow-400 text-blue-900 py-3 rounded-xl font-bold hover:bg-yellow-300 transition-colors disabled:opacity-50">
        {isPending ? 'Enviando...' : 'Enviar mensaje'}
      </button>
    </form>
  );
}
