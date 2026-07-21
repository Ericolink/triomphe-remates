import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Send, CheckCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createFeedback } from '../../services/feedbackService';
import SEO from '../../components/ui/SEO';
import { fadeInUp, staggerContainer } from '../../utils/animations';

const categories = [
  {
    value: 'queja',
    label: 'Queja',
    description: 'Algo no salió bien',
    color:
      'border-red-300 text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 dark:border-red-700',
  },
  {
    value: 'comentario',
    label: 'Comentario',
    description: 'Quiero compartir algo',
    color:
      'border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700',
  },
  {
    value: 'sugerencia',
    label: 'Sugerencia',
    description: 'Tengo una idea',
    color:
      'border-green-300 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700',
  },
];

const INITIAL_FORM = { category: 'comentario', name: '', email: '', subject: '', message: '' };

export default function BuzonPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: createFeedback,
    onSuccess: () => {
      setSent(true);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || 'Error al enviar. Intenta de nuevo.');
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      toast.error('Completa todos los campos');
      return;
    }
    mutation.mutate(form);
  };

  if (sent) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <SEO
          title="Buzón de opiniones"
          description="Comparte tu queja, comentario o sugerencia con Triomphe."
          url="/buzon"
        />
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-3">
            ¡Gracias por tu mensaje!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Tu opinión es muy importante para nosotros. La hemos recibido y la revisaremos pronto.
          </p>
          <button
            onClick={() => {
              setSent(false);
              setForm(INITIAL_FORM);
            }}
            className="px-6 py-2.5 bg-blue-900 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors"
          >
            Enviar otro mensaje
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <SEO
        title="Buzón de opiniones"
        description="Comparte tu queja, comentario o sugerencia con Triomphe."
        url="/buzon"
      />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="text-center mb-10"
      >
        <motion.div
          variants={fadeInUp}
          className="w-14 h-14 bg-blue-900 rounded-2xl flex items-center justify-center mx-auto mb-4"
        >
          <MessageSquare size={28} className="text-yellow-400" />
        </motion.div>
        <motion.h1
          variants={fadeInUp}
          className="text-3xl font-bold text-blue-900 dark:text-white mb-2"
        >
          Buzón de opiniones
        </motion.h1>
        <motion.p variants={fadeInUp} className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Comparte tu queja, comentario o sugerencia. Tu opinión nos ayuda a mejorar.
        </motion.p>
      </motion.div>

      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-white dark:bg-[#242938] rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-[#2e3650]"
      >
        {/* Selector de categoría */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {categories.map(({ value, label, description, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, category: value }))}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                form.category === value
                  ? color
                  : 'border-gray-200 dark:border-[#2e3650] text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-[#3a4060]'
              }`}
            >
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs opacity-70 mt-0.5">{description}</p>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Nombre *
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Tu nombre"
                maxLength={100}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Email *
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="tu@email.com"
                maxLength={150}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Asunto *
            </label>
            <input
              name="subject"
              value={form.subject}
              onChange={handleChange}
              placeholder="Describe brevemente el tema"
              maxLength={200}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Mensaje *
            </label>
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              placeholder="Escribe tu mensaje aquí..."
              rows={5}
              maxLength={2000}
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm resize-none bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:placeholder-gray-500"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 text-right mt-1">
              {form.message.length}/2000
            </p>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-900 text-white rounded-xl font-medium text-sm hover:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {mutation.isPending ? 'Enviando...' : 'Enviar mensaje'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
