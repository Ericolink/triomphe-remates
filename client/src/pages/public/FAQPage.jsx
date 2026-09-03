import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SEO from '../../components/ui/SEO';
import AnimatedSection from '../../components/ui/AnimatedSection';
import { fadeInUp, staggerContainer } from '../../utils/animations';

const faqGroups = [
  {
    category: 'Sobre los remates bancarios',
    items: [
      {
        q: '¿Qué es un remate bancario?',
        a: 'Es una propiedad que un banco recupera tras un proceso legal por falta de pago de un crédito hipotecario, y que pone a la venta —generalmente por debajo de su valor comercial— mediante cesión de derechos litigiosos.',
      },
      {
        q: '¿Qué es la "cesión de derechos"?',
        a: 'Es el contrato mediante el cual el banco transfiere al comprador los derechos que tiene sobre el juicio y la propiedad. El comprador se convierte en el nuevo titular de esos derechos y continúa el proceso legal hasta obtener la escritura definitiva.',
      },
      {
        q: '¿Por qué el precio puede aparecer como "PENDIENTE"?',
        a: 'Algunas propiedades aún no tienen un precio de remate confirmado por el banco. En cuanto el banco lo define, actualizamos la ficha y notificamos a quienes tengan una alerta activa para esa propiedad.',
      },
    ],
  },
  {
    category: 'Proceso de compra',
    items: [
      {
        q: '¿Cuáles son los pasos para adquirir una propiedad?',
        a: 'En términos generales: 1) primera información y agenda de cita, 2) presentación de la propiedad con documentación legal y adeudos, 3) verificación legal de viabilidad, 4) apartado con el monto requerido, 5) firma de contrato y pago de servicios a la empresa, 6) pago del remate al banco, 7) firma de cesión de derechos ante notario, 8) seguimiento del periodo legal, 9) escrituración y entrega de la propiedad.',
      },
      {
        q: '¿Cuánto tiempo tarda el proceso completo?',
        a: 'Depende del estatus legal de cada propiedad, pero suele tomar varios meses desde el apartado hasta la escrituración final. Durante el "periodo legal" el asesor da seguimiento mensual y te mantiene informado del avance.',
      },
      {
        q: '¿Qué documentos necesito para empezar?',
        a: 'Para la primera cita basta con tu identificación oficial (INE) y contar con el monto requerido para el apartado. Conforme avanza el proceso se solicitará documentación adicional según el caso.',
      },
    ],
  },
  {
    category: 'Pagos y costos',
    items: [
      {
        q: '¿El precio que veo incluye todos los gastos?',
        a: 'El precio mostrado corresponde al monto de cesión/remate. Adicionalmente existen gastos legales, notariales y de escrituración propios de cada caso, que tu asesor te detallará antes de firmar cualquier contrato.',
      },
      {
        q: '¿Cómo serían los pagos?',
        a: 'No se manejan parcialidades, el apartado inicial asegura tu lugar en el proceso. El monto total de la venta se divide en dos exhibiciones (pago por servicios de intermediación a la empresa y pago del remate a la institución financiera), los montos y condiciones para entregar dichos pagos dependen de cada propiedad y banco.',
      },
      {
        q: '¿Qué pasa si me arrepiento después de apartar la propiedad?',
        a: 'Las condiciones de cancelación se especifican en el recibo de apartado.',
      },
    ],
  },
  {
    category: 'Riesgos y garantías',
    items: [
      {
        q: '¿Es legal y seguro comprar un remate bancario?',
        a: 'Sí. Es un proceso reconocido y regulado legalmente. Triomphe acompaña todo el proceso legal y notarial para proteger tu inversión, desde la verificación de viabilidad hasta la escrituración final.',
      },
      {
        q: '¿Qué pasa si la propiedad está ocupada?',
        a: 'Algunas propiedades pueden encontrarse invadidas, y estas a su vez se les hará un proceso de reivindicatoria para poder obtener la posesión, y posteriormente escritura. Hay algunas propiedades ya desabitadas y/o adjudicadas las cuales su entrega es más pronta.',
      },
    ],
  },
];

function FAQItem({ q, a, isOpen, onToggle }) {
  return (
    <div className="border border-gray-100 dark:border-[#2e3650] rounded-2xl overflow-hidden bg-white dark:bg-[#1a1f2e]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-medium text-primary-900 dark:text-gray-100">{q}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 text-gray-400"
        >
          <ChevronDown size={20} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQPage() {
  const [openKey, setOpenKey] = useState(null);

  return (
    <div>
      <SEO
        title="Preguntas Frecuentes"
        description="Respuestas a las preguntas más comunes sobre remates bancarios, cesión de derechos, el proceso de compra y los costos legales en Triomphe Bienes Raíces."
        url="/preguntas-frecuentes"
      />

      <section className="bg-gradient-to-br from-primary-900 to-primary-700 dark:from-primary-950 dark:to-[#1a1f2e] text-white py-20">
        <motion.div
          className="max-w-4xl mx-auto px-4 text-center"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fadeInUp} className="flex justify-center mb-4">
            <HelpCircle size={48} className="text-accent-400" />
          </motion.div>
          <motion.h1 variants={fadeInUp} className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Preguntas Frecuentes
          </motion.h1>
          <motion.p
            variants={fadeInUp}
            className="text-primary-200 dark:text-gray-400 text-lg max-w-2xl mx-auto"
          >
            Todo lo que necesitas saber sobre remates bancarios, cesión de derechos y el proceso de
            compra.
          </motion.p>
        </motion.div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-16 space-y-12">
        {faqGroups.map((group) => (
          <AnimatedSection key={group.category}>
            <h2 className="text-2xl font-bold text-primary-900 dark:text-white mb-6">
              {group.category}
            </h2>
            <div className="space-y-3">
              {group.items.map((item) => {
                const key = `${group.category}-${item.q}`;
                return (
                  <FAQItem
                    key={key}
                    q={item.q}
                    a={item.a}
                    isOpen={openKey === key}
                    onToggle={() => setOpenKey(openKey === key ? null : key)}
                  />
                );
              })}
            </div>
          </AnimatedSection>
        ))}
      </section>
    </div>
  );
}
