import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { requestCatalogPDF, getInventoryDownloadStatus } from '../../services/catalogService';
import { fadeInUp } from '../../utils/animations';
import { downloadBlob } from '../../utils/download';
import { PHONE_PATTERN, PHONE_PATTERN_TITLE } from '../../utils/phone';
import { LEAD_TYPE_LABELS, labelsToOptions } from '../../utils/constants';

const DEFAULT_REQUEST_MESSAGE =
  'Hemos recibido tus datos correctamente. Nuestro equipo se pondrá en contacto contigo para compartirte el inventario.';

// Mismo criterio que LEAD_TYPE_OPTIONS en ContactForm.jsx: excluye 'informacion'/
// 'propiedades_similares' (valores históricos, ya no seleccionables en formularios nuevos).
const INTEREST_OPTIONS = labelsToOptions(LEAD_TYPE_LABELS, [
  'informacion',
  'propiedades_similares',
]);

const INIT = { name: '', phone: '', email: '', interest: '' };

// Descarga del catálogo gateada por datos de contacto — pedido del dueño del negocio: un
// visitante puede bajar el inventario en PDF, pero primero deja nombre/teléfono (email
// opcional) y su interés (obligatorio), igual que cualquier otro formulario público de
// captura de leads. Cada descarga crea un Lead en el backend (ver
// exportController.exportCatalogPDF), con `type` = el interés elegido. El campo se llama
// `interest` (no `type`) a propósito: `filters` (spread junto con `form` al descargar) ya
// trae su propio `type` — el tipo de propiedad (casa/depto/...) — y compartir el nombre
// pisaría uno de los dos valores. Solo PDF — la opción de Excel se quitó a pedido del dueño
// del negocio.
export default function CatalogDownloadForm({ filters }) {
  const [form, setForm] = useState(INIT);
  const [downloading, setDownloading] = useState(false);
  // null = formulario; 'downloaded' = el PDF se entregó; 'requested' = el prospecto quedó
  // registrado pero el PDF no se entregó (toggle admin desactivado, ver SettingsPage).
  const [sent, setSent] = useState(null);
  const [requestMessage, setRequestMessage] = useState(DEFAULT_REQUEST_MESSAGE);
  const formId = useId();

  // Solo para el texto del botón (ver JSDoc arriba del componente) — el envío real sigue
  // siendo autoritativo del lado del backend vía Content-Type de la respuesta, así que un
  // valor stale/no cargado todavía acá no puede exponer un PDF que el backend no vaya a
  // entregar (o viceversa). `enabled: true` por default: mismo criterio que SettingsPage.jsx,
  // preserva el comportamiento actual si la petición aún no resuelve o falla.
  const { data: statusData } = useQuery({
    queryKey: ['settings', 'inventory-download-status'],
    queryFn: getInventoryDownloadStatus,
    staleTime: 60 * 1000,
  });
  const downloadEnabled = statusData?.enabled ?? true;

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleDownload = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Nombre y teléfono son requeridos');
      return;
    }
    if (!form.interest) {
      toast.error('Selecciona tu interés');
      return;
    }
    try {
      setDownloading(true);
      const response = await requestCatalogPDF({ ...form, ...filters });
      const contentType = response.headers?.['content-type'] || '';

      if (contentType.includes('application/pdf')) {
        downloadBlob(response.data, `triomphe-catalogo-${Date.now()}.pdf`);
        setSent('downloaded');
      } else {
        // El toggle admin está desactivado: el backend igual registró el prospecto, pero
        // respondió JSON (envuelto en Blob por `responseType: 'blob''`) en vez del PDF.
        let message = DEFAULT_REQUEST_MESSAGE;
        try {
          const body = JSON.parse(await response.data.text());
          if (body?.message) message = body.message;
        } catch {
          /* respuesta no era JSON parseable — se usa el mensaje default */
        }
        setRequestMessage(message);
        setSent('requested');
      }
    } catch (e) {
      let msg = 'Error al enviar tu solicitud. Verifica tu conexión e intenta de nuevo.';
      if (e.response?.data instanceof Blob) {
        try {
          const body = JSON.parse(await e.response.data.text());
          if (body?.error) msg = body.error;
        } catch {
          /* respuesta no era JSON */
        }
      }
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent-500 dark:placeholder-gray-500';

  if (sent === 'downloaded')
    return (
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center gap-3 py-6 text-center"
      >
        <CheckCircle size={36} className="text-green-500" />
        <p className="font-semibold text-gray-800 dark:text-gray-100">¡Catálogo descargado!</p>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-2 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
        >
          <FileText size={14} /> Descargar de nuevo
        </button>
      </motion.div>
    );

  if (sent === 'requested')
    return (
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center gap-3 py-6 text-center"
      >
        <CheckCircle size={36} className="text-green-500" />
        <p className="font-semibold text-gray-800 dark:text-gray-100">¡Solicitud recibida!</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{requestMessage}</p>
      </motion.div>
    );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
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
            onChange={handleChange}
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
            Teléfono *
          </label>
          <input
            id={`${formId}-phone`}
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            placeholder="Ej: 6561234567"
            maxLength={20}
            pattern={PHONE_PATTERN}
            title={PHONE_PATTERN_TITLE}
            className={inputCls}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor={`${formId}-email`}
          className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
        >
          Email (opcional)
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
      <div>
        <label
          htmlFor={`${formId}-interest`}
          className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
        >
          Interés *
        </label>
        <select
          id={`${formId}-interest`}
          name="interest"
          value={form.interest}
          onChange={handleChange}
          className={inputCls}
        >
          <option value="" disabled>
            Selecciona una opción
          </option>
          {INTEREST_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="pt-1">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent-400 text-primary-900 rounded-xl text-sm font-medium hover:bg-accent-300 transition-colors disabled:opacity-60"
        >
          {downloading ? (
            <span className="w-4 h-4 border-2 border-primary-900/30 border-t-primary-900 rounded-full animate-spin" />
          ) : (
            <FileText size={15} />
          )}
          {downloading
            ? 'Enviando...'
            : downloadEnabled
              ? 'Descargar PDF del inventario'
              : 'Solicitar inventario'}
        </button>
      </div>
    </div>
  );
}
