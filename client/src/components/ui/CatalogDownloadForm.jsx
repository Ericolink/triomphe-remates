import { useId, useState } from 'react';
import { FileSpreadsheet, FileText, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { downloadCatalogExcel, downloadCatalogPDF } from '../../services/catalogService';
import { fadeInUp } from '../../utils/animations';
import { downloadBlob } from '../../utils/download';
import { PHONE_PATTERN, PHONE_PATTERN_TITLE } from '../../utils/phone';

const INIT = { name: '', phone: '', email: '' };

// Descarga del catálogo gateada por datos de contacto — pedido del dueño del negocio: un
// visitante puede bajar el inventario en Excel/PDF, pero primero deja nombre/teléfono
// (email opcional), igual que cualquier otro formulario público de captura de leads. Cada
// descarga crea un Lead en el backend (ver exportController.exportCatalogExcel/PDF).
export default function CatalogDownloadForm({ filters }) {
  const [form, setForm] = useState(INIT);
  const [downloading, setDownloading] = useState(null); // null | 'excel' | 'pdf'
  const [sent, setSent] = useState(false);
  const formId = useId();

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleDownload = async (format) => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Nombre y teléfono son requeridos');
      return;
    }
    try {
      setDownloading(format);
      const data = { ...form, ...filters };
      const blob = format === 'excel' ? await downloadCatalogExcel(data) : await downloadCatalogPDF(data);
      downloadBlob(blob, `triomphe-catalogo-${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      setSent(true);
    } catch (e) {
      let msg = 'Error al descargar. Verifica tu conexión e intenta de nuevo.';
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
      setDownloading(null);
    }
  };

  const inputCls =
    'w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent-500 dark:placeholder-gray-500';

  if (sent)
    return (
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center gap-3 py-6 text-center"
      >
        <CheckCircle size={36} className="text-green-500" />
        <p className="font-semibold text-gray-800 dark:text-gray-100">¡Catálogo descargado!</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          ¿Quieres descargarlo en el otro formato?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleDownload('excel')}
            disabled={downloading === 'excel'}
            className="flex items-center gap-1.5 px-3 py-2 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-xl text-xs font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button
            type="button"
            onClick={() => handleDownload('pdf')}
            disabled={downloading === 'pdf'}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            <FileText size={14} /> PDF
          </button>
        </div>
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
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => handleDownload('excel')}
          disabled={downloading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent-400 text-primary-900 rounded-xl text-sm font-medium hover:bg-accent-300 transition-colors disabled:opacity-60"
        >
          {downloading === 'excel' ? (
            <span className="w-4 h-4 border-2 border-primary-900/30 border-t-primary-900 rounded-full animate-spin" />
          ) : (
            <FileSpreadsheet size={15} />
          )}
          {downloading === 'excel' ? 'Generando...' : 'Descargar Excel'}
        </button>
        <button
          type="button"
          onClick={() => handleDownload('pdf')}
          disabled={downloading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-accent-400 text-primary-900 rounded-xl text-sm font-medium hover:bg-accent-300 transition-colors disabled:opacity-60"
        >
          {downloading === 'pdf' ? (
            <span className="w-4 h-4 border-2 border-primary-900/30 border-t-primary-900 rounded-full animate-spin" />
          ) : (
            <FileText size={15} />
          )}
          {downloading === 'pdf' ? 'Generando...' : 'Descargar PDF'}
        </button>
      </div>
    </div>
  );
}
