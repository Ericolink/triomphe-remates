import { Shield, Users, Building2, TrendingDown, Award, MapPin } from 'lucide-react';
import SEO from '../../components/ui/SEO';

export default function AboutPage() {
  return (
    <div>
      <SEO
        title="Sobre Nosotros"
        description="Conoce a Triomphe Bienes Raíces, especialistas en remates bancarios en Chihuahua, Ciudad Juárez y Querétaro con más de 10 años de experiencia."
        url="/nosotros"
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-900 to-blue-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <img src="/logo.png" alt="Triomphe Bienes Raíces" className="h-20 w-auto mx-auto mb-6 brightness-0 invert" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Sobre Nosotros</h1>
          <p className="text-blue-200 text-lg max-w-2xl mx-auto">
            Más de 10 años conectando personas con las mejores oportunidades inmobiliarias del norte de México.
          </p>
        </div>
      </section>

      {/* Misión */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-blue-900 mb-6">¿Quiénes somos?</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Triomphe Bienes Raíces es una empresa especializada en la comercialización de remates
              bancarios en México. Nos dedicamos a facilitar el acceso a propiedades por debajo de
              su valor comercial, brindando asesoría profesional en todo el proceso de adquisición.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Contamos con un equipo de asesores expertos en el mercado inmobiliario de Chihuahua,
              Ciudad Juárez y Querétaro, ciudades donde operamos activamente con un amplio inventario
              de propiedades disponibles.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Nuestra misión es hacer que la inversión inmobiliaria sea accesible para todos,
              acompañando a nuestros clientes desde la búsqueda de la propiedad hasta la firma
              ante notario.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: <Building2 size={28} className="text-yellow-500" />, value: '146+', label: 'Propiedades en inventario' },
              { icon: <Users size={28} className="text-yellow-500" />, value: '500+', label: 'Clientes satisfechos' },
              { icon: <Award size={28} className="text-yellow-500" />, value: '10+', label: 'Años de experiencia' },
              { icon: <MapPin size={28} className="text-yellow-500" />, value: '3', label: 'Ciudades de operación' },
            ].map(({ icon, value, label }) => (
              <div key={label} className="bg-gray-50 rounded-2xl p-6 text-center">
                <div className="flex justify-center mb-3">{icon}</div>
                <p className="text-3xl font-bold text-blue-900">{value}</p>
                <p className="text-sm text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-blue-900 text-center mb-12">Nuestros valores</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Shield size={32} className="text-yellow-500" />,
                title: 'Transparencia',
                desc: 'Informamos a nuestros clientes sobre cada detalle del proceso de remate, sin letra chica ni sorpresas.',
              },
              {
                icon: <Users size={32} className="text-yellow-500" />,
                title: 'Compromiso',
                desc: 'Acompañamos a cada cliente durante todo el proceso, desde la búsqueda hasta la escrituración.',
              },
              {
                icon: <TrendingDown size={32} className="text-yellow-500" />,
                title: 'Mejores precios',
                desc: 'Accede a propiedades hasta un 40% por debajo del valor comercial. Tu inversión rinde más con nosotros.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-8 shadow-md text-center">
                <div className="flex justify-center mb-4">{icon}</div>
                <h3 className="text-xl font-bold text-blue-900 mb-3">{title}</h3>
                <p className="text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ciudades */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-blue-900 text-center mb-12">Dónde operamos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { city: 'Ciudad Juárez', state: 'Chihuahua', properties: '71+', desc: 'La ciudad fronteriza más grande del norte con el mayor inventario de remates bancarios.' },
            { city: 'Chihuahua', state: 'Chihuahua', properties: '65+', desc: 'Capital del estado con amplia oferta de casas y departamentos en remate a excelentes precios.' },
            { city: 'Querétaro', state: 'Querétaro', properties: '10+', desc: 'Una de las ciudades con mayor crecimiento económico del país y oportunidades de inversión.' },
          ].map(({ city, state, properties, desc }) => (
            <div key={city} className="border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <MapPin size={20} className="text-yellow-500 flex-shrink-0" />
                <div>
                  <p className="font-bold text-blue-900">{city}</p>
                  <p className="text-xs text-gray-400">{state}</p>
                </div>
                <span className="ml-auto bg-blue-50 text-blue-900 text-xs font-bold px-2.5 py-1 rounded-full">{properties}</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
