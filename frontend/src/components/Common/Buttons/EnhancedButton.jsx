import { motion } from 'framer-motion';

/**
 * EnhancedButton - A premium animated button component with gradient background
 * Perfect for primary actions like "Add Product", "Add Customer", etc.
 * 
 * @param {Object} props
 * @param {Function} props.onClick - Click handler
 * @param {React.ReactNode} props.icon - Icon component (typically from lucide-react)
 * @param {string} props.children - Button text
 * @param {string} props.type - Button type (button, submit, reset) - defaults to 'button'
 * @param {string} props.className - Additional CSS classes (optional)
 * @param {boolean} props.disabled - Disabled state (optional)
 */
export default function EnhancedButton({ 
  onClick, 
  icon: Icon, 
  children, 
  type = 'button',
  className = '',
  disabled = false,
  ...rest 
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`relative overflow-hidden px-6 py-3 rounded-xl font-semibold text-white flex items-center gap-2 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
      }}
      whileHover={disabled ? {} : { scale: 1.05, y: -2 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      {...rest}
    >
      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.6 }}
      />
      
      {/* Background glow on hover */}
      <motion.div
        className="absolute inset-0 bg-white"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 0.15 }}
        transition={{ duration: 0.3 }}
      />
      
      {/* Icon with rotation animation */}
      {Icon && (
        <motion.div
          whileHover={disabled ? {} : { rotate: 90 }}
          animate={Icon.name === 'Loader2' ? { rotate: 360 } : {}}
          transition={
            Icon.name === 'Loader2' 
              ? { duration: 1, repeat: Infinity, ease: 'linear' }
              : { duration: 0.3 }
          }
          className="relative z-10"
        >
          <Icon className="w-5 h-5" />
        </motion.div>
      )}
      
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
