import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Hook de accesibilidad reutilizable para modales/diálogos: cierra con Escape, atrapa el
// foco con Tab/Shift+Tab dentro del panel, y devuelve el foco al elemento que abrió el
// diálogo al cerrarse. No renderiza nada — solo agrega comportamiento de teclado.
// Devuelve un ref que debe asignarse al panel del diálogo (el contenedor con el contenido,
// no el overlay de fondo).
export default function useModalA11y(isOpen, onClose) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);
  // El efecto principal (abajo) solo depende de `isOpen`, no de `onClose` — así no se
  // reinicia (perdiendo la captura de foco a restaurar) solo porque el caller pasó un
  // onClose inline (ej. `() => setX(null)`, que crea una función nueva en cada render).
  // Este ref guarda siempre la versión más reciente para que el listener de Escape la use.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocused.current = document.activeElement;

    // Si nada dentro del panel ya tiene el foco (ej. un input con autoFocus), el panel
    // mismo lo recibe para que los lectores de pantalla anuncien el diálogo al abrirse.
    const focusTimer = setTimeout(() => {
      if (panelRef.current && !panelRef.current.contains(document.activeElement)) {
        panelRef.current.focus();
      }
    }, 0);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  return panelRef;
}
