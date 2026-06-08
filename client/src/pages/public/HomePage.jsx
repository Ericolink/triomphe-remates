import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Building2, TrendingDown, Shield, ChevronRight, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { getProperties, getPromotedProperty } from '../../services/propertyService';
import PropertyCard from '../../components/ui/PropertyCard';
import { PropertyCardSkeletonGrid } from '../../components/ui/PropertyCardSkeleton';
import PromotedPropertyBanner from '../../components/ui/PromotedPropertyBanner';
import SEO from '../../components/ui/SEO';
import AnimatedSection from '../../components/ui/AnimatedSection';
import { fadeInUp, staggerContainer, buttonHover, buttonTap } from '../../utils/animations';

export default function HomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['properties', 'featured'],
    queryFn: () => getProperties({ featured: true, limit: 6 }),
  });

  const { data: promotedData } = useQuery({
    queryKey: ['property', 'promoted'],
    queryFn: getPromotedProperty,
  });

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (city) params.set('city', city);
    navigate(`/propiedades?${params.toString()}`);
  };

  return (
    <div>
      <SEO
        title="Remates Bancarios en México"
        description="Encuentra propiedades en remate bancario en Chihuahua, Ciudad Juárez y Querétaro. Casas, departamentos y terrenos hasta 40% por debajo del valor comercial."
        url="/"
      />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 dark:from-[#0f1621] dark:via-blue-950 dark:to-[#1a1f2e] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
        />
        <div className="relative max-w-7xl mx-auto px-4 py-24 text-center">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeInUp}
              className="inline-flex items-center gap-2 bg-yellow-400 text-blue-900 text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
              <TrendingDown size={16} />
              Precios hasta 40% por debajo del mercado
            </motion.div>

            <motion.h1 variants={fadeInUp}
              className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Remates Bancarios<br />
              <span className="text-yellow-400">en México</span>
            </motion.h1>

            <motion.p variants={fadeInUp}
              className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
              Encuentra propiedades a precios de remate en Chihuahua, Ciudad Juárez y Querétaro.
            </motion.p>

            <motion.form variants={fadeInUp} onSubmit={handleSearch}
              className="bg-white dark:bg-[#242938] rounded-2xl p-3 max-w-2xl mx-auto flex flex-col sm:flex-row gap-3 shadow-2xl border border-transparent dark:border-[#2e3650]">
              <select value={city} onChange={(e) => setCity(e.target.value)}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#2e3650] text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e]">
                <option value="">Todas las ciudades</option>
                <option value="juarez">Cd. Juárez</option>
                <option value="chihuahua">Chihuahua</option>
                <option value="queretaro">Querétaro</option>
              </select>
              <input type="text" placeholder="Buscar por colonia, dirección..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-200 text-sm focus:outline-none bg-transparent dark:placeholder-gray-500" />
              <motion.button type="submit" whileHover={buttonHover} whileTap={buttonTap}
                className="bg-blue-900 dark:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors">
                <Search size={18} /> Buscar
              </motion.button>
            </motion.form>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <motion.section
        className="bg-yellow-400 dark:bg-yellow-500 py-8"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {[
            { label: 'Propiedades activas', value: '146+' },
            { label: 'Ciudades', value: '3' },
            { label: 'Años de experiencia', value: '10+' },
            { label: 'Clientes satisfechos', value: '500+' },
          ].map(({ label, value }) => (
            <motion.div key={label} variants={fadeInUp} className="text-blue-900">
              <p className="text-3xl font-bold">{value}</p>
              <p className="text-sm font-medium opacity-80">{label}</p>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* Propiedad estrella */}
      {promotedData?.data && (
        <AnimatedSection>
          <PromotedPropertyBanner property={promotedData.data} />
        </AnimatedSection>
      )}

      {/* Propiedades destacadas */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <AnimatedSection className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-blue-900 dark:text-white">Propiedades Destacadas</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Las mejores oportunidades del momento</p>
          </div>
          <motion.button
            onClick={() => navigate('/propiedades')}
            className="hidden md:flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium"
            whileHover={{ x: 4 }}
            transition={{ duration: 0.2 }}
          >
            Ver todas <ChevronRight size={18} />
          </motion.button>
        </AnimatedSection>

        {isLoading ? (
          <PropertyCardSkeletonGrid count={3} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" />
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            {data?.data?.map((property) => (
              <motion.div key={property.id} variants={fadeInUp}>
                <PropertyCard property={property} />
              </motion.div>
            ))}
          </motion.div>
        )}

        <AnimatedSection className="text-center mt-10 md:hidden">
          <motion.button
            onClick={() => navigate('/propiedades')}
            className="bg-blue-900 dark:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
            whileHover={buttonHover} whileTap={buttonTap}
          >
            Ver todas las propiedades
          </motion.button>
        </AnimatedSection>
      </section>

      {/* Por qué nosotros */}
      <section className="bg-gray-50 dark:bg-[#242938] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-blue-900 dark:text-white text-center mb-12">¿Por qué elegirnos?</h2>
          </AnimatedSection>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {[
              { icon: <TrendingDown size={32} className="text-yellow-500" />, title: 'Precios de Remate', desc: 'Propiedades hasta un 40% más baratas que el valor comercial. La mejor inversión del mercado.' },
              { icon: <Shield size={32} className="text-yellow-500" />, title: 'Proceso Seguro', desc: 'Acompañamos todo el proceso legal y notarial. Tu inversión está protegida.' },
              { icon: <Building2 size={32} className="text-yellow-500" />, title: 'Amplio Inventario', desc: 'Casas, departamentos, terrenos y locales en las principales ciudades del norte.' },
            ].map(({ icon, title, desc }) => (
              <motion.div key={title} variants={fadeInUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="bg-white dark:bg-[#1a1f2e] rounded-2xl p-8 shadow-md dark:shadow-none border border-transparent dark:border-[#2e3650] text-center cursor-default">
                <motion.div className="flex justify-center mb-4"
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  transition={{ duration: 0.2 }}>
                  {icon}
                </motion.div>
                <h3 className="text-xl font-bold text-blue-900 dark:text-white mb-3">{title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <AnimatedSection>
        <section className="bg-blue-900 dark:bg-[#0f1621] text-white py-16 text-center">
          <div className="max-w-2xl mx-auto px-4">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <MapPin size={40} className="text-yellow-400 mx-auto mb-4" />
            </motion.div>
            <h2 className="text-3xl font-bold mb-4">¿Te interesa alguna propiedad?</h2>
            <p className="text-blue-200 dark:text-gray-400 mb-8">Agenda una cita con nuestros asesores y te ayudamos en todo el proceso.</p>
            <motion.button
              onClick={() => navigate('/contacto')}
              className="bg-yellow-400 text-blue-900 px-10 py-4 rounded-xl font-bold text-lg hover:bg-yellow-300 transition-colors"
              whileHover={buttonHover} whileTap={buttonTap}
            >
              Contactar un asesor
            </motion.button>
          </div>
        </section>
      </AnimatedSection>
    </div>
  );
}
