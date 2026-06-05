import { useEffect } from 'react';
import { motion } from 'framer-motion';

export default function WelcomeScreen({ name, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2800);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700"
    >
      {/* Fondo con patrón sutil */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
      />

      <div className="relative flex flex-col items-center gap-8 text-white text-center px-8">
        {/* Logo */}
        <motion.img
          src="/logo.png"
          alt="Triomphe"
          className="h-24 w-auto brightness-0 invert"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />

        {/* Bienvenido */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
          className="space-y-2"
        >
          <p className="text-blue-200 text-lg tracking-widest uppercase font-light">
            Bienvenido de vuelta
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            {name}
          </h1>
        </motion.div>

        {/* Barra de progreso */}
        <motion.div
          className="absolute bottom-[-120px] w-48 h-1 bg-white/20 rounded-full overflow-hidden"
        >
          <motion.div
            className="h-full bg-yellow-400 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.4, delay: 0.4, ease: 'linear' }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
