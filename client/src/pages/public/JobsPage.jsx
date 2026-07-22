import { useId, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Send,
  Users,
  Star,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getPositions, applyToPosition } from '../../services/jobService';
import SEO from '../../components/ui/SEO';
import Spinner from '../../components/ui/Spinner';
import AnimatedSection from '../../components/ui/AnimatedSection';
import { fadeInUp, staggerContainer, buttonHover, buttonTap } from '../../utils/animations';
import { CITY_LABELS, JOB_TYPE_LABELS } from '../../utils/constants';
import useModalA11y from '../../hooks/useModalA11y';

// 'todas' es propio del dominio de vacantes (no existe en CITY_LABELS, que es para propiedades)
const cityLabel = { ...CITY_LABELS, todas: 'Todas las ciudades' };
const typeColor = {
  tiempo_completo: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  medio_tiempo: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  por_comision: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
};

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  city: 'juarez',
  experience: 'sin_experiencia',
  hasVehicle: false,
  motivation: '',
};

function ApplicationForm({ positionId, positionTitle, onClose }) {
  const [form, setForm] = useState(emptyForm);
  const titleId = useId();
  const formId = useId();
  const panelRef = useModalA11y(true, onClose);

  const { mutate, isPending } = useMutation({
    mutationFn: (data) => applyToPosition(positionId, data),
    onSuccess: () => {
      toast.success('¡Postulación enviada! Te contactaremos pronto.');
      onClose();
    },
    onError: () => toast.error('Error al enviar. Intenta de nuevo.'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.city || !form.experience) {
      return toast.error('Completa todos los campos requeridos');
    }
    mutate(form);
  };

  const inputClass =
    'w-full px-3 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#242938] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-[#2e3650]"
      >
        <div className="p-6 border-b border-gray-100 dark:border-[#2e3650]">
          <h2 id={titleId} className="text-xl font-bold text-blue-900 dark:text-white">
            Postularme
          </h2>
          {positionTitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{positionTitle}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor={`${formId}-name`}
                className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              >
                Nombre completo *
              </label>
              <input
                id={`${formId}-name`}
                type="text"
                placeholder="Tu nombre"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor={`${formId}-email`}
                className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              >
                Email *
              </label>
              <input
                id={`${formId}-email`}
                type="email"
                placeholder="tu@email.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor={`${formId}-phone`}
                className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              >
                Teléfono *
              </label>
              <input
                id={`${formId}-phone`}
                type="text"
                placeholder="614 000 0000"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor={`${formId}-city`}
                className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              >
                Ciudad *
              </label>
              <select
                id={`${formId}-city`}
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className={inputClass}
              >
                <option value="juarez">Cd. Juárez</option>
                <option value="chihuahua">Chihuahua</option>
                <option value="queretaro">Querétaro</option>
                <option value="otra">Otra ciudad</option>
              </select>
            </div>
            <div>
              <label
                htmlFor={`${formId}-experience`}
                className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              >
                Experiencia en ventas *
              </label>
              <select
                id={`${formId}-experience`}
                value={form.experience}
                onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))}
                className={inputClass}
              >
                <option value="sin_experiencia">Sin experiencia</option>
                <option value="menos_1_año">Menos de 1 año</option>
                <option value="1_3_años">1 a 3 años</option>
                <option value="mas_3_años">Más de 3 años</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-4">
              <input
                type="checkbox"
                id="hasVehicle"
                checked={form.hasVehicle}
                onChange={(e) => setForm((f) => ({ ...f, hasVehicle: e.target.checked }))}
                className="w-4 h-4 accent-blue-900"
              />
              <label htmlFor="hasVehicle" className="text-sm text-gray-700 dark:text-gray-300">
                Cuento con vehículo propio
              </label>
            </div>
          </div>
          <div>
            <label
              htmlFor={`${formId}-motivation`}
              className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
            >
              ¿Por qué quieres unirte a Triomphe?
            </label>
            <textarea
              id={`${formId}-motivation`}
              placeholder="Cuéntanos tu motivación..."
              value={form.motivation}
              onChange={(e) => setForm((f) => ({ ...f, motivation: e.target.value }))}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors dark:text-gray-300"
            >
              Cancelar
            </button>
            <motion.button
              type="submit"
              disabled={isPending}
              whileHover={buttonHover}
              whileTap={buttonTap}
              className="flex-1 bg-blue-900 dark:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={16} />
              {isPending ? 'Enviando...' : 'Enviar postulación'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function PositionCard({ position }) {
  const [expanded, setExpanded] = useState(false);
  const [applying, setApplying] = useState(false);

  return (
    <>
      <motion.div
        variants={fadeInUp}
        className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {position.isUrgent && (
                  <span className="inline-flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
                    <Star size={10} /> Urgente
                  </span>
                )}
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${typeColor[position.type]}`}
                >
                  {JOB_TYPE_LABELS[position.type]}
                </span>
              </div>
              <h3 className="text-lg font-bold text-blue-900 dark:text-white">{position.title}</h3>
            </div>
            <motion.button
              onClick={() => setApplying(true)}
              whileHover={buttonHover}
              whileTap={buttonTap}
              className="flex-shrink-0 bg-yellow-400 text-blue-900 px-4 py-2 rounded-xl text-sm font-bold hover:bg-yellow-300 transition-colors"
            >
              Postularme
            </motion.button>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 mb-4">
            <span className="flex items-center gap-1">
              <MapPin size={12} /> {cityLabel[position.city]}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} /> {JOB_TYPE_LABELS[position.type]}
            </span>
            <span className="flex items-center gap-1">
              <Briefcase size={12} /> Ventas inmobiliarias
            </span>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">
            {position.description}
          </p>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm font-medium mt-3 hover:underline"
          >
            {expanded ? (
              <>
                <ChevronUp size={16} /> Ver menos
              </>
            ) : (
              <>
                <ChevronDown size={16} /> Ver más detalles
              </>
            )}
          </button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden border-t border-gray-100 dark:border-[#2e3650]"
            >
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-blue-900 dark:text-white text-sm mb-2">
                    Descripción completa
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {position.description}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900 dark:text-white text-sm mb-2">
                    Requisitos
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                    {position.requirements}
                  </p>
                </div>
                {position.benefits && (
                  <div className="md:col-span-2">
                    <h4 className="font-semibold text-blue-900 dark:text-white text-sm mb-2">
                      Beneficios
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                      {position.benefits}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {applying && (
          <ApplicationForm
            positionId={position.id}
            positionTitle={position.title}
            onClose={() => setApplying(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default function JobsPage() {
  const [generalApplying, setGeneralApplying] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => getPositions({ status: 'activa' }),
  });

  const positions = data?.data || [];

  const benefits = [
    {
      icon: <DollarSign size={32} className="text-yellow-500" />,
      title: 'Comisiones atractivas',
      desc: 'Esquema de comisiones competitivo. Tus ingresos dependen de tu esfuerzo y dedicación.',
    },
    {
      icon: <TrendingUp size={32} className="text-yellow-500" />,
      title: 'Crecimiento profesional',
      desc: 'Capacitación constante en el sector inmobiliario y oportunidades de desarrollo dentro de la empresa.',
    },
    {
      icon: <Users size={32} className="text-yellow-500" />,
      title: 'Excelente ambiente',
      desc: 'Equipo colaborativo con más de 27 años de experiencia. Aprende de los mejores en el sector.',
    },
  ];

  return (
    <div>
      <SEO
        title="Trabaja con Nosotros"
        description="Únete al equipo de Triomphe Bienes Raíces. Buscamos asesores de ventas apasionados por el sector inmobiliario."
        url="/trabaja-con-nosotros"
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-900 to-blue-700 dark:from-[#0f1621] dark:to-[#1a1f2e] text-white py-20">
        <motion.div
          className="max-w-7xl mx-auto px-4 text-center"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            variants={fadeInUp}
            className="inline-flex items-center gap-2 bg-yellow-400 text-blue-900 text-sm font-semibold px-4 py-1.5 rounded-full mb-6"
          >
            <Users size={16} /> Únete a nuestro equipo
          </motion.div>
          <motion.h1 variants={fadeInUp} className="text-4xl md:text-5xl font-bold mb-4">
            Trabaja con Nosotros
          </motion.h1>
          <motion.p
            variants={fadeInUp}
            className="text-blue-200 dark:text-gray-400 text-lg max-w-2xl mx-auto mb-8"
          >
            Sé parte de Triomphe Bienes Raíces y construye una carrera exitosa en el sector
            inmobiliario. Comisiones atractivas y crecimiento profesional.
          </motion.p>
          <motion.button
            variants={fadeInUp}
            onClick={() => setGeneralApplying(true)}
            whileHover={buttonHover}
            whileTap={buttonTap}
            className="bg-yellow-400 text-blue-900 px-8 py-3.5 rounded-xl font-bold text-lg hover:bg-yellow-300 transition-colors"
          >
            Postulación general
          </motion.button>
        </motion.div>
      </section>

      {/* Por qué unirte */}
      <section className="bg-gray-50 dark:bg-[#242938] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-blue-900 dark:text-white text-center mb-12">
              ¿Por qué unirte a Triomphe?
            </h2>
          </AnimatedSection>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {benefits.map(({ icon, title, desc }) => (
              <motion.div
                key={title}
                variants={fadeInUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="bg-white dark:bg-[#1a1f2e] rounded-2xl p-8 text-center shadow-md dark:shadow-none border border-transparent dark:border-[#2e3650] cursor-default"
              >
                <motion.div
                  className="flex justify-center mb-4"
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  {icon}
                </motion.div>
                <h3 className="text-xl font-bold text-blue-900 dark:text-white mb-3">{title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Vacantes */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <AnimatedSection className="mb-8">
          <h2 className="text-3xl font-bold text-blue-900 dark:text-white mb-2">
            Vacantes disponibles
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            {positions.length > 0
              ? `${positions.length} vacante(s) activa(s)`
              : 'Explora nuestras oportunidades'}
          </p>
        </AnimatedSection>

        {isLoading ? (
          <Spinner size="lg" className="py-20" />
        ) : positions.length === 0 ? (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="text-center py-16 bg-white dark:bg-[#242938] rounded-2xl border border-gray-100 dark:border-[#2e3650]"
          >
            <Briefcase size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-xl font-medium text-gray-500 dark:text-gray-400">
              No hay vacantes activas por el momento
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 mb-6">
              Pero puedes enviarnos tu postulación general
            </p>
            <motion.button
              onClick={() => setGeneralApplying(true)}
              whileHover={buttonHover}
              whileTap={buttonTap}
              className="bg-blue-900 dark:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Postulación general
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            className="space-y-4"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {positions.map((position) => (
              <PositionCard key={position.id} position={position} />
            ))}
          </motion.div>
        )}
      </section>

      {/* CTA */}
      <AnimatedSection>
        <section className="bg-blue-900 dark:bg-[#0f1621] text-white py-16 text-center">
          <div className="max-w-2xl mx-auto px-4">
            <h2 className="text-3xl font-bold mb-4">¿No encuentras tu vacante ideal?</h2>
            <p className="text-blue-200 dark:text-gray-400 mb-8">
              Envíanos tu postulación general y te consideraremos para futuras oportunidades.
            </p>
            <motion.button
              onClick={() => setGeneralApplying(true)}
              whileHover={buttonHover}
              whileTap={buttonTap}
              className="bg-yellow-400 text-blue-900 px-10 py-4 rounded-xl font-bold text-lg hover:bg-yellow-300 transition-colors"
            >
              Enviar postulación general
            </motion.button>
          </div>
        </section>
      </AnimatedSection>

      <AnimatePresence>
        {generalApplying && (
          <ApplicationForm
            positionId="general"
            positionTitle={null}
            onClose={() => setGeneralApplying(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
