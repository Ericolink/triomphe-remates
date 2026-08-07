import { Phone, Mail, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WHATSAPP_NUMBER, OFFICES } from '../../utils/constants';
import { toWhatsAppLink } from '../../utils/formatters';

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.532 5.85L.057 23.25l5.565-1.453A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.371l-.36-.214-3.305.863.88-3.217-.235-.371A9.818 9.818 0 1112 21.818z" />
  </svg>
);

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const socialLinks = [
    {
      icon: <FacebookIcon />,
      href: 'https://www.facebook.com/TriomphePagOficial',
      label: 'Facebook',
    },
    { icon: <InstagramIcon />, href: 'https://www.instagram.com/triomphejrz', label: 'Instagram' },
    { icon: <WhatsAppIcon />, href: toWhatsAppLink(WHATSAPP_NUMBER), label: 'WhatsApp' },
  ];

  return (
    <footer className="bg-primary-900 text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <img
            src="/logo.png"
            alt="Triomphe Bienes Raíces"
            loading="lazy"
            decoding="async"
            className="h-12 w-auto mb-4 brightness-0 invert"
          />
          <p className="text-gray-300 text-sm leading-relaxed">
            Especialistas en remates bancarios (cesión de derechos) a nivel nacional.
          </p>
          <div className="flex gap-3 mt-4">
            {socialLinks.map(({ icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-primary-800 hover:bg-accent-400 hover:text-primary-900 rounded-lg flex items-center justify-center transition-colors"
                aria-label={label}
              >
                {icon}
              </a>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-accent-400 mb-4">Navegación</h4>
          <ul className="space-y-2 text-gray-300 text-sm">
            {[
              { to: '/', label: 'Inicio' },
              { to: '/propiedades', label: 'Propiedades' },
              { to: '/nosotros', label: 'Sobre Nosotros' },
              { to: '/contacto', label: 'Contacto' },
              { to: '/preguntas-frecuentes', label: 'Preguntas Frecuentes' },
              { to: '/buzon', label: 'Buzón de opiniones' },
            ].map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className="hover:text-accent-400 transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {OFFICES.map(({ city, cityLabel, phone, email, street, location, mapsUrl }) => (
          <div key={city}>
            <h4 className="flex items-center gap-2 font-semibold text-accent-400 mb-4">
              <MapPin size={16} className="flex-shrink-0" />
              {cityLabel}
            </h4>
            <ul className="space-y-3 text-gray-300 text-sm">
              <li className="flex items-center gap-2">
                <Phone size={14} className="flex-shrink-0" />
                <span>{phone}</span>
              </li>
              <li className="flex items-center gap-2 min-w-0">
                <Mail size={14} className="flex-shrink-0" />
                {email.includes('@') ? (
                  <a
                    href={`mailto:${email}`}
                    className="hover:text-accent-400 transition-colors break-words"
                  >
                    {email}
                  </a>
                ) : (
                  <span>{email}</span>
                )}
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={14} className="flex-shrink-0 mt-0.5" />
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent-400 transition-colors"
                  >
                    {street}, {location}
                  </a>
                ) : (
                  <span>
                    {street}, {location}
                  </span>
                )}
              </li>
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-primary-800 py-4 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <p>© {currentYear} Triomphe Bienes Raíces. Todos los derechos reservados.</p>
          <p>
            Desarrollado por{' '}
            <a
              href="https://github.com/ericolink"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-400 hover:text-accent-300 transition-colors font-medium"
            >
              Ericolink
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
