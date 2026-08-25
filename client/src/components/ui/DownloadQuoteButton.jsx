import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FileDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import FichaTecnica from './FichaTecnica';
import { downloadBlob } from '../../utils/download';
import { buttonHover, buttonTap } from '../../utils/animations';

// Espera a que las imágenes dentro de la ficha oculta (foto de portada + logo) terminen de
// cargar antes de rasterizarla — sin esto, html2canvas puede capturar el nodo a medio cargar
// si el usuario hace clic apenas entra a la página.
const waitForImages = (container) => {
  const images = Array.from(container.querySelectorAll('img'));
  return Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    })
  );
};

export default function DownloadQuoteButton({ property, className = '' }) {
  const [loading, setLoading] = useState(false);
  const fichaRef = useRef(null);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const node = fichaRef.current;
      await waitForImages(node);
      const canvas = await html2canvas(node, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#ffffff',
      });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      downloadBlob(blob, `ficha-${property.slug || property.id}.png`);
    } catch {
      toast.error('Error al generar la ficha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.button
        onClick={handleDownload}
        disabled={loading}
        whileHover={buttonHover}
        whileTap={buttonTap}
        className={`flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 dark:border-[#2e3650] hover:bg-gray-50 dark:hover:bg-[#242938] text-gray-700 dark:text-gray-200 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${className}`}
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
        {loading ? 'Generando ficha…' : 'Descargar ficha en PNG'}
      </motion.button>

      {/* Fuera de pantalla (no display:none) para que html2canvas pueda rasterizarla. */}
      <div style={{ position: 'fixed', top: 0, left: -10000, zIndex: -1 }} aria-hidden="true">
        <FichaTecnica ref={fichaRef} property={property} />
      </div>
    </>
  );
}
