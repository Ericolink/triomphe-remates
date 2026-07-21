import { useEffect, useRef } from 'react';

// Equivalente a useModalA11y pero para popovers/menús no-modales (OverflowMenu,
// ShareButton, NotificationBell): cierre con click-fuera + Escape, foco de vuelta al
// trigger. A diferencia de useModalA11y, deliberadamente no hace focus trap de
// Tab/Shift+Tab ni fuerza role="dialog" — un menú no-modal no debe atrapar el foco.
export default function usePopoverA11y(open, onClose) {
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onCloseRef.current?.();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current?.();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return { panelRef, triggerRef };
}
