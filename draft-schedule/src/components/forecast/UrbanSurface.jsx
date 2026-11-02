import { motion, useReducedMotion } from 'motion/react'

export default function UrbanSurface({ children, className = '', order = 0, ...props }) {
  const reduced = useReducedMotion()
  return <motion.section className={`urban-surface ${className}`} initial={reduced ? false : { opacity: 0, y: -22 }}
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.08 }}
    transition={{ duration: reduced ? 0 : .58, delay: reduced ? 0 : Math.min(order, 7) * .085, ease: [.22, 1, .36, 1] }} {...props}>{children}</motion.section>
}
