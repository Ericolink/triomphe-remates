import { motion } from 'framer-motion';
import { WHATSAPP_NUMBER } from '../../utils/constants';
import { toWhatsAppLink } from '../../utils/formatters';
import { buttonHover, buttonTap } from '../../utils/animations';
import { trackEvent, ANALYTICS_EVENTS } from '../../utils/analytics';

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.532 5.85L.057 23.25l5.565-1.453A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.371l-.36-.214-3.305.863.88-3.217-.235-.371A9.818 9.818 0 1112 21.818z" />
  </svg>
);

export default function WhatsAppButton({
  title,
  priceLabel,
  url,
  message,
  label = 'Consultar por WhatsApp',
  className = '',
  floating = false,
  propertyId = null,
}) {
  const resolvedMessage =
    message ??
    (() => {
      const fullUrl = `${import.meta.env.VITE_SITE_URL || window.location.origin}${url}`;
      return `Hola, me interesa esta propiedad: ${title}${priceLabel ? ` (${priceLabel})` : ''}\n${fullUrl}`;
    })();
  const href = toWhatsAppLink(WHATSAPP_NUMBER, resolvedMessage);
  const trackClick = () => trackEvent(ANALYTICS_EVENTS.WHATSAPP_CLICK, { propertyId });

  // Variante flotante (botón circular solo-ícono, ver FloatingWhatsAppButton.jsx): usa un
  // className base completo propio en vez de intentar sobreescribir el de la píldora vía
  // concatenación — dos utilidades de Tailwind con la misma propiedad (rounded-xl vs.
  // rounded-full, px-4 py-3 vs. tamaño fijo) no tienen forma confiable de "ganarle" a la
  // otra solo por orden en el string de clases. El texto del label se conserva como
  // aria-label/title ya que no hay texto visible que lo exponga como nombre accesible.
  if (floating) {
    return <FloatingWhatsApp href={href} label={label} className={className} onClick={trackClick} />;
  }

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={trackClick}
      whileHover={buttonHover}
      whileTap={buttonTap}
      className={`flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors ${className}`}
    >
      <WhatsAppIcon /> {label}
    </motion.a>
  );
}

// Botón flotante + globo de mensaje ("¿Cómo puedo ayudarte?"), con la colita apuntando
// hacia el ícono. Separado del render principal solo para mantener legible el switch
// floating/no-floating de WhatsAppButton.
function FloatingWhatsApp({ href, label, className, onClick }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.25 }}
        className="relative whitespace-nowrap bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-100 text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-lg"
      >
        ¿Cómo puedo ayudarte?
        <span className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white dark:bg-dark-surface rotate-45" />
      </motion.a>
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        whileHover={buttonHover}
        whileTap={buttonTap}
        aria-label={label}
        title={label}
        className="flex items-center justify-center w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg transition-colors shrink-0"
      >
        <WhatsAppIcon />
      </motion.a>
    </div>
  );
}
