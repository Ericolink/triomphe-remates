import { Link } from 'react-router-dom';
import {
  Handshake,
  CalendarDays,
  Search,
  Tag,
  FileSignature,
  Banknote,
  PenLine,
  Scale,
  ScrollText,
  Home,
  Flag,
  ArrowRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import SEO from '../../components/ui/SEO';
import AnimatedSection from '../../components/ui/AnimatedSection';
import { fadeInUp, staggerContainer } from '../../utils/animations';

const processSteps = [
  {
    step: 1,
    icon: Handshake,
    title: 'Primer Contacto',
    desc: 'El asesor contacta al cliente, explica qué es un remate bancario, sus ventajas, tiempos estimados y el proceso completo. Se agenda una cita y se solicitan requisitos como INE y monto disponible de inversión.',
  },
  {
    step: 2,
    icon: CalendarDays,
    title: 'Agendar una Cita',
    desc: 'Se coordina la primera reunión con el cliente interesado para presentar la propiedad, incluyendo plano catastral, adeudos e información general del proceso.',
    link: '/contacto',
  },
  {
    step: 3,
    icon: Tag,
    title: 'Apartado de la propiedad',
    desc: 'El cliente realiza el apartado de la propiedad ya con el conocimiento del proceso y detalles de la propiedad, con su INE, y monto requerido.',
  },
  {
    step: 4,
    icon: Search,
    title: 'Verificación de disponibilidad y viabilidad de la propiedad',
    desc: 'Se revisa la disponibilidad comercial y se realiza la verificación legal de la propiedad mediante un dictamen legal y se confirman resultados positivos antes de continuar con la operación.',
  },
  {
    step: 5,
    icon: FileSignature,
    title: 'Firma de contrato',
    desc: 'Se formaliza la operación mediante la firma del contrato con toda la información previamente proporcionada y validada.',
  },
  {
    step: 6,
    icon: Banknote,
    title: 'Pago del Remate Bancario a institución financiera y a Triomphe',
    desc: 'El cliente realiza el pago o transferencia a la institución financiera (banco) correspondiente y a Triomphe.',
  },
  {
    step: 7,
    icon: PenLine,
    title: 'Firma de cesión de derechos',
    desc: 'El cliente firma su cesión de derechos ante notario público. Documento inscrito en el Registro Público de la Propiedad.',
  },
  {
    step: 8,
    icon: Scale,
    title: 'Periodo legal',
    desc: 'Se gestiona el seguimiento de las etapas legales y se mantiene comunicación con el cliente.',
  },
  {
    step: 9,
    icon: Home,
    title: 'Entrega de propiedad',
    desc: 'El cliente recibe su propiedad. Culminación exitosa del proceso de adquisición del remate bancario.',
  },
  {
    step: 10,
    icon: ScrollText,
    title: 'Escrituración',
    desc: 'Se completan todos los trámites notariales y legales necesarios para la escrituración de la propiedad.',
  },
];

export default function ProcessPage() {
  return (
    <div>
      <SEO
        title="Proceso de Adquisición"
        description="Conoce paso a paso el proceso de adquisición de un remate bancario con Triomphe, desde el primer contacto hasta la entrega de tu propiedad."
        url="/proceso-adquisicion"
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-900 to-primary-700 dark:from-primary-950 dark:to-[#1a1f2e] text-white py-20">
        <motion.div
          className="max-w-7xl mx-auto px-4 text-center"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.h1 variants={fadeInUp} className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Proceso de Adquisición
          </motion.h1>
          <motion.p
            variants={fadeInUp}
            className="text-primary-200 dark:text-gray-400 text-lg max-w-2xl mx-auto"
          >
            Desde el primer contacto hasta la entrega de tu propiedad, te acompañamos en cada
            etapa.
          </motion.p>
        </motion.div>
      </section>

      {/* Pasos */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          {processSteps.map(({ step, icon: Icon, title, desc, link }) => (
            <motion.div
              key={step}
              variants={fadeInUp}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center gap-4 mb-4">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0 w-16 h-16 bg-primary-50 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center"
                >
                  <Icon size={32} className="text-primary-900 dark:text-accent-400" />
                </motion.div>
                <div>
                  <span className="text-xs font-bold text-accent-500 uppercase tracking-wide">
                    Paso {step}
                  </span>
                  <h3 className="font-bold text-lg text-primary-900 dark:text-white">{title}</h3>
                </div>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{desc}</p>
              {link && (
                <Link
                  to={link}
                  className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-primary-900 dark:text-accent-400 hover:gap-2.5 transition-all"
                >
                  Contáctanos
                  <ArrowRight size={16} />
                </Link>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Fin del proceso */}
        <AnimatedSection>
          <div className="flex flex-col items-center gap-3 mt-12 text-center">
            <div className="w-16 h-16 bg-primary-900 dark:bg-primary-700 rounded-full flex items-center justify-center">
              <Flag size={28} className="text-accent-400" />
            </div>
            <p className="text-xl font-bold text-primary-900 dark:text-white">Fin del proceso</p>
          </div>
        </AnimatedSection>
      </section>
    </div>
  );
}
