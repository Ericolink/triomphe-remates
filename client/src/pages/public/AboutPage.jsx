import {
  Shield,
  Users,
  TrendingDown,
  Award,
  MapPin,
  CheckCircle,
  Home,
  Landmark,
  Scale,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import SEO from '../../components/ui/SEO';
import AnimatedSection from '../../components/ui/AnimatedSection';
import { fadeInUp, fadeInLeft, fadeInRight, staggerContainer } from '../../utils/animations';
import { getPropertyStats } from '../../services/propertyService';

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

const services = [
  {
    icon: Home,
    title: 'Corretaje, compra y venta de propiedades',
    desc: 'Asesoramos y facilitamos todo el proceso de compra o venta de inmuebles, garantizando transacciones seguras y beneficiosas.',
  },
  {
    icon: Landmark,
    title: 'Intermediación en la compra de cesiones de derechos',
    desc: 'Contamos con una amplia cartera de propiedades provenientes de instituciones financieras a nivel nacional, ideales para inversión o vivienda mediante remates bancarios.',
  },
  {
    icon: Scale,
    title: 'Te asesoramos',
    desc: 'Todos nuestros trámites son realizados ante notario público. Contamos con personal altamente capacitado en áreas legal, fiscal, contable y comercial.',
    advisories: [
      {
        title: 'Resolución de crédito hipotecario',
        detail: 'Cancelación, traspaso o reestructura.',
      },
      {
        title: 'Asesoría legal',
        detail:
          'Servicios legales especializados para proteger los intereses del cliente y resolver conflictos inmobiliarios.',
      },
      {
        title: 'Trámites notariales',
        detail:
          'Trabajo con diversas notarías a nivel nacional para brindar asesoramiento especializado según cada caso.',
      },
    ],
  },
];

const advantages = [
  {
    icon: <TrendingDown size={32} className="text-accent-500" />,
    title: 'Precios de Remate',
    desc: 'Propiedades con precios por debajo del valor comercial, ofreciendo oportunidades de inversión respaldadas por garantías hipotecarias.',
  },
  {
    icon: <Shield size={32} className="text-accent-500" />,
    title: 'Proceso Seguro',
    desc: 'Cesiones de derechos inscritas en el Registro Público de la Propiedad, respaldadas por instituciones financieras y acompañadas durante todo el proceso legal y notarial.',
  },
  {
    icon: <Users size={32} className="text-accent-500" />,
    title: 'Asesoría Personalizada',
    desc: 'Nuestros coordinadores y asesores acompañan al cliente en cada etapa, desde el primer contacto hasta la entrega de su propiedad.',
  },
];

export default function AboutPage() {
  const { data: stats } = useQuery({
    queryKey: ['property-stats'],
    queryFn: getPropertyStats,
  });

  return (
    <div>
      <SEO
        title="Sobre Nosotros"
        description="Triomphe Bienes Raíces, con más de 28 años de experiencia en remates bancarios. Especialistas en cesión de derechos en Chihuahua, Ciudad Juárez y Querétaro."
        url="/nosotros"
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-900 to-primary-700 dark:from-primary-950 dark:to-[#1a1f2e] text-white py-20">
        <motion.div
          className="max-w-7xl mx-auto px-4 text-center"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.img
            variants={fadeInUp}
            src="/logo.png"
            alt="Triomphe Bienes Raíces"
            className="h-20 w-auto mx-auto mb-6 brightness-0 invert"
          />
          <motion.h1 variants={fadeInUp} className="text-4xl md:text-5xl font-bold mb-4">
            Sobre Nosotros
          </motion.h1>
          <motion.p
            variants={fadeInUp}
            className="text-primary-200 dark:text-gray-400 text-lg max-w-2xl mx-auto"
          >
            Más de 28 años conectando inversionistas con las mejores oportunidades de remates
            bancarios en México.
          </motion.p>
        </motion.div>
      </section>

      {/* Conócenos */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <AnimatedSection variant={fadeInLeft} className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-primary-900 dark:text-white mb-6">Conócenos</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
            Somos un despacho administrador líder en el ramo inmobiliario y financiero, dedicado a
            la venta de cesiones de derechos litigiosos, adjudicatarios o de escritura.
          </p>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
            De manera profesional, ofrecemos a nuestros inversionistas importantes ahorros y
            utilidades, respaldados por garantías hipotecarias.
          </p>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
            Contamos con más de{' '}
            <strong className="text-primary-900 dark:text-white">28 años de experiencia</strong> en
            el ramo inmobiliario y somos expertos en remates bancarios. Tenemos presencia física
            en los estados de Chihuahua y Querétaro, con oficinas ubicadas en Ciudad Juárez,
            Chihuahua Capital y el municipio de Querétaro.
          </p>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            Ofrecemos inventario de cesiones en toda la República Mexicana, compra y venta de
            propiedades, además de asesorías legales, notariales y financieras.
          </p>
        </AnimatedSection>
      </section>

      {/* Servicios */}
      <section className="bg-gray-50 dark:bg-[#242938] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-primary-900 dark:text-white text-center mb-12">
              Servicios
            </h2>
          </AnimatedSection>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {services.map(({ icon: Icon, title, desc, advisories }) => (
              <motion.div
                key={title}
                variants={fadeInUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="bg-white dark:bg-[#1a1f2e] rounded-2xl p-8 shadow-md dark:shadow-none border border-transparent dark:border-[#2e3650]"
              >
                <motion.div
                  className="flex justify-center mb-4"
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Icon size={32} className="text-accent-500" />
                </motion.div>
                <h3 className="text-xl font-bold text-primary-900 dark:text-white mb-3 text-center">
                  {title}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-center">
                  {desc}
                </p>

                {advisories && (
                  <div className="mt-6 pt-6 border-t border-gray-100 dark:border-[#2e3650]">
                    <p className="text-sm font-bold text-primary-900 dark:text-white mb-3">
                      Asesorías disponibles:
                    </p>
                    <ul className="space-y-3">
                      {advisories.map(({ title: advTitle, detail }) => (
                        <li key={advTitle} className="flex gap-2 text-sm">
                          <CheckCircle size={16} className="text-accent-500 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-500 dark:text-gray-400">
                            <strong className="text-primary-900 dark:text-white font-semibold">
                              {advTitle}:
                            </strong>{' '}
                            {detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Remates Bancarios */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <AnimatedSection className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-primary-900 dark:text-white mb-6">
            Remates Bancarios
          </h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
            Las cesiones de derechos, conocidas comúnmente como remates bancarios, surgen cuando
            una persona adquiere un crédito hipotecario con una institución financiera y
            posteriormente incumple con sus pagos, generando una cartera vencida.
          </p>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            La institución financiera pone a la venta los derechos del crédito sobre el inmueble
            en garantía a través de un tercero, recuperando mediante esta operación parte del
            préstamo otorgado.
          </p>
        </AnimatedSection>
      </section>

      {/* Qué adquiere el cliente */}
      <section className="bg-gray-50 dark:bg-[#242938] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <AnimatedSection className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-primary-900 dark:text-white mb-4">
              ¿Qué adquiere el cliente?
            </h2>
            <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
              El cliente adquiere{' '}
              <strong className="text-primary-900 dark:text-white">cesiones de derechos</strong>:
              documentos notariales inscritos en el Registro Público de la Propiedad (RPP), que
              otorgan derechos crediticios litigiosos y/o adjudicatarios sobre un inmueble,
              respaldados por gravámenes a favor de bancos o instituciones financieras.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Por qué elegirnos */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <AnimatedSection>
          <h2 className="text-3xl font-bold text-primary-900 dark:text-white text-center mb-12">
            ¿Por qué elegirnos?
          </h2>
        </AnimatedSection>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {advantages.map(({ icon, title, desc }) => (
            <motion.div
              key={title}
              variants={fadeInUp}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="bg-gray-50 dark:bg-[#242938] rounded-2xl p-8 border border-transparent dark:border-[#2e3650] text-center cursor-default"
            >
              <motion.div
                className="flex justify-center mb-4"
                whileHover={{ scale: 1.15, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                {icon}
              </motion.div>
              <h3 className="text-xl font-bold text-primary-900 dark:text-white mb-3">{title}</h3>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Misión y Visión */}
      <section className="bg-gray-50 dark:bg-[#242938] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-primary-900 dark:text-white text-center mb-12">
              Misión y Visión
            </h2>
          </AnimatedSection>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.div variants={fadeInLeft} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
              <div className="bg-primary-900 dark:bg-primary-950 text-white rounded-2xl p-8 h-full">
                <motion.div
                  className="w-12 h-12 bg-accent-400 rounded-xl flex items-center justify-center mb-4"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Shield size={24} className="text-primary-900" />
                </motion.div>
                <h3 className="text-2xl font-bold mb-4">Misión</h3>
                <p className="text-primary-100 leading-relaxed">
                  Proporcionar una asesoría inmobiliaria con ética, honestidad y discreción,
                  siempre orientados al servicio en todas las etapas de nuestra intervención en la
                  venta, compra o alquiler, basados en nuestra experiencia y capacitación en el
                  ramo.
                </p>
              </div>
            </motion.div>

            <motion.div variants={fadeInRight} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
              <div className="bg-accent-400 dark:bg-accent-500 rounded-2xl p-8 h-full">
                <motion.div
                  className="w-12 h-12 bg-primary-900 rounded-xl flex items-center justify-center mb-4"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Award size={24} className="text-accent-400" />
                </motion.div>
                <h3 className="text-2xl font-bold text-primary-900 mb-4">Visión</h3>
                <p className="text-primary-900 leading-relaxed">
                  Ser la mejor alternativa para quienes busquen la ayuda de un profesional
                  inmobiliario, ofreciendo las propuestas más innovadoras. Que nuestros clientes se
                  sientan plenamente acompañados y asesorados durante todo el proceso de compra,
                  para mejorar su calidad de vida.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Valores */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <AnimatedSection>
          <h2 className="text-3xl font-bold text-primary-900 dark:text-white text-center mb-12">
            Nuestros Valores
          </h2>
        </AnimatedSection>
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {values.map((value) => (
            <motion.div
              key={value}
              variants={fadeInUp}
              whileHover={{ y: -4, scale: 1.03, transition: { duration: 0.2 } }}
              className="bg-gray-50 dark:bg-[#1a1f2e] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-5 flex items-center gap-3 cursor-default"
            >
              <CheckCircle size={20} className="text-accent-500 flex-shrink-0" />
              <span className="font-medium text-primary-900 dark:text-white text-sm">{value}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Ciudades */}
      <section className="bg-gray-50 dark:bg-[#242938] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-primary-900 dark:text-white text-center mb-12">
              Dónde operamos
            </h2>
          </AnimatedSection>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              {
                city: 'Ciudad Juárez',
                state: 'Chihuahua',
                properties: stats?.byCity?.juarez ? `${stats.byCity.juarez}+` : '...',
                desc: 'La ciudad fronteriza más grande del norte con el mayor inventario de remates bancarios.',
              },
              {
                city: 'Chihuahua',
                state: 'Chihuahua',
                properties: stats?.byCity?.chihuahua ? `${stats.byCity.chihuahua}+` : '...',
                desc: 'Capital del estado con amplia oferta de casas y departamentos en remate a excelentes precios.',
              },
              {
                city: 'Querétaro',
                state: 'Querétaro',
                properties: stats?.byCity?.queretaro ? `${stats.byCity.queretaro}+` : '...',
                desc: 'Una de las ciudades con mayor crecimiento económico del país y oportunidades de inversión.',
              },
            ].map(({ city, state, properties, desc }) => (
              <motion.div
                key={city}
                variants={fadeInUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-white dark:bg-[#1a1f2e] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-6 cursor-default"
              >
                <div className="flex items-center gap-3 mb-3">
                  <motion.div whileHover={{ scale: 1.2 }} transition={{ duration: 0.2 }}>
                    <MapPin size={20} className="text-accent-500 flex-shrink-0" />
                  </motion.div>
                  <div>
                    <p className="font-bold text-primary-900 dark:text-white">{city}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{state}</p>
                  </div>
                  <span className="ml-auto bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-300 text-xs font-bold px-2.5 py-1 rounded-full">
                    {properties}
                  </span>
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
