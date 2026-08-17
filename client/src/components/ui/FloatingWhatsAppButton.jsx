import { useLocation } from 'react-router-dom';
import WhatsAppButton from './WhatsAppButton';
import useComparator from '../../hooks/useComparator';

// CTA de contacto persistente para todas las páginas públicas (ver auditoría móvil
// 2026-08-17, hallazgo "sin CTA de contacto persistente"). Delega el href/mensaje de
// WhatsApp por completo a WhatsAppButton (floating=true) en vez de reimplementar el
// enlace — este componente solo resuelve DÓNDE y CUÁNDO se posiciona en pantalla.
//
// Cuando ComparatorBar está visible (count > 0) ambos son `fixed bottom-*` centrados/
// alineados a la derecha respectivamente; sin coordinar la posición podrían solaparse
// en pantallas angostas donde la píldora del comparador se extiende casi de borde a
// borde. Se soluciona subiendo este botón por encima de esa barra mientras esté activa,
// en vez de fijar un offset a ciegas.
export default function FloatingWhatsAppButton() {
  const { pathname } = useLocation();
  const { count: compareCount } = useComparator();

  // En /admin/* no hay WhatsAppButton flotante — solo se monta desde PublicLayout, pero
  // se deja explícito por si alguna vez se reutiliza este componente en otro layout.
  if (pathname.startsWith('/admin')) return null;

  // 6.5rem ≈ altura de ComparatorBar (~4rem) + su propio offset (1.5rem) + ~1rem de aire.
  const bottomOffset = compareCount > 0 ? 'bottom-[calc(6.5rem_+_env(safe-area-inset-bottom))]' : 'bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))]';

  return (
    <WhatsAppButton
      floating
      message="Hola, me gustaría más información sobre las propiedades de Triomphe."
      label="Contáctanos por WhatsApp"
      className={`fixed right-4 sm:right-6 ${bottomOffset} z-30 transition-[bottom]`}
    />
  );
}
