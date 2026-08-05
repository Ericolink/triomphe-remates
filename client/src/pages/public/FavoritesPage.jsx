import { motion } from 'framer-motion';
import { Heart, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import useFavorites from '../../hooks/useFavorites';
import usePropertySync from '../../hooks/usePropertySync';
import PropertyCard from '../../components/ui/PropertyCard';
import UnavailablePropertyCard from '../../components/ui/UnavailablePropertyCard';
import SyncStatusBar from '../../components/ui/SyncStatusBar';
import SEO from '../../components/ui/SEO';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import WhatsAppButton from '../../components/ui/WhatsAppButton';
import { useState } from 'react';
import { fadeInUp, staggerContainer } from '../../utils/animations';

export default function FavoritesPage() {
  const { favorites, clear, remove, patchMany } = useFavorites();
  const { items, syncState, retry } = usePropertySync(favorites, { onUpdate: patchMany });
  const count = items.length;
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <SEO
        title="Mis favoritos"
        description="Propiedades guardadas en tu lista de favoritos."
        url="/favoritos"
      />

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="mb-10">
        <motion.div variants={fadeInUp} className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary-900 dark:text-white flex items-center gap-3">
              <Heart size={28} className="text-red-500" fill="currentColor" />
              Mis favoritos
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {count === 0
                ? 'No tienes propiedades guardadas'
                : `${count} propiedad${count !== 1 ? 'es' : ''} guardada${count !== 1 ? 's' : ''}`}
            </p>
          </div>
          {count > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={16} /> Limpiar lista
            </motion.button>
          )}
        </motion.div>
      </motion.div>

      <SyncStatusBar syncState={syncState} onRetry={retry} />

      {count === 0 ? (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="text-center py-24 text-gray-400 dark:text-gray-500"
        >
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5, repeat: Infinity }}>
            <Heart size={56} className="mx-auto mb-4 opacity-20" />
          </motion.div>
          <p className="text-lg font-medium mb-2">Aún no guardas ninguna propiedad</p>
          <p className="text-sm mb-8">
            Presiona el ícono <Heart size={14} className="inline" /> en cualquier propiedad para
            guardarla aquí.
          </p>
          <Link
            to="/propiedades"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent-400 text-primary-900 rounded-xl text-sm font-medium hover:bg-accent-300 transition-colors"
          >
            Ver propiedades
          </Link>
        </motion.div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {items.map((property) => (
            <motion.div key={property.id} variants={fadeInUp}>
              {property.unavailable ? (
                <UnavailablePropertyCard
                  title={property.title}
                  onRemove={() => remove(property.id)}
                />
              ) : (
                <PropertyCard property={property} />
              )}
            </motion.div>
          ))}
        </motion.div>
      )}

      {count > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-12 rounded-2xl bg-primary-900 dark:bg-primary-950 px-6 py-10 sm:px-12 text-center"
        >
          <h2 className="text-2xl font-bold text-white mb-3">
            ¿Encontraste una propiedad que te interesa?
          </h2>
          <p className="text-primary-100 dark:text-gray-300 max-w-xl mx-auto mb-6">
            Nuestro equipo puede ayudarte a resolver tus dudas, brindarte más información y
            acompañarte durante todo el proceso de compra. Contáctanos y recibe atención
            personalizada.
          </p>
          <WhatsAppButton
            message="Hola, encontré algunas propiedades en mis favoritos y me gustaría recibir más información."
            label="Hablar por WhatsApp"
            className="inline-flex w-auto mx-auto px-8 py-4 text-base"
          />
        </motion.div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="¿Limpiar lista de favoritos?"
        message="Se eliminarán todas las propiedades guardadas. Esta acción no se puede deshacer."
        confirmLabel="Limpiar"
        onConfirm={() => {
          clear();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
