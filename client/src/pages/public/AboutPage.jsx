import { Shield, Users, Building2, TrendingDown, Award, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import SEO from '../../components/ui/SEO';
import AnimatedSection from '../../components/ui/AnimatedSection';
import { fadeInUp, fadeInLeft, fadeInRight, staggerContainer } from '../../utils/animations';

export default function AboutPage() {
  return (
    <div>
      <SEO title="Sobre Nosotros" description="Conoce a Triomphe Bienes Raíces." url="/nosotros" />

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-900 to-blue-700 dark:from-[#0f1621] dark:to-[#1a1f2e] text-white py-20">
        <motion.div
          className="max-w-7xl mx-auto px-4 text-center"
          variants={staggerContainer} initial="hidden" animate="visible"
        >
          <motion.img variants={fadeInUp} src="/logo.png" alt="Triomphe Bienes Raíces"
            className="h-20 w-auto mx-auto mb-6 brightness-0 invert" />
          <motion.h1 variants={fadeInUp} className="text-4xl md:text-5xl font-bold mb-4">
            Sobre Nosotros
          </motion.h1>
          <motion.p variants={fadeInUp} className="text-blue-200 dark:text-gray-400 text-lg max-w-2xl mx-auto">
            Más de 10 años conectando personas con las mejores oportunidades inmobiliarias del norte de México.
          </motion.p>
        </motion.div>
      </section>

      {/* Misión */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <AnimatedSection variant={fadeInLeft}>
            <h2 className="text-3xl font-bold text-blue-900 dark:text-white mb-6">¿Quiénes somos?</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Triomphe Bienes Raíces es una empresa especializada en la comercialización de remates
              bancarios en México. Nos dedicamos a facilitar el acceso a propiedades por debajo de
              su valor comercial, brindando asesoría profesional en todo el proceso de adquisición.
            </p>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Contamos con un equipo de asesores expertos en el mercado inmobiliario de Chihuahua,
              Ciudad Juárez y Querétaro, ciudades donde operamos activamente con un amplio inventario.
            </p>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Nuestra misión es hacer que la inversión inmobiliaria sea accesible para todos,
              acompañando a nuestros clientes desde la búsqueda hasta la firma ante notario.
            </p>
          </AnimatedSection>

          <motion.div
            className="grid grid-cols-2 gap-4"
            variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}
          >
            {[
              { icon: <Building2 size={28} className="text-yellow-500" />, value: '146+', label: 'Propiedades en inventario' },
              { icon: <Users size={28} className="text-yellow-500" />, value: '500+', label: 'Clientes satisfechos' },
              { icon: <Award size={28} className="text-yellow-500" />, value: '10+', label: 'Años de experiencia' },
              { icon: <MapPin size={28} className="text-yellow-500" />, value: '3', label: 'Ciudades de operación' },
            ].map(({ icon, value, label }) => (
              <motion.div key={label} variants={fadeInUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-gray-50 dark:bg-[#242938] border border-transparent dark:border-[#2e3650] rounded-2xl p-6 text-center cursor-default">
                <motion.div className="flex justify-center mb-3"
                  whileHover={{ scale: 1.2, rotate: 5 }} transition={{ duration: 0.2 }}>
                  {icon}
                </motion.div>
                <p className="text-3xl font-bold text-blue-900 dark:text-white">{value}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Valores */}
      <section className="bg-gray-50 dark:bg-[#242938] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-blue-900 dark:text-white text-center mb-12">Nuestros valores</h2>
          </AnimatedSection>
          <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {[
              { icon: <Shield size={32} className="text-yellow-500" />, title: 'Transparencia', desc: 'Informamos a nuestros clientes sobre cada detalle del proceso de remate, sin letra chica ni sorpresas.' },
              { icon: <Users size={32} className="text-yellow-500" />, title: 'Compromiso', desc: 'Acompañamos a cada cliente durante todo el proceso, desde la búsqueda hasta la escrituración.' },
              { icon: <TrendingDown size={32} className="text-yellow-500" />, title: 'Mejores precios', desc: 'Accede a propiedades hasta un 40% por debajo del valor comercial. Tu inversión rinde más con nosotros.' },
            ].map(({ icon, title, desc }) => (
              <motion.div key={title} variants={fadeInUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="bg-white dark:bg-[#1a1f2e] rounded-2xl p-8 shadow-md dark:shadow-none border border-transparent dark:border-[#2e3650] text-center cursor-default">
                <motion.div className="flex justify-center mb-4"
                  whileHover={{ scale: 1.15, rotate: 5 }} transition={{ duration: 0.2 }}>
                  {icon}
                </motion.div>
                <h3 className="text-xl font-bold text-blue-900 dark:text-white mb-3">{title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Ciudades */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <AnimatedSection>
          <h2 className="text-3xl font-bold text-blue-900 dark:text-white text-center mb-12">Dónde operamos</h2>
        </AnimatedSection>
        <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-6"
          variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          {[
            { city: 'Ciudad Juárez', state: 'Chihuahua', properties: '71+', desc: 'La ciudad fronteriza más grande del norte con el mayor inventario de remates bancarios.' },
            { city: 'Chihuahua', state: 'Chihuahua', properties: '65+', desc: 'Capital del estado con amplia oferta de casas y departamentos en remate a excelentes precios.' },
            { city: 'Querétaro', state: 'Querétaro', properties: '10+', desc: 'Una de las ciudades con mayor crecimiento económico del país y oportunidades de inversión.' },
          ].map(({ city, state, properties, desc }) => (
            <motion.div key={city} variants={fadeInUp}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-6 cursor-default">
              <div className="flex items-center gap-3 mb-3">
                <motion.div whileHover={{ scale: 1.2 }} transition={{ duration: 0.2 }}>
                  <MapPin size={20} className="text-yellow-500 flex-shrink-0" />
                </motion.div>
                <div>
                  <p className="font-bold text-blue-900 dark:text-white">{city}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{state}</p>
                </div>
                <span className="ml-auto bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 text-xs font-bold px-2.5 py-1 rounded-full">{properties}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
