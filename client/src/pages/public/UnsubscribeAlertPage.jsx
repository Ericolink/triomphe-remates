import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BellOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { unsubscribeAlert } from '../../services/alertService';
import SEO from '../../components/ui/SEO';
import { fadeInUp, fadeIn } from '../../utils/animations';

export default function UnsubscribeAlertPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const { data, error, isLoading } = useQuery({
    queryKey: ['unsubscribe-alert', token],
    queryFn: () => unsubscribeAlert(token),
    enabled: !!token,
    retry: false,
  });

  const errorMessage = error?.response?.data?.error || 'Ocurrió un error al cancelar la alerta. Intenta de nuevo más tarde.';

  return (
    <motion.div
      variants={fadeIn} initial="hidden" animate="visible"
      className="max-w-lg mx-auto px-4 py-20"
    >
      <SEO title="Cancelar alerta" description="Cancela tus alertas de propiedades de Triomphe Bienes Raíces." url="/cancelar-alerta" />

      <motion.div
        variants={fadeInUp} initial="hidden" animate="visible"
        className="bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl shadow-sm p-8 text-center"
      >
        {!token ? (
          <>
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="text-red-500" size={28} />
            </div>
            <h1 className="text-xl font-bold text-blue-900 dark:text-white mb-2">Enlace inválido</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              El enlace de cancelación no incluye un token válido. Verifica que copiaste la URL completa desde tu correo.
            </p>
          </>
        ) : isLoading ? (
          <>
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="text-blue-700 dark:text-blue-400 animate-spin" size={28} />
            </div>
            <h1 className="text-xl font-bold text-blue-900 dark:text-white mb-2">Cancelando tu alerta…</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Un momento, estamos procesando tu solicitud.</p>
          </>
        ) : error ? (
          <>
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="text-red-500" size={28} />
            </div>
            <h1 className="text-xl font-bold text-blue-900 dark:text-white mb-2">No se pudo cancelar la alerta</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{errorMessage}</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="text-green-600" size={28} />
            </div>
            <h1 className="text-xl font-bold text-blue-900 dark:text-white mb-2">Alerta cancelada</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {data?.message || 'Ya no recibirás notificaciones por correo de nuevas propiedades.'}
            </p>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-[#2e3650] flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/propiedades"
            className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors inline-flex items-center justify-center gap-2">
            <BellOff size={16} /> Ver propiedades disponibles
          </Link>
          <Link to="/"
            className="px-5 py-2.5 border border-gray-200 dark:border-[#2e3650] text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-[#1a1f2e] transition-colors inline-flex items-center justify-center">
            Ir al inicio
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
