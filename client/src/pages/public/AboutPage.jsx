import { Shield, Users, Building2, TrendingDown, Award, MapPin, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import SEO from '../../components/ui/SEO';
import AnimatedSection from '../../components/ui/AnimatedSection';
import { fadeInUp, fadeInLeft, fadeInRight, staggerContainer } from '../../utils/animations';

const processSteps = [
  {
    step: 1,
    icon: '🤝',
    title: 'Primera información',
    desc: 'El asesor contacta al cliente, explica qué es un remate bancario, sus ventajas, riesgos y el proceso. Se agenda una cita y se informan los requisitos: INE y monto requerido.',
  },
  {
    step: 2,
    icon: '📅',
    title: 'Agendar una cita',
    desc: 'Se coordina la primera reunión con el cliente interesado para presentar la propiedad con plano catastral y adeudos.',
  },
  {
    step: 3,
    icon: 'ℹ️',
    title: 'Información de la propiedad',
    desc: 'Se proporciona al cliente toda la información necesaria: dictamen legal, plano catastral, adeudos de agua y predial, y cualquier detalle monetario relevante.',
  },
  {
    step: 4,
    icon: '🔍',
    title: 'Verificación legal',
    desc: 'Se revisa la disponibilidad y viabilidad legal de la propiedad. Se confirman resultados positivos antes de continuar.',
  },
  {
    step: 5,
    icon: '🏷️',
    title: 'Apartado de la propiedad',
    desc: 'El cliente realiza el apartado de la propiedad con el monto requerido, asegurando su reserva en el inventario.',
  },
  {
    step: 6,
    icon: '📄',
    title: 'Firma de contrato',
    desc: 'Se formaliza la operación mediante la firma de los contratos correspondientes con todos los detalles acordados.',
  },
  {
    step: 7,
    icon: '💰',
    title: 'Pago del remate',
    desc: 'El cliente realiza el pago o transferencia a la institución financiera (banco) correspondiente y a Triomphe.',
  },
  {
    step: 8,
    icon: '✍️',
    title: 'Firma de cesión de derechos',
    desc: 'El cliente firma su cesión de derechos ante notario público. Documento inscrito en el Registro Público de la Propiedad.',
  },
  {
    step: 9,
    icon: '⚖️',
    title: 'Periodo legal',
    desc: 'Se gestiona el seguimiento de las etapas legales. El asesor mantiene comunicación mensual con el cliente vía WhatsApp.',
  },
  {
    step: 10,
    icon: '📝',
    title: 'Escrituración',
    desc: 'Se completan todos los trámites notariales y legales necesarios para la escrituración de la propiedad.',
  },
  {
    step: 11,
    icon: '🏠',
    title: 'Entrega de propiedad',
    desc: 'El cliente recibe su propiedad. Culminación exitosa del proceso de adquisición del remate bancario.',
  },
];

const values = [
  'Trabajo en equipo',
  'Respeto',
  'Innovación',
  'Orientación al cliente',
  'Motivación',
  'Principios',
  'Honradez',
  'Entusiasmo',
];

export default function AboutPage() {
  return (
    <div>
      <SEO
        title="Sobre Nosotros"
        description="Triomphe Bienes Raíces, con más de 27 años de experiencia en remates bancarios. Fundado por el Lic. Rubén Ávila, especialistas en cesión de derechos en Chihuahua, Ciudad Juárez y Querétaro."
        url="/nosotros"
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-900 to-blue-700 dark:from-[#0f1621] dark:to-[#1a1f2e] text-white py-20">
        <motion.div className="max-w-7xl mx-auto px-4 text-center"
          variants={staggerContainer} initial="hidden" animate="visible">
          <motion.img variants={fadeInUp} src="/logo.png" alt="Triomphe Bienes Raíces"
            className="h-20 w-auto mx-auto mb-6 brightness-0 invert" />
          <motion.h1 variants={fadeInUp} className="text-4xl md:text-5xl font-bold mb-4">
            Sobre Nosotros
          </motion.h1>
          <motion.p variants={fadeInUp} className="text-blue-200 dark:text-gray-400 text-lg max-w-2xl mx-auto">
            Más de 27 años conectando inversionistas con las mejores oportunidades de remates bancarios en México.
          </motion.p>
        </motion.div>
      </section>

      {/* Quiénes somos */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <AnimatedSection variant={fadeInLeft}>
            <h2 className="text-3xl font-bold text-blue-900 dark:text-white mb-6">¿Quiénes somos?</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Triomphe Bienes Raíces es un despacho administrador de cartera vencida fundado por el
              <strong className="text-blue-900 dark:text-white"> Lic. Rubén Ávila</strong>, dedicado a la venta
              de remates bancarios mediante la cesión de derechos litigiosos, adjudicatarios o de escritura.
            </p>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              Con más de <strong className="text-blue-900 dark:text-white">27 años de experiencia</strong>, nuestro
              equipo ofrece a sus inversionistas importantes ahorros y utilidades, con garantías hipotecarias
              respaldadas por gravámenes en el Registro Público de la Propiedad.
            </p>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Operamos activamente en Chihuahua, Ciudad Juárez y Querétaro, con un amplio inventario de
              propiedades disponibles a precios por debajo del valor comercial.
            </p>
          </AnimatedSection>

          <motion.div className="grid grid-cols-2 gap-4"
            variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {[
              { icon: <Building2 size={28} className="text-yellow-500" />, value: '146+', label: 'Propiedades en inventario' },
              { icon: <Users size={28} className="text-yellow-500" />, value: '500+', label: 'Clientes satisfechos' },
              { icon: <Award size={28} className="text-yellow-500" />, value: '27+', label: 'Años de experiencia' },
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

      {/* Qué vendemos */}
      <section className="bg-gray-50 dark:bg-[#242938] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-blue-900 dark:text-white text-center mb-4">¿Qué vendemos?</h2>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-3xl mx-auto mb-12">
              Vendemos <strong className="text-blue-900 dark:text-white">cesiones de derechos</strong> — documentos
              notariales inscritos en el Registro Público de la Propiedad (RPP) que otorgan los derechos
              crediticios litigiosos y/o adjudicatarios de un inmueble, respaldados por gravámenes a favor
              de bancos o instituciones financieras.
            </p>
          </AnimatedSection>

          <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {[
              {
                icon: <TrendingDown size={32} className="text-yellow-500" />,
                title: 'Precios de Remate',
                desc: 'Propiedades hasta un 40% más baratas que el valor comercial. La mejor inversión del mercado con garantías hipotecarias.',
              },
              {
                icon: <Shield size={32} className="text-yellow-500" />,
                title: 'Proceso Seguro',
                desc: 'Cesiones de derechos inscritas en el RPP, respaldadas por instituciones financieras. Acompañamiento en todo el proceso legal y notarial.',
              },
              {
                icon: <Users size={32} className="text-yellow-500" />,
                title: 'Asesoría Personalizada',
                desc: 'Nuestros coordinadores y asesores te guían en cada etapa, desde el primer contacto hasta la entrega de tu propiedad.',
              },
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

      {/* Misión y Visión */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <AnimatedSection>
          <h2 className="text-3xl font-bold text-blue-900 dark:text-white text-center mb-12">Misión y Visión</h2>
        </AnimatedSection>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <AnimatedSection variant={fadeInLeft}>
            <div className="bg-blue-900 dark:bg-[#0f1621] text-white rounded-2xl p-8 h-full">
              <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center mb-4">
                <Shield size={24} className="text-blue-900" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Misión</h3>
              <p className="text-blue-100 leading-relaxed">
                Proporcionar una asesoría inmobiliaria con ética, honestidad y discreción, siempre
                orientados al servicio en todas las etapas de nuestra intervención en la venta, compra
                o alquiler, basados en nuestra experiencia y capacitación en el ramo.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection variant={fadeInRight}>
            <div className="bg-yellow-400 dark:bg-yellow-500 rounded-2xl p-8 h-full">
              <div className="w-12 h-12 bg-blue-900 rounded-xl flex items-center justify-center mb-4">
                <Award size={24} className="text-yellow-400" />
              </div>
              <h3 className="text-2xl font-bold text-blue-900 mb-4">Visión</h3>
              <p className="text-blue-900 leading-relaxed">
                Ser la mejor alternativa para quienes busquen la ayuda de un profesional inmobiliario,
                ofreciendo las propuestas más innovadoras. Que nuestros clientes se sientan plenamente
                acompañados y asesorados durante todo el proceso de compra, para mejorar su calidad de vida.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Valores */}
      <section className="bg-gray-50 dark:bg-[#242938] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-blue-900 dark:text-white text-center mb-12">Nuestros Valores</h2>
          </AnimatedSection>
          <motion.div className="grid grid-cols-2 sm:grid-cols-4 gap-4"
            variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {values.map((value) => (
              <motion.div key={value} variants={fadeInUp}
                whileHover={{ y: -4, scale: 1.03, transition: { duration: 0.2 } }}
                className="bg-white dark:bg-[#1a1f2e] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-5 flex items-center gap-3 cursor-default">
                <CheckCircle size={20} className="text-yellow-500 flex-shrink-0" />
                <span className="font-medium text-blue-900 dark:text-white text-sm">{value}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Proceso */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <AnimatedSection>
          <h2 className="text-3xl font-bold text-blue-900 dark:text-white text-center mb-4">
            Proceso de adquisición
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-2xl mx-auto mb-0">
            Desde el primer contacto hasta la entrega de tu propiedad, te acompañamos en cada etapa.
          </p>
        </AnimatedSection>

        <div className="relative">
          {/* Línea vertical */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-900 via-yellow-400 to-blue-900 dark:from-blue-500 dark:via-yellow-400 dark:to-blue-500 hidden md:block" />

          <motion.div className="space-y-6"
            variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}>
            {processSteps.map(({ step, icon, title, desc }) => (
              <motion.div key={step} variants={fadeInUp}
                className="flex gap-6 items-start">
                {/* Número */}
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="flex-shrink-0 w-12 h-12 bg-blue-900 dark:bg-blue-700 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg z-10">
                  {step}
                </motion.div>

                {/* Contenido */}
                <motion.div
                  whileHover={{ x: 4, transition: { duration: 0.2 } }}
                  className="flex-1 bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{icon}</span>
                    <h3 className="font-bold text-blue-900 dark:text-white">{title}</h3>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{desc}</p>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Ciudades */}
      <section className="bg-gray-50 dark:bg-[#242938] py-16">
        <div className="max-w-7xl mx-auto px-4">
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
                className="bg-white dark:bg-[#1a1f2e] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-6 cursor-default">
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
        </div>
      </section>
    </div>
  );
}
