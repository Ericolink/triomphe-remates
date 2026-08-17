import { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { trackShare } from '../../services/propertyService';
import usePopoverA11y from '../../hooks/usePopoverA11y';

const FacebookIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-4 h-4"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-4 h-4"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.532 5.85L.057 23.25l5.565-1.453A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.371l-.36-.214-3.305.863.88-3.217-.235-.371A9.818 9.818 0 1112 21.818z" />
  </svg>
);

export default function ShareButton({ title, subtitle, url, propertyId }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { panelRef, triggerRef } = usePopoverA11y(open, () => setOpen(false));

  const fullUrl = `${import.meta.env.VITE_SITE_URL || window.location.origin}${url}`;
  const shareText = subtitle ? `${title} — ${subtitle}` : title;

  const notifyShare = () => {
    if (propertyId) trackShare(propertyId).catch(() => {});
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    notifyShare();
    setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 2000);
  };

  const shareOptions = [
    {
      label: 'WhatsApp',
      icon: <WhatsAppIcon />,
      color: 'hover:bg-green-50 hover:text-green-600',
      action: () => {
        notifyShare();
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${fullUrl}`)}`,
          '_blank'
        );
      },
    },
    {
      label: 'Facebook',
      icon: <FacebookIcon />,
      color: 'hover:bg-blue-50 hover:text-blue-600',
      action: () => {
        notifyShare();
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`,
          '_blank'
        );
      },
    },
    {
      label: copied ? '¡Copiado!' : 'Copiar enlace',
      icon: copied ? <Check size={16} /> : <Copy size={16} />,
      color: copied ? 'text-green-600' : 'hover:bg-gray-50 hover:text-gray-700',
      action: copyLink,
    },
  ];

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Compartir"
        className="flex items-center justify-center gap-2 w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2 bg-white border border-gray-200 rounded-full sm:rounded-xl text-sm text-gray-600 hover:bg-primary-900 hover:text-white hover:border-primary-900 transition-colors"
      >
        <Share2 size={16} aria-hidden="true" /> <span className="hidden sm:inline">Compartir</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Compartir"
          className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden"
        >
          {shareOptions.map(({ label, icon, color, action }) => (
            <button
              key={label}
              role="menuitem"
              onClick={action}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 transition-colors ${color}`}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
