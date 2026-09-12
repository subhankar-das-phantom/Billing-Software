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
  variant = 'primary',
  className = '',
  disabled = false,
  ...rest 
}) {
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs',
    secondary: 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
  };

  const baseStyle = variantClasses[variant] || variantClasses.primary;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`enhanced-btn px-4 py-2.5 rounded-xl font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${baseStyle} ${className}`}
      whileTap={disabled ? {} : { scale: 0.98 }}
      {...rest}
    >
      {Icon && (
        <span className="shrink-0 flex items-center justify-center">
          <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${Icon.name === 'Loader2' ? 'animate-spin' : ''}`} />
        </span>
      )}
      <span>{children}</span>
    </motion.button>
  );
}
