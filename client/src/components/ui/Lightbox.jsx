import { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { buildImageUrl } from '../../utils/images';
import useModalA11y from '../../hooks/useModalA11y';

export default function Lightbox({ images, currentIndex, onClose, onPrev, onNext }) {
  const isOpen = Boolean(images[currentIndex]);
  const panelRef = useModalA11y(isOpen, onClose);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onPrev, onNext]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Galería de imágenes"
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Cerrar galería"
        className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10"
      >
        <X size={20} />
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
        {currentIndex + 1} / {images.length}
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            aria-label="Imagen anterior"
            className="absolute left-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            aria-label="Imagen siguiente"
            className="absolute right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      <img
        src={buildImageUrl(images[currentIndex].url, 1600)}
        alt={`Imagen ${currentIndex + 1}`}
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <div className="absolute bottom-4 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
              }}
              className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
