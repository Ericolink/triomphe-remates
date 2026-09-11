import { Link } from 'react-router-dom';
import { MapPinOff } from 'lucide-react';
import SEO from '../../components/ui/SEO';

export default function NotFoundPage() {
  return (
    <div className="text-center py-32 px-4">
      <SEO title="Página no encontrada" />
      <MapPinOff size={48} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-primary-900 dark:text-white mb-2">
        Página no encontrada
      </h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        La página que buscas no existe o fue movida.
      </p>
      <Link
        to="/propiedades"
        className="inline-block bg-accent-400 dark:bg-accent-500 text-primary-900 px-6 py-3 rounded-xl font-medium hover:bg-accent-300 dark:hover:bg-accent-400 transition-colors"
      >
        Ver propiedades en remate
      </Link>
    </div>
  );
}
