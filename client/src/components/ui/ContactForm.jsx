import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createLead } from '../../services/leadService';

export default function ContactForm({ propertyId, propertyTitle }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', type: 'contacto' });

  const { mutate, isPending } = useMutation({
    mutationFn: (data) => createLead(data),
    onSuccess: () => {
      toast.success('¡Mensaje enviado! Te contactaremos pronto.');
      setForm({ name: '', email: '', phone: '', message: '', type: 'contacto' });
    },
    onError: () => toast.error('Error al enviar. Intenta de nuevo.'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return toast.error('Nombre y email son requeridos');
    mutate({ ...form, propertyId });
  };

  const field = (key, placeholder, type = 'text') => (
    <input
      type={type}
      placeholder={placeholder}
      value={form[key]}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {propertyTitle && <p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg line-clamp-2">{propertyTitle}</p>}
      {field('name', 'Tu nombre *')}
      {field('email', 'Tu email *', 'email')}
      {field('phone', 'Tu teléfono')}
      <select
        value={form.type}
        onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="contacto">Solicitar información</option>
        <option value="cita">Agendar visita</option>
        <option value="informacion">Información del remate</option>
      </select>
      <textarea
        placeholder="Tu mensaje..."
        value={form.message}
        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
        rows={3}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-yellow-400 text-blue-900 py-3 rounded-xl font-bold hover:bg-yellow-300 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Enviando...' : 'Enviar mensaje'}
      </button>
    </form>
  );
}
