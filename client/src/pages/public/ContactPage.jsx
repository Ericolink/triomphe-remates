import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import ContactForm from '../../components/ui/ContactForm';
import SEO from '../../components/ui/SEO';
import { fadeInUp, fadeInLeft, fadeInRight, staggerContainer } from '../../utils/animations';

export default function ContactPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <SEO title="Contacto" description="Contáctanos para más información sobre nuestros remates bancarios." url="/contacto" />

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="text-center mb-12">
        <motion.h1 variants={fadeInUp} className="text-4xl font-bold text-blue-900 dark:text-white mb-3">
          Contáctanos
        </motion.h1>
        <motion.p variants={fadeInUp} className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          Nuestros asesores están listos para ayudarte a encontrar la mejor propiedad.
        </motion.p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <motion.div variants={fadeInLeft} initial="hidden" animate="visible">
          <h2 className="text-xl font-bold text-blue-900 dark:text-white mb-6">Envíanos un mensaje</h2>
          <div className="bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-6 shadow-md">
            <ContactForm />
          </div>
        </motion.div>

        <motion.div
          className="space-y-6"
          variants={staggerContainer} initial="hidden" animate="visible"
        >
          <motion.h2 variants={fadeInRight} className="text-xl font-bold text-blue-900 dark:text-white">
            Información de contacto
          </motion.h2>
          {[
            { icon: <Phone size={20} className="text-yellow-500" />, title: 'Teléfono', lines: ['+52 (656) 579-2750'] },
            { icon: <Mail size={20} className="text-yellow-500" />, title: 'Email', lines: ['t.bienesraicesmx@gmail.com', 'TriompheSistemas@gmail.com'] },
            { icon: <MapPin size={20} className="text-yellow-500" />, title: 'Ciudades', lines: ['Cd. Juárez, Chihuahua', 'Chihuahua, Chih.', 'Querétaro, Qro.'] },
            { icon: <Clock size={20} className="text-yellow-500" />, title: 'Horario', lines: ['Lun - Vie: 9:00 AM - 6:00 PM'] },
          ].map(({ icon, title, lines }) => (
            <motion.div key={title} variants={fadeInRight}
              whileHover={{ x: 4, transition: { duration: 0.2 } }}
              className="flex gap-4 p-4 bg-gray-50 dark:bg-[#242938] rounded-xl border border-transparent dark:border-[#2e3650] cursor-default">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center">
                {icon}
              </div>
              <div>
                <p className="font-semibold text-blue-900 dark:text-white text-sm">{title}</p>
                {lines.map((l) => <p key={l} className="text-gray-500 dark:text-gray-400 text-sm">{l}</p>)}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
