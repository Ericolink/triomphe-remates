import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Building2, TrendingDown, Shield, ChevronRight, MapPin, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  getProperties,
  getPromotedProperty,
  getPropertyStats,
} from '../../services/propertyService';
import { getPublicTestimonials } from '../../services/testimonialService';
import PropertyCard from '../../components/ui/PropertyCard';
import { PropertyCardSkeletonGrid } from '../../components/ui/PropertyCardSkeleton';
import PromotedPropertyBanner from '../../components/ui/PromotedPropertyBanner';
import SEO from '../../components/ui/SEO';
import AnimatedSection from '../../components/ui/AnimatedSection';
import { fadeInUp, staggerContainer, buttonHover, buttonTap } from '../../utils/animations';
import { buildImageUrl } from '../../utils/images';
import { CITY_LABELS, BUSINESS_LINE_CONTENT } from '../../utils/constants';

// La página principal se mantiene enfocada en remates bancarios (la propuesta de valor
// principal del negocio) — el resto de las líneas se navegan desde /propiedades, ver TabBar
// ahí. `content` sigue leyendo de BUSINESS_LINE_CONTENT (no hardcodeado inline) para no
// duplicar copy si en el futuro el home necesita variar por algún otro criterio.
const businessLine = 'remate';

export default function HomePage() {
  const navigate = useNavigate();
  const content = BUSINESS_LINE_CONTENT[businessLine];
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['properties', 'featured', businessLine],
    queryFn: () => getProperties({ featured: true, limit: 6, businessLine }),
  });

  const { data: promotedData } = useQuery({
    queryKey: ['property', 'promoted', businessLine],
    queryFn: () => getPromotedProperty({ businessLine }),
  });

  const { data: stats } = useQuery({
    queryKey: ['property-stats', businessLine],
    queryFn: () => getPropertyStats({ businessLine }),
  });

  const { data: testimonialsData } = useQuery({
    queryKey: ['testimonials', 'public'],
    queryFn: () => getPublicTestimonials({ limit: 6 }),
  });
  const testimonials = testimonialsData?.data || [];

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (city) params.set('city', city);
    navigate(`${content.listingPath}?${params.toString()}`);
  };

  return (
    <div>
      <SEO title={content.seoTitle} description={content.seoDescription} url="/" />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 dark:from-primary-950 dark:via-primary-900 dark:to-[#1a1f2e] text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 py-24 text-center">
          <motion.div variants={staggerContainer} initial="hidden" animate="visible">
            <motion.h1
              variants={fadeInUp}
              className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 leading-tight"
            >
              {content.heroTitle}
              <br />
              <span className="text-accent-400">{content.heroTitleAccent}</span>
            </motion.h1>

            <motion.div
              variants={fadeInUp}
              className="inline-flex items-center gap-2 bg-accent-400 text-primary-900 text-sm font-semibold px-4 py-1.5 rounded-full mb-6"
            >
              <TrendingDown size={16} />
              {content.heroBadge}
            </motion.div>

            {/* Copy de apoyo bajo el H1 — texto explicativo, deliberadamente más chico
                que el título para no competir con él ni retrasar la llegada al buscador. */}
            <motion.p
              variants={fadeInUp}
              className="text-lg md:text-xl font-medium text-white mb-8 max-w-3xl mx-auto leading-snug"
            >
              {content.heroSlogan}
            </motion.p>

            <motion.p
              variants={fadeInUp}
              className="text-base md:text-lg font-semibold text-accent-300 mb-2 max-w-2xl mx-auto"
            >
              Contamos con inventario a nivel nacional.
            </motion.p>

            <motion.p
              variants={fadeInUp}
              className="text-lg text-primary-100 mb-10 max-w-2xl mx-auto"
            >
              Visita nuestras secciones de Chihuahua, Cd. Juárez y Querétaro, próximamente más.
            </motion.p>

            <motion.form
              variants={fadeInUp}
              onSubmit={handleSearch}
              className="bg-white dark:bg-[#242938] rounded-2xl p-3 max-w-2xl mx-auto flex flex-col sm:flex-row gap-3 shadow-2xl border border-transparent dark:border-[#2e3650]"
            >
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#2e3650] text-gray-700 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e]"
              >
                <option value="">Todas las ciudades</option>
                <option value="juarez">Cd. Juárez</option>
                <option value="chihuahua">Chihuahua</option>
                <option value="queretaro">Querétaro</option>
              </select>
              <input
                type="text"
                placeholder="Buscar por colonia, dirección..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-200 text-sm focus:outline-none bg-transparent dark:placeholder-gray-500"
              />
              <motion.button
                type="submit"
                whileHover={buttonHover}
                whileTap={buttonTap}
                className="bg-accent-400 dark:bg-accent-500 text-primary-900 px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-accent-300 dark:hover:bg-accent-400 transition-colors"
              >
                <Search size={18} /> Buscar
              </motion.button>
            </motion.form>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <motion.section
        className="bg-accent-400 dark:bg-accent-500 py-8"
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
            { label: 'Propiedades activas', value: stats?.total ? `${stats.total}+` : '...' },
            { label: 'Ciudades', value: '3' },
            { label: 'Inventario disponible en todo México.', value: 'Nacional' },
            { label: 'Clientes satisfechos', value: '500+' },
          ].map(({ label, value }) => (
            <motion.div key={label} variants={fadeInUp} className="text-primary-900">
              <p className="text-3xl font-bold">{value}</p>
              <p className="text-sm font-medium opacity-80">{label}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="max-w-7xl mx-auto px-4 mt-8 text-center"
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.button
            onClick={() => navigate('/contacto')}
            whileHover={buttonHover}
            whileTap={buttonTap}
            className="bg-primary-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-primary-800 transition-colors"
          >
            Contáctanos
          </motion.button>
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
            <h2 className="text-3xl font-bold text-primary-900 dark:text-white">
              Propiedades Destacadas
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Las mejores oportunidades del momento
            </p>
          </div>
          <motion.button
            onClick={() => navigate(content.listingPath)}
            className="hidden md:flex items-center gap-2 text-primary-700 dark:text-primary-400 font-medium"
            whileHover={{ x: 4 }}
            transition={{ duration: 0.2 }}
          >
            Ver todas las propiedades <ChevronRight size={18} />
          </motion.button>
        </AnimatedSection>

        {isLoading ? (
          <PropertyCardSkeletonGrid
            count={3}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          />
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
            onClick={() => navigate(content.listingPath)}
            className="bg-accent-400 dark:bg-accent-500 text-primary-900 px-8 py-3 rounded-xl font-medium hover:bg-accent-300 dark:hover:bg-accent-400 transition-colors"
            whileHover={buttonHover}
            whileTap={buttonTap}
          >
            Ver todas las propiedades
          </motion.button>
        </AnimatedSection>
      </section>

      {/* Por qué nosotros */}
      <section className="bg-gray-50 dark:bg-[#242938] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-primary-900 dark:text-white text-center mb-12">
              ¿Por qué elegirnos?
            </h2>
          </AnimatedSection>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {[
              {
                icon: <TrendingDown size={32} className="text-accent-500" />,
                title: 'Precios de Remate',
                desc: 'Propiedades del 30% al 70% más baratas que el valor comercial. La mejor inversión del mercado.',
              },
              {
                icon: <Shield size={32} className="text-accent-500" />,
                title: 'Proceso Seguro',
                desc: 'Te acompañamos todo el proceso legal y notarial. Tu inversión está protegida.',
              },
              {
                icon: <Building2 size={32} className="text-accent-500" />,
                title: 'Amplio Inventario',
                desc: 'Casas, departamentos, terrenos y locales en toda la república.',
              },
            ].map(({ icon, title, desc }) => (
              <motion.div
                key={title}
                variants={fadeInUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="bg-white dark:bg-[#1a1f2e] rounded-2xl p-8 shadow-md dark:shadow-none border border-transparent dark:border-[#2e3650] text-center cursor-default"
              >
                <motion.div
                  className="flex justify-center mb-4"
                  whileHover={{ scale: 1.15, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  {icon}
                </motion.div>
                <h3 className="text-xl font-bold text-primary-900 dark:text-white mb-3">{title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Historias de Éxito */}
      {testimonials.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-16">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-primary-900 dark:text-white text-center mb-12">
              Historias de Éxito
            </h2>
          </AnimatedSection>
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            {testimonials.map((t) => (
              <motion.div
                key={t.id}
                variants={fadeInUp}
                className="bg-white dark:bg-[#1a1f2e] rounded-2xl p-6 shadow-md dark:shadow-none border border-transparent dark:border-[#2e3650] flex flex-col"
              >
                {(t.beforeImageUrl || t.afterImageUrl) && (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {t.beforeImageUrl && (
                      <div className="relative">
                        <img
                          src={buildImageUrl(t.beforeImageUrl, 300)}
                          alt={`Antes - ${t.clientName}`}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-32 object-cover rounded-xl"
                        />
                        <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                          Antes
                        </span>
                      </div>
                    )}
                    {t.afterImageUrl && (
                      <div className="relative">
                        <img
                          src={buildImageUrl(t.afterImageUrl, 300)}
                          alt={`Después - ${t.clientName}`}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-32 object-cover rounded-xl"
                        />
                        <span className="absolute top-2 left-2 bg-accent-500 text-primary-900 text-xs px-2 py-0.5 rounded-full font-medium">
                          Después
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1 mb-3 text-accent-500">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </div>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed flex-1">
                  &ldquo;{t.testimonialText}&rdquo;
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#2e3650]">
                  <p className="font-bold text-primary-900 dark:text-white">{t.clientName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t.clientRole}
                    {t.clientRole && t.clientCity && ' · '}
                    {t.clientCity && CITY_LABELS[t.clientCity]}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* CTA */}
      <AnimatedSection>
        <section className="bg-primary-900 dark:bg-primary-950 text-white py-16 text-center">
          <div className="max-w-2xl mx-auto px-4">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <MapPin size={40} className="text-accent-400 mx-auto mb-4" />
            </motion.div>
            <h2 className="text-3xl font-bold mb-4">{content.ctaText}</h2>
            <p className="text-primary-200 dark:text-gray-400 mb-8">
              Agenda una cita con nuestros asesores y te ayudamos en todo el proceso.
            </p>
            <motion.button
              onClick={() => navigate('/contacto')}
              className="bg-accent-400 text-primary-900 px-10 py-4 rounded-xl font-bold text-lg hover:bg-accent-300 transition-colors"
              whileHover={buttonHover}
              whileTap={buttonTap}
            >
              Contactar un asesor
            </motion.button>
          </div>
        </section>
      </AnimatedSection>
    </div>
  );
}
