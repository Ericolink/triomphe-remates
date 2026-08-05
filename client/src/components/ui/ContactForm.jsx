import { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createLead } from '../../services/leadService';
import { LEAD_TYPE_LABELS, labelsToOptions } from '../../utils/constants';
import { todayISODate } from '../../utils/formatters';
import { PHONE_PATTERN, PHONE_PATTERN_TITLE } from '../../utils/phone';

const LEAD_TYPE_OPTIONS = labelsToOptions(LEAD_TYPE_LABELS, [
  'informacion',
  'propiedades_similares',
]);

// Horario comercial anunciado en ContactPage.jsx ("Lun - Vie: 9:00 AM - 6:00 PM") — mismo
// rango que valida leadController.validateAppointmentDate en el backend. Slots fijos en
// vez de un <input type="time"> libre: sin un sistema de disponibilidad real todavía, esto
// deja la estructura lista para marcar horarios ocupados como disabled en el futuro.
const APPOINTMENT_TIME_SLOTS = Array.from({ length: 9 }, (_, i) => {
  const hour = 9 + i;
  const label = hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`;
  return { value: `${String(hour).padStart(2, '0')}:00`, label };
});

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  message: '',
  type: 'contacto',
  appointmentDate: '',
  appointmentTime: '',
};

export default function ContactForm({ propertyId, propertyTitle, defaultSource }) {
  const formId = useId();
  const [searchParams] = useSearchParams();
  const source =
    defaultSource || searchParams.get('source') || searchParams.get('utm_source') || 'directo';
  const [form, setForm] = useState(emptyForm);

  const { mutate, isPending } = useMutation({
    mutationFn: (data) => createLead(data),
    onSuccess: () => {
      toast.success('¡Mensaje enviado! Te contactaremos pronto.');
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al enviar. Intenta de nuevo.'),
  });

  const isCita = form.type === 'cita';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return toast.error('Nombre y teléfono son requeridos');

    let appointmentDate;
    if (isCita) {
      if (!form.appointmentDate || !form.appointmentTime) {
        return toast.error('Elige fecha y hora para tu cita');
      }
      appointmentDate = `${form.appointmentDate}T${form.appointmentTime}:00`;
      if (new Date(appointmentDate).getTime() - Date.now() < 24 * 60 * 60 * 1000) {
        return toast.error('La cita debe programarse con al menos 24 horas de anticipación');
      }
    }

    mutate({ ...form, appointmentDate, propertyId, source });
  };

  const inputClass =
    'w-full px-3 py-3 border border-gray-200 dark:border-[#2e3650] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {propertyTitle && (
        <p className="text-sm text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-[#2e3650] px-3 py-2 rounded-lg line-clamp-2">
          {propertyTitle}
        </p>
      )}
      <input
        type="text"
        placeholder="Tu nombre *"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className={inputClass}
      />
      <input
        type="tel"
        placeholder="Tu teléfono *"
        value={form.phone}
        maxLength={20}
        required
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        pattern={PHONE_PATTERN}
        title={PHONE_PATTERN_TITLE}
        className={inputClass}
      />
      <input
        type="email"
        placeholder="Tu email"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        className={inputClass}
      />
      <select
        value={form.type}
        onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
        className={inputClass}
      >
        {LEAD_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {isCita && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={`${formId}-appointmentDate`}
              className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1"
            >
              Fecha *
            </label>
            <input
              id={`${formId}-appointmentDate`}
              type="date"
              min={todayISODate()}
              required
              value={form.appointmentDate}
              onChange={(e) => setForm((f) => ({ ...f, appointmentDate: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor={`${formId}-appointmentTime`}
              className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1"
            >
              Hora *
            </label>
            <select
              id={`${formId}-appointmentTime`}
              required
              value={form.appointmentTime}
              onChange={(e) => setForm((f) => ({ ...f, appointmentTime: e.target.value }))}
              className={inputClass}
            >
              <option value="" disabled>
                Elige un horario
              </option>
              {APPOINTMENT_TIME_SLOTS.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <textarea
        placeholder="Tu mensaje..."
        value={form.message}
        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
        rows={3}
        className={`${inputClass} resize-none`}
      />
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-accent-400 text-primary-900 py-3 rounded-xl font-bold text-lg hover:bg-accent-300 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Enviando...' : 'Enviar mensaje'}
      </button>
    </form>
  );
}
