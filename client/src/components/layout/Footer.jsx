import { Building2, Phone, Mail, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-blue-900 text-white mt-20">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 font-bold text-xl mb-3">
            <Building2 size={24} className="text-yellow-400" />
            <span>Triomphe <span className="text-yellow-400">Remates</span></span>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">
            Especialistas en remates bancarios en Chihuahua, Ciudad Juárez y Querétaro.
          </p>
        </div>

        <div>
          <h4 className="font-semibold text-yellow-400 mb-3">Ciudades</h4>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li>Ciudad Juárez, Chih.</li>
            <li>Chihuahua, Chih.</li>
            <li>Querétaro, Qro.</li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-yellow-400 mb-3">Contacto</h4>
          <ul className="space-y-2 text-gray-300 text-sm">
            <li className="flex items-center gap-2"><Phone size={14} /> +52 1 81 3157 1731 </li>
            <li className="flex items-center gap-2"><Mail size={14} /> info@rematesbancarios.net.com </li>
            <li className="flex items-center gap-2"><MapPin size={14} /> Chihuahua, México</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-blue-800 text-center py-4 text-gray-400 text-xs">
        © {new Date().getFullYear()} Triomphe Bienes Raíces. Todos los derechos reservados.
      </div>
    </footer>
  );
}
