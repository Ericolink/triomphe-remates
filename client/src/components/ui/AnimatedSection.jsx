import { motion } from 'framer-motion';
import { scrollReveal } from '../../utils/animations';

export default function AnimatedSection({ children, className = '', delay = 0, variant }) {
  return (
    <motion.div
      className={className}
      variants={variant || scrollReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}
