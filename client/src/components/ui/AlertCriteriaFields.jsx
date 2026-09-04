import { CITY_LABELS, TYPE_LABELS, labelsToOptions } from '../../utils/constants';
import { PHONE_PATTERN, PHONE_PATTERN_TITLE } from '../../utils/phone';

const CITIES = [
  { value: '', label: 'Cualquier ciudad' },
  ...labelsToOptions(CITY_LABELS, ['otra']),
];
const TYPES = [{ value: '', label: 'Cualquier tipo' }, ...labelsToOptions(TYPE_LABELS)];

export const inputCls =
  'w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent-500 dark:placeholder-gray-500';

// Campos compartidos por el formulario público de alta (AlertSubscriptionForm) y la página de
// edición por token (ManageAlertPage) — mismo subconjunto de criterios que acepta el backend en
// ambos flujos (subscribe / PUT /alerts/manage). No incluye email: en subscribe se captura aparte
// (identifica a quién le llega el correo) y en manage no es editable (ver alertController).
export default function AlertCriteriaFields({ form, onChange, formId }) {
  return (
    <>
      <div>
        <label
          htmlFor={`${formId}-name`}
          className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
        >
          Nombre *
        </label>
        <input
          id={`${formId}-name`}
          name="name"
          value={form.name}
          onChange={onChange}
          placeholder="Tu nombre"
          maxLength={100}
          className={inputCls}
        />
      </div>
      <div>
        <label
          htmlFor={`${formId}-phone`}
          className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
        >
          Teléfono / WhatsApp *
        </label>
        <input
          id={`${formId}-phone`}
          name="phone"
          type="tel"
          required
          value={form.phone}
          onChange={onChange}
          placeholder="Ej: 6561234567"
          maxLength={20}
          pattern={PHONE_PATTERN}
          title={PHONE_PATTERN_TITLE}
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`${formId}-city`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Ciudad
          </label>
          <select
            id={`${formId}-city`}
            name="city"
            value={form.city}
            onChange={onChange}
            className={inputCls}
          >
            {CITIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`${formId}-type`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Tipo
          </label>
          <select
            id={`${formId}-type`}
            name="type"
            value={form.type}
            onChange={onChange}
            className={inputCls}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`${formId}-minPrice`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Precio mínimo (opcional)
          </label>
          <input
            id={`${formId}-minPrice`}
            name="minPrice"
            value={
              form.minPrice
                ? Number(form.minPrice.toString().replace(/[^0-9]/g, '')).toLocaleString('es-MX')
                : ''
            }
            onChange={(e) =>
              onChange({
                target: { name: 'minPrice', value: e.target.value.replace(/[^0-9]/g, '') },
              })
            }
            placeholder="Ej: 500,000"
            className={inputCls}
          />
        </div>
        <div>
          <label
            htmlFor={`${formId}-maxPrice`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Precio máximo (opcional)
          </label>
          <input
            id={`${formId}-maxPrice`}
            name="maxPrice"
            value={
              form.maxPrice
                ? Number(form.maxPrice.toString().replace(/[^0-9]/g, '')).toLocaleString('es-MX')
                : ''
            }
            onChange={(e) =>
              onChange({
                target: { name: 'maxPrice', value: e.target.value.replace(/[^0-9]/g, '') },
              })
            }
            placeholder="Ej: 1,500,000"
            className={inputCls}
          />
        </div>
      </div>
    </>
  );
}
