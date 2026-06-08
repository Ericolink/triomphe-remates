import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadPropertyQuotePDF } from '../../services/propertyService';
import { buttonHover, buttonTap } from '../../utils/animations';

export default function DownloadQuoteButton({ propertyId, slug, className = '' }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      await downloadPropertyQuotePDF(propertyId, `ficha-${slug || propertyId}.pdf`);
    } catch {
      toast.error('Error al generar la ficha en PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.button
      onClick={handleDownload} disabled={loading}
      whileHover={buttonHover} whileTap={buttonTap}
      className={`flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 dark:border-[#2e3650] hover:bg-gray-50 dark:hover:bg-[#242938] text-gray-700 dark:text-gray-200 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${className}`}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
      {loading ? 'Generando ficha…' : 'Descargar ficha en PDF'}
    </motion.button>
  );
}
