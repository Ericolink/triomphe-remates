import { useId, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { BellOff, CheckCircle2, XCircle, Loader2, Save } from 'lucide-react';
import { getAlertByToken, updateAlertByToken } from '../../services/alertService';
import AlertCriteriaFields from '../../components/ui/AlertCriteriaFields';
import SEO from '../../components/ui/SEO';
import { fadeInUp, fadeIn } from '../../utils/animations';

const StatusCard = ({ icon, tone, title, children }) => {
  const toneCls = {
    red: 'bg-red-100 dark:bg-red-900/20 text-red-500',
    blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
    amber: 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
  }[tone];

  return (
    <>
      <div className={`w-14 h-14 ${toneCls} rounded-full flex items-center justify-center mx-auto mb-4`}>
        {icon}
      </div>
      <h1 className="text-xl font-bold text-primary-900 dark:text-white mb-2">{title}</h1>
      <div className="text-gray-500 dark:text-gray-400 text-sm">{children}</div>
    </>
  );
};

// Solo se monta una vez que `alert` ya llegó del backend, así que su estado puede
// inicializarse en el primer render (lazy useState) en vez de sincronizarlo desde props
// con un efecto — evita el doble render de setState-en-effect.
const AlertEditForm = ({ alert, token, onSaved }) => {
  const formId = useId();
  const [form, setForm] = useState(() => ({
    name: alert.name || '',
    phone: alert.phone || '',
    city: alert.city || '',
    type: alert.type || '',
    minPrice: alert.minPrice ? String(alert.minPrice) : '',
    maxPrice: alert.maxPrice ? String(alert.maxPrice) : '',
  }));

  const mutation = useMutation({
    mutationFn: (criteria) => updateAlertByToken(token, criteria),
    onSuccess: () => {
      onSaved(true);
      toast.success('Alerta actualizada correctamente');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al actualizar la alerta'),
  });

  const handleChange = (e) => {
    onSaved(false);
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Nombre y teléfono son requeridos');
      return;
    }
    mutation.mutate({
      ...form,
      minPrice: form.minPrice || undefined,
      maxPrice: form.maxPrice || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <AlertCriteriaFields form={form} onChange={handleChange} formId={formId} />
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent-400 text-primary-900 rounded-xl text-sm font-medium hover:bg-accent-300 transition-colors disabled:opacity-60"
      >
        {mutation.isPending ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Save size={15} />
        )}
        {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  );
};

export default function ManageAlertPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [saved, setSaved] = useState(false);

  const { data, error, isLoading } = useQuery({
    queryKey: ['manage-alert', token],
    queryFn: () => getAlertByToken(token),
    enabled: !!token,
    retry: false,
  });

  const alert = data?.data;

  const errorMessage =
    error?.response?.status === 404
      ? 'No encontramos una alerta con este enlace. Verifica que copiaste la URL completa desde tu correo.'
      : error?.response?.data?.error || 'Ocurrió un error al cargar tu alerta. Intenta de nuevo más tarde.';

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className="max-w-lg mx-auto px-4 py-20"
    >
      <SEO
        title="Modificar mi alerta"
        description="Administra los criterios de tu alerta de propiedades de Triomphe Bienes Raíces."
        url="/mi-alerta"
      />

      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl shadow-sm p-8"
      >
        {!token ? (
          <div className="text-center">
            <StatusCard icon={<XCircle size={28} />} tone="red" title="Enlace inválido">
              El enlace no incluye un token válido. Verifica que copiaste la URL completa desde tu
              correo.
            </StatusCard>
          </div>
        ) : isLoading ? (
          <div className="text-center">
            <StatusCard icon={<Loader2 className="animate-spin" size={28} />} tone="blue" title="Cargando tu alerta…">
              Un momento, estamos obteniendo tus criterios actuales.
            </StatusCard>
          </div>
        ) : error ? (
          <div className="text-center">
            <StatusCard icon={<XCircle size={28} />} tone="red" title="No se pudo cargar la alerta">
              {errorMessage}
            </StatusCard>
          </div>
        ) : alert && !alert.isActive ? (
          <div className="text-center">
            <StatusCard icon={<BellOff size={28} />} tone="amber" title="Esta alerta ya no está activa">
              Esta alerta fue cancelada previamente, así que ya no puede modificarse. Si quieres
              volver a recibir avisos, crea una nueva alerta desde el catálogo de propiedades.
            </StatusCard>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-primary-900 dark:text-white mb-1 text-center">
              Modificar mi alerta
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 text-center">
              Alerta asociada a <strong>{alert.email}</strong>
            </p>

            {saved && (
              <div className="mb-4 flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-3">
                <CheckCircle2 size={16} /> Tu alerta fue actualizada correctamente.
              </div>
            )}

            <AlertEditForm alert={alert} token={token} onSaved={setSaved} />

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-[#2e3650] text-center">
              <Link
                to={`/cancelar-alerta?token=${token}`}
                className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                Cancelar esta alerta
              </Link>
            </div>
          </>
        )}

        {(!token || error || (alert && !alert.isActive)) && (
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-[#2e3650] flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/propiedades"
              className="px-5 py-2.5 bg-accent-400 hover:bg-accent-300 text-primary-900 text-sm font-medium rounded-xl transition-colors inline-flex items-center justify-center gap-2"
            >
              <BellOff size={16} /> Ver propiedades disponibles
            </Link>
            <Link
              to="/"
              className="px-5 py-2.5 border border-gray-200 dark:border-[#2e3650] text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-[#1a1f2e] transition-colors inline-flex items-center justify-center"
            >
              Ir al inicio
            </Link>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
