import { ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import SEO from '../../components/ui/SEO';
import AnimatedSection from '../../components/ui/AnimatedSection';
import { fadeInUp, staggerContainer } from '../../utils/animations';

const sections = [
  {
    title: 'Responsable de tus datos',
    body: [
      'Triomphe Bienes Raíces S. de R.L. de C.V. es responsable de recabar sus datos personales, del uso que se le dé a los mismos y de su protección.',
    ],
  },
  {
    title: '¿Cómo contactarnos?',
    body: ['Teléfono: 656-579-2750'],
  },
  {
    title: '¿Para qué fines recabamos y utilizamos sus datos personales?',
    intro: 'Sus datos personales serán utilizados para las siguientes finalidades:',
    list: [
      'Proveer los servicios requeridos por usted.',
      'Informar sobre cambios o servicios que estén relacionados con el contratado o adquirido por el cliente.',
      'Dar cumplimiento a obligaciones contraídas con nuestros clientes.',
      'Realizar estudios internos sobre hábitos de consumo.',
    ],
  },
  {
    title: '¿Qué datos personales obtenemos y de dónde?',
    body: [
      'Para las finalidades señaladas en el presente aviso de privacidad, podemos recabar sus datos personales de distintas formas: cuando usted nos los proporciona directamente; cuando visita nuestro sitio de Internet o utiliza nuestros servicios en línea, y cuando obtenemos información a través de otras fuentes que están permitidas por la ley.',
    ],
  },
  {
    title: 'Datos personales que recabamos de forma directa',
    intro:
      'Recabamos sus datos personales de forma directa cuando usted mismo nos los proporciona por diversos medios, como cuando nos da información con objeto de que le prestemos un servicio. Los datos que obtenemos por este medio pueden ser, entre otros:',
    list: ['Nombre Completo', 'Email', 'Teléfono particular', 'Teléfono Celular'],
  },
  {
    title: 'Datos que recabamos en nuestro sitio web',
    intro: 'Cuando visita nuestro sitio de Internet o utiliza nuestros servicios en línea, recabamos:',
    list: ['Nombre Completo', 'Email', 'Teléfono particular', 'Teléfono Celular'],
  },
  {
    title: 'Datos personales sensibles',
    body: [
      'Le informamos que en esta empresa no serán recabados y tratados datos personales sensibles que incluyen, entre otros, origen racial o étnico, estado de salud presente y futuro, información genética, creencias religiosas, filosóficas y morales, afiliación sindical, opiniones políticas, preferencia sexual.',
    ],
  },
  {
    title: '¿Cómo acceder o rectificar sus datos personales?',
    intro:
      'Usted tiene el derecho de acceder a sus datos personales que poseemos y a los detalles del tratamiento de los mismos, así como a rectificarlos en caso de ser inexactos, cancelarlos cuando considere que resulten ser excesivos o innecesarios, u oponerse al tratamiento de los mismos para fines específicos.',
    list: ['Acceso', 'Rectificación', 'Cancelación', 'Oposición'],
    body2: ['Departamento de Privacidad: privacidad@triomphebienesraices.com.mx'],
  },
  {
    title: 'Modificaciones al aviso de privacidad',
    body: [
      'Nos reservamos el derecho de efectuar en cualquier momento modificaciones o actualizaciones al presente aviso de privacidad, para la atención de novedades legislativas o jurisprudenciales, políticas internas, nuevos requerimientos para la prestación u ofrecimiento de nuestros servicios o productos y prácticas del mercado.',
      'Estas modificaciones estarán disponibles al público a través de nuestra página de Internet.',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div>
      <SEO
        title="Aviso de Privacidad"
        description="Aviso de privacidad de Triomphe Bienes Raíces: finalidades del tratamiento de datos personales, derechos ARCO y datos de contacto del departamento de privacidad."
        url="/aviso-de-privacidad"
      />

      <section className="bg-gradient-to-br from-primary-900 to-primary-700 dark:from-primary-950 dark:to-[#1a1f2e] text-white py-20">
        <motion.div
          className="max-w-4xl mx-auto px-4 text-center"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fadeInUp} className="flex justify-center mb-4">
            <ShieldCheck size={48} className="text-accent-400" />
          </motion.div>
          <motion.h1 variants={fadeInUp} className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Aviso de Privacidad
          </motion.h1>
          <motion.p
            variants={fadeInUp}
            className="text-primary-200 dark:text-gray-400 text-lg max-w-2xl mx-auto"
          >
            Cómo recabamos, utilizamos y protegemos sus datos personales.
          </motion.p>
        </motion.div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-16 space-y-10">
        {sections.map((section) => (
          <AnimatedSection key={section.title}>
            <h2 className="text-xl font-bold text-primary-900 dark:text-white mb-3">
              {section.title}
            </h2>
            {section.body?.map((paragraph) => (
              <p
                key={paragraph}
                className="text-gray-600 dark:text-gray-400 leading-relaxed mb-3"
              >
                {paragraph}
              </p>
            ))}
            {section.intro && (
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                {section.intro}
              </p>
            )}
            {section.list && (
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400 mb-3">
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {section.body2?.map((paragraph) => (
              <p
                key={paragraph}
                className="text-gray-600 dark:text-gray-400 leading-relaxed"
              >
                {paragraph}
              </p>
            ))}
          </AnimatedSection>
        ))}

        <AnimatedSection>
          <div className="border-t border-gray-100 dark:border-[#2e3650] pt-6 text-sm text-gray-500 dark:text-gray-500">
            <p>Última actualización: 6 de mayo de 2025</p>
            <p>© 2025 Triomphe Bienes Raíces. Todos los derechos reservados.</p>
          </div>
        </AnimatedSection>
      </section>
    </div>
  );
}
