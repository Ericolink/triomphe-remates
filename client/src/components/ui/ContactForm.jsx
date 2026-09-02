import { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Landmark, Banknote } from 'lucide-react';
import { createPublicLead } from '../../services/leadService';
import {
  LEAD_TYPE_LABELS,
  PROPERTY_LEAD_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  BUDGET_RANGE_OPTIONS,
  LEAD_SEARCH_CITY_OPTIONS,
  LEAD_SEARCH_TYPE_OPTIONS,
  labelsToOptions,
} from '../../utils/constants';
import { todayISODate } from '../../utils/formatters';
import { PHONE_PATTERN, PHONE_PATTERN_TITLE } from '../../utils/phone';

const LEAD_TYPE_OPTIONS = labelsToOptions(LEAD_TYPE_LABELS, [
  'informacion',
  'propiedades_similares',
]);
const PROPERTY_LEAD_TYPE_OPTIONS = labelsToOptions(PROPERTY_LEAD_TYPE_LABELS);

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
  paymentMethod: '',
  budgetAmount: '',
  desiredType: '',
  searchCity: '',
  searchZone: '',
};

export default function ContactForm({ propertyId, propertyTitle, defaultSource }) {
  const formId = useId();
  const [searchParams] = useSearchParams();
  const source =
    defaultSource || searchParams.get('source') || searchParams.get('utm_source') || 'directo';
  // Fase 3a del rediseño del CRM: captura automática de atribución — nunca se le pregunta
  // esto al prospecto, solo se lee de la URL si un anuncio la trae (ver
  // leadController.createLead, que además intenta auto-vincular la campaña por
  // utmCampaign). `landingPageUrl` no se manda desde aquí — el backend ya la toma sola
  // del header Referer del propio request.
  const utmMedium = searchParams.get('utm_medium') || undefined;
  const utmCampaign = searchParams.get('utm_campaign') || undefined;
  const utmContent = searchParams.get('utm_content') || undefined;
  const [form, setForm] = useState(emptyForm);
  const typeOptions = propertyId ? PROPERTY_LEAD_TYPE_OPTIONS : LEAD_TYPE_OPTIONS;

  const { mutate, isPending } = useMutation({
    mutationFn: (data) => createPublicLead(data),
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
    if (!form.paymentMethod) return toast.error('Elige cómo planeas pagar');
    if (!form.budgetAmount) return toast.error('Elige tu presupuesto aproximado');

    let appointmentDate;
    if (isCita) {
      if (!form.appointmentDate || !form.appointmentTime) {
        return toast.error('Elige fecha y hora para tu cita');
      }
      // CAL-001: `${form.appointmentDate}T${form.appointmentTime}:00` es un string SIN
      // zona horaria — si se mandara tal cual al backend, Node lo reinterpretaría con la
      // zona horaria del SERVIDOR (no la del navegador del cliente) al convertirlo a
      // Date, desplazando la hora silenciosamente si el host no está en la zona horaria
      // de México. Aquí se construye el Date una sola vez — `new Date(...)` interpreta
      // el string SIN zona horaria como hora LOCAL DEL NAVEGADOR (la zona horaria real del
      // cliente, que es justo lo que "hora de la cita" debe significar) — y se envía su
      // `.toISOString()` (con sufijo Z, siempre UTC), que cualquier servidor interpreta de
      // forma idéntica sin importar en qué zona horaria esté corriendo.
      const localDateTime = new Date(`${form.appointmentDate}T${form.appointmentTime}:00`);
      if (localDateTime.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
        return toast.error('La cita debe programarse con al menos 24 horas de anticipación');
      }
      appointmentDate = localDateTime.toISOString();
    }

    mutate({
      ...form,
      appointmentDate,
      propertyId,
      source,
      paymentMethod: form.paymentMethod,
      budgetAmount: Number(form.budgetAmount),
      budgetNotSpecified: false,
      // Opcionales — se omiten del body en vez de mandarse como '' (el backend valida
      // contra el ENUM y rechazaría un string vacío como valor inválido).
      desiredType: form.desiredType || undefined,
      searchCity: form.searchCity || undefined,
      searchZone: form.searchZone.trim() || undefined,
      utmMedium,
      utmCampaign,
      utmContent,
    });
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
        {typeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {/* Opcionales — ayudan al asesor a saber qué mostrarte sin alargar el formulario con
          preguntas obligatorias (recámaras/baños/características se afinan en la llamada).
          `searchZone` solo aparece una vez elegida una ciudad — preguntarla antes no
          tendría sentido (progresivo, no una pregunta más siempre visible). */}
      <div className="grid grid-cols-2 gap-3">
        <select
          value={form.desiredType}
          onChange={(e) => setForm((f) => ({ ...f, desiredType: e.target.value }))}
          className={inputClass}
        >
          <option value="">Tipo de propiedad</option>
          {LEAD_SEARCH_TYPE_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={form.searchCity}
          onChange={(e) => setForm((f) => ({ ...f, searchCity: e.target.value }))}
          className={inputClass}
        >
          <option value="">Ciudad de interés</option>
          {LEAD_SEARCH_CITY_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {form.searchCity && (
        <input
          type="text"
          placeholder="Zona o colonia de tu interés (opcional)"
          value={form.searchZone}
          onChange={(e) => setForm((f) => ({ ...f, searchZone: e.target.value }))}
          className={inputClass}
        />
      )}
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          ¿Cómo planeas pagar? *
        </p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => {
            const Icon = value === 'credito_hipotecario' ? Landmark : Banknote;
            const active = form.paymentMethod === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, paymentMethod: value }))}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  active
                    ? 'bg-accent-400 border-accent-400 text-primary-900'
                    : 'bg-white dark:bg-[#1a1f2e] border-gray-200 dark:border-[#2e3650] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650]'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <select
        value={form.budgetAmount}
        onChange={(e) => setForm((f) => ({ ...f, budgetAmount: e.target.value }))}
        className={inputClass}
      >
        <option value="" disabled>
          Presupuesto aproximado *
        </option>
        {BUDGET_RANGE_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
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
