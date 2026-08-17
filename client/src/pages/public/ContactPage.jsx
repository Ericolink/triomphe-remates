import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import ContactForm from '../../components/ui/ContactForm';
import SEO from '../../components/ui/SEO';
import { OFFICES } from '../../utils/constants';
import { fadeInUp, fadeInLeft, fadeInRight, staggerContainer } from '../../utils/animations';

export default function ContactPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <SEO
        title="Contacto"
        description="Contáctanos para más información sobre nuestros remates bancarios."
        url="/contacto"
      />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="text-center mb-12"
      >
        <motion.h1
          variants={fadeInUp}
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary-900 dark:text-white mb-3"
        >
          Contáctanos
        </motion.h1>
        <motion.p
          variants={fadeInUp}
          className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto"
        >
          Nuestros asesores están listos para ayudarte a encontrar la mejor propiedad.
        </motion.p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <motion.div variants={fadeInLeft} initial="hidden" animate="visible">
          <h2 className="text-2xl font-bold text-primary-900 dark:text-white mb-6">
            Envíanos un mensaje
          </h2>
          <div className="bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-6 shadow-md">
            <ContactForm />
          </div>
        </motion.div>

        <motion.div
          className="space-y-6"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.h2
            variants={fadeInRight}
            className="text-2xl font-bold text-primary-900 dark:text-white"
          >
            Información de contacto
          </motion.h2>

          {OFFICES.map((office) => (
            <motion.div
              key={office.city}
              variants={fadeInRight}
              whileHover={{ x: 4, transition: { duration: 0.2 } }}
              className="p-5 bg-gray-50 dark:bg-[#242938] rounded-xl border border-transparent dark:border-[#2e3650]"
            >
              <p className="flex items-center gap-2 font-bold text-primary-900 dark:text-white text-lg mb-3">
                <MapPin size={18} className="text-accent-500 flex-shrink-0" />
                {office.cityLabel}
              </p>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-3">
                  <Phone size={18} className="text-accent-500 flex-shrink-0" />
                  <span className="text-base text-gray-600 dark:text-gray-300">
                    {office.phone}
                  </span>
                </li>
                <li className="flex items-center gap-3 min-w-0">
                  <Mail size={18} className="text-accent-500 flex-shrink-0" />
                  {office.email.includes('@') ? (
                    <a
                      href={`mailto:${office.email}`}
                      className="text-base text-gray-600 dark:text-gray-300 hover:text-accent-500 transition-colors break-words"
                    >
                      {office.email}
                    </a>
                  ) : (
                    <span className="text-base text-gray-600 dark:text-gray-300">
                      {office.email}
                    </span>
                  )}
                </li>
                <li className="flex items-start gap-3">
                  <MapPin size={18} className="text-accent-500 flex-shrink-0 mt-0.5" />
                  {office.mapsUrl ? (
                    <a
                      href={office.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base text-gray-600 dark:text-gray-300 hover:text-accent-500 transition-colors"
                    >
                      {office.street}, {office.location}
                    </a>
                  ) : (
                    <span className="text-base text-gray-600 dark:text-gray-300">
                      {office.street}, {office.location}
                    </span>
                  )}
                </li>
              </ul>
            </motion.div>
          ))}

          <motion.div
            variants={fadeInRight}
            whileHover={{ x: 4, transition: { duration: 0.2 } }}
            className="flex gap-4 p-4 bg-gray-50 dark:bg-[#242938] rounded-xl border border-transparent dark:border-[#2e3650] cursor-default"
          >
            <div className="flex-shrink-0 w-10 h-10 bg-primary-900 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-accent-500" />
            </div>
            <div>
              <p className="font-semibold text-primary-900 dark:text-white text-base">Horario</p>
              <p className="text-gray-500 dark:text-gray-400 text-base">
                Lun - Vie: 9:00 AM - 6:00 PM
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
