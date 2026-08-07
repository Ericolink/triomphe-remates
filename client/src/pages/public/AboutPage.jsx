import {
  Shield,
  Users,
  TrendingDown,
  Award,
  MapPin,
  Home,
  Landmark,
  Scale,
  Banknote,
  Gavel,
  Stamp,
  ExternalLink,
  Image as ImageIcon,
  Handshake,
  Lightbulb,
  Target,
  Flame,
  Compass,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import SEO from '../../components/ui/SEO';
import AnimatedSection from '../../components/ui/AnimatedSection';
import {
  fadeInUp,
  fadeInLeft,
  fadeInRight,
  staggerContainer,
  buttonHover,
  buttonTap,
} from '../../utils/animations';
import { getPropertyStats } from '../../services/propertyService';

// El orden importa: la primera letra de cada valor deletrea TRIOMPHE (T-R-I-O-M-P-H-E).
// Se resalta esa letra en el render — no reordenar esta lista sin mantener el acróstico.
const values = [
  { name: 'Trabajo en equipo', icon: Users },
  { name: 'Respeto', icon: Handshake },
  { name: 'Innovación', icon: Lightbulb },
  { name: 'Orientación al cliente', icon: Target },
  { name: 'Motivación', icon: Flame },
  { name: 'Principios', icon: Compass },
  { name: 'Honradez', icon: ShieldCheck },
  { name: 'Entusiasmo', icon: Sparkles },
];

// Fotos de "Nuestros Valores": no requieren tocar este archivo para activarse — basta con
// colocar un archivo con exactamente uno de estos 3 nombres en client/public/valores/
// (jpg o png, cualquiera de las dos extensiones sirve). Mientras el archivo no exista,
// <ValuePhoto> cae automáticamente al placeholder vía onError.
const valuePhotoSlots = [
  { base: '/valores/foto-1', alt: 'Foto que representa nuestros valores 1' },
  { base: '/valores/foto-2', alt: 'Foto que representa nuestros valores 2' },
  { base: '/valores/foto-3', alt: 'Foto que representa nuestros valores 3' },
];

function ValuePhoto({ base, alt }) {
  const [srcIndex, setSrcIndex] = useState(0);
  const extensions = ['jpg', 'jpeg', 'png'];
  const src = srcIndex < extensions.length ? `${base}.${extensions[srcIndex]}` : null;

  if (!src) {
    return (
      <div className="h-full min-h-[140px] rounded-2xl border-2 border-dashed border-gray-300 dark:border-[#2e3650] flex items-center justify-center text-gray-300 dark:text-gray-600">
        <ImageIcon size={32} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setSrcIndex((i) => i + 1)}
      className="h-full min-h-[140px] w-full rounded-2xl object-cover"
    />
  );
}

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
  },
];

const advisories = [
  {
    icon: Banknote,
    title: 'Resolución de crédito hipotecario',
    detail: 'Cancelación, traspaso o reestructura.',
  },
  {
    icon: Gavel,
    title: 'Asesoría legal',
    detail:
      'Servicios legales especializados para proteger los intereses del cliente y resolver conflictos inmobiliarios.',
  },
  {
    icon: Stamp,
    title: 'Trámites notariales',
    detail:
      'Trabajo con diversas notarías a nivel nacional para brindar asesoramiento especializado según cada caso.',
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
    desc: 'Cesiones de derechos inscritas en el Registro Público de la Propiedad, respaldadas por instituciones financieras y acompañamiento durante todo el proceso legal y notarial.',
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
          <motion.div
            variants={fadeInUp}
            className="inline-block bg-white rounded-3xl p-6 md:p-8 mb-8 shadow-xl"
          >
            <img src="/logo.png" alt="Triomphe Bienes Raíces" className="h-28 md:h-36 w-auto" />
          </motion.div>
          <motion.p
            variants={fadeInUp}
            className="text-primary-100 dark:text-gray-300 text-xl max-w-2xl mx-auto mb-8"
          >
            Has llegado al lugar correcto para hacer crecer tus inversiones.
          </motion.p>
          <motion.a
            variants={fadeInUp}
            href="https://triomphebienesraices.com.mx/"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={buttonHover}
            whileTap={buttonTap}
            className="inline-flex items-center gap-2 bg-accent-400 text-primary-900 px-8 py-3.5 rounded-xl font-bold hover:bg-accent-300 transition-colors"
          >
            Visitar sitio web <ExternalLink size={18} />
          </motion.a>
        </motion.div>
      </section>

      {/* Conócenos */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <AnimatedSection variant={fadeInLeft} className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-primary-900 dark:text-white mb-6">Conócenos</h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
            Somos un despacho administrador líder en el ramo inmobiliario y financiero, dedicado a
            la venta de cesiones de derechos litigiosos, adjudicatarios o de escritura.
          </p>
          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
            De manera profesional, ofrecemos a nuestros inversionistas importantes ahorros y
            utilidades, respaldados por garantías hipotecarias.
          </p>
          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
            Contamos con más de{' '}
            <strong className="text-primary-900 dark:text-white">28 años de experiencia</strong> en
            el ramo inmobiliario y somos expertos en remates bancarios. Tenemos presencia física
            en los estados de Chihuahua y Querétaro, con oficinas ubicadas en Ciudad Juárez,
            Chihuahua Capital y el municipio de Querétaro.
          </p>
          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
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
            {services.map(({ icon: Icon, title, desc }) => (
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
              </motion.div>
            ))}
          </motion.div>

          {/* Asesorías disponibles — continuación independiente de Servicios */}
          <AnimatedSection className="mt-12 md:mt-16">
            <div className="bg-white dark:bg-[#1a1f2e] rounded-3xl shadow-md dark:shadow-none border border-transparent dark:border-[#2e3650] p-8 md:p-12">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <h3 className="text-3xl md:text-4xl font-bold text-primary-900 dark:text-white mb-3">
                  Asesorías disponibles
                </h3>
                <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed">
                  Personal capacitado en áreas legal, fiscal, contable y comercial te acompaña en
                  cada trámite, siempre ante notario público.
                </p>
              </div>

              <motion.div
                className="grid grid-cols-1 sm:grid-cols-3 gap-6"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                {advisories.map(({ icon: Icon, title, detail }) => (
                  <motion.div
                    key={title}
                    variants={fadeInUp}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="bg-gray-50 dark:bg-[#242938] rounded-xl p-6 border border-transparent dark:border-[#2e3650]"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-accent-50 dark:bg-accent-500/10 flex items-center justify-center flex-shrink-0">
                        <Icon size={20} className="text-accent-500" />
                      </div>
                      <h4 className="font-bold text-primary-900 dark:text-white text-sm leading-snug">
                        {title}
                      </h4>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                      {detail}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Remates Bancarios */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <AnimatedSection className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-primary-900 dark:text-white mb-6">
            ¿Qué son los Remates Bancarios?
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
            Las cesiones de derechos, conocidas comúnmente como remates bancarios, surgen cuando
            una persona adquiere un crédito hipotecario con una institución financiera y
            posteriormente incumple con sus pagos, generando una cartera vencida.
          </p>
          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
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
            <h2 className="text-4xl font-bold text-primary-900 dark:text-white mb-4">
              ¿Qué adquiere el cliente?
            </h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed">
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
          <h2 className="text-4xl font-bold text-primary-900 dark:text-white text-center mb-12">
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
              <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Misión y Visión */}
      <section className="bg-gray-50 dark:bg-[#242938] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <AnimatedSection>
            <h2 className="text-4xl md:text-5xl font-extrabold text-primary-900 dark:text-white text-center mb-12">
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
                <p className="text-lg text-primary-100 leading-relaxed">
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
                <p className="text-lg text-primary-900 leading-relaxed">
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
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_220px] gap-8 items-stretch">
          <motion.div
            className="flex flex-col gap-4"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {values.map(({ name, icon: Icon }) => (
              <motion.div
                key={name}
                variants={fadeInUp}
                whileHover={{ x: 4, transition: { duration: 0.2 } }}
                className="bg-gray-50 dark:bg-[#1a1f2e] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-4 flex items-center gap-4 cursor-default"
              >
                <Icon size={28} className="text-accent-500 flex-shrink-0" />
                <span className="font-medium text-primary-900 dark:text-white">
                  <span className="text-accent-500 font-extrabold text-xl">{name[0]}</span>
                  {name.slice(1)}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* Fotos que resumen los valores — el cliente las coloca aquí; placeholder mientras tanto */}
          <motion.div
            className="flex flex-col gap-4"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {valuePhotoSlots.map(({ base, alt }) => (
              <motion.div key={base} variants={fadeInUp} className="flex-1">
                <ValuePhoto base={base} alt={alt} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Ciudades */}
      <section className="bg-gray-50 dark:bg-[#242938] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-primary-900 dark:text-white text-center mb-12">
              Operamos a nivel nacional, visita nuestra{' '}
              <Link to="/propiedades" className="text-accent-500 hover:underline">
                sección de propiedades
              </Link>
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
                    <p className="text-lg font-bold text-primary-900 dark:text-white">{city}</p>
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
