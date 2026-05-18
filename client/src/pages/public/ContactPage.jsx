import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import ContactForm from '../../components/ui/ContactForm';
import SEO from '../../components/ui/SEO';

export default function ContactPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <SEO
        title="Contacto"
        description="Contáctanos para más información sobre nuestros remates bancarios. Asesores disponibles en Chihuahua, Ciudad Juárez y Querétaro."
        url="/contacto"
      />
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-blue-900 mb-3">Contáctanos</h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Nuestros asesores están listos para ayudarte a encontrar la mejor propiedad.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <h2 className="text-xl font-bold text-blue-900 mb-6">Envíanos un mensaje</h2>
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-md">
            <ContactForm />
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-blue-900">Información de contacto</h2>
          {[
            { icon: <Phone size={20} className="text-yellow-500" />, title: 'Teléfono', lines: ['+52 (614) 000-0000', '+52 (656) 000-0000'] },
            { icon: <Mail size={20} className="text-yellow-500" />, title: 'Email', lines: ['contacto@triomphe.com', 'ventas@triomphe.com'] },
            { icon: <MapPin size={20} className="text-yellow-500" />, title: 'Ciudades', lines: ['Cd. Juárez, Chihuahua', 'Chihuahua, Chih.', 'Querétaro, Qro.'] },
            { icon: <Clock size={20} className="text-yellow-500" />, title: 'Horario', lines: ['Lun - Vie: 9:00 - 18:00', 'Sáb: 9:00 - 14:00'] },
          ].map(({ icon, title, lines }) => (
            <div key={title} className="flex gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center">{icon}</div>
              <div>
                <p className="font-semibold text-blue-900 text-sm">{title}</p>
                {lines.map((l) => <p key={l} className="text-gray-500 text-sm">{l}</p>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
