import { motion } from 'framer-motion';
import { Loader2, LoaderCircle, RotateCw } from 'lucide-react';

export default function Loader({ 
  size = 'md', 
  className = '',
  variant = 'spinner' // 'spinner', 'dots', 'pulse', 'bounce'
}) {
  const sizes = {
    sm: { container: 'w-5 h-5', icon: 16, dot: 'w-1.5 h-1.5' },
    md: { container: 'w-8 h-8', icon: 24, dot: 'w-2 h-2' },
    lg: { container: 'w-12 h-12', icon: 36, dot: 'w-3 h-3' }
  };

  const sizeConfig = sizes[size];

  // Spinner variant with icon rotation
  if (variant === 'spinner') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear'
          }}
        >
          <Loader2 
            className="text-blue-500" 
            size={sizeConfig.icon}
            strokeWidth={2.5}
          />
        </motion.div>
      </div>
    );
  }

  // Circular loading with gradient effect
  if (variant === 'circle') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: 'linear'
          }}
        >
          <LoaderCircle 
            className="text-blue-500" 
            size={sizeConfig.icon}
            strokeWidth={2.5}
          />
        </motion.div>
      </div>
    );
  }

  // Animated dots loader
  if (variant === 'dots') {
    const dotVariants = {
      initial: { y: 0 },
      animate: { y: -8 }
    };

    return (
      <div className={`flex items-center justify-center gap-1.5 ${className}`}>
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className={`${sizeConfig.dot} bg-blue-500 rounded-full`}
            variants={dotVariants}
            initial="initial"
            animate="animate"
            transition={{
              duration: 0.6,
              repeat: Infinity,
              repeatType: 'reverse',
              delay: index * 0.15,
              ease: 'easeInOut'
            }}
          />
        ))}
      </div>
    );
  }

  // Pulse loader
  if (variant === 'pulse') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <motion.div
          className={`${sizeConfig.container} bg-blue-500 rounded-full`}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.7, 1, 0.7]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      </div>
    );
  }

  // Bounce loader (orbiting dots)
  if (variant === 'bounce') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className={`relative ${sizeConfig.container}`}>
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className={`absolute top-1/2 left-1/2 ${sizeConfig.dot} bg-blue-500 rounded-full`}
              animate={{
                x: [0, 15, 0, -15, 0],
                y: [0, -15, 0, 15, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: index * 0.2,
                ease: 'easeInOut'
              }}
              style={{ marginLeft: '-4px', marginTop: '-4px' }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Default fallback
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear'
        }}
      >
        <RotateCw className="text-blue-500" size={sizeConfig.icon} />
      </motion.div>
    </div>
  );
}

export function PageLoader({ 
  variant = 'spinner',
  message = 'Loading...',
  showIcon = true 
}) {
  return (
    <motion.div 
      className="flex items-center justify-center min-h-[400px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center">
        {showIcon && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              delay: 0.1,
              type: 'spring',
              stiffness: 200
            }}
          >
            <Loader size="lg" variant={variant} className="mb-4" />
          </motion.div>
        )}
        
        <motion.p 
          className="text-slate-400 font-medium"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          {message}
        </motion.p>

        {/* Optional animated dots after text */}
        <motion.div 
          className="flex justify-center gap-1 mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className="w-1 h-1 bg-slate-500 rounded-full"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: index * 0.2
              }}
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// Bonus: Skeleton Loader Component
export function SkeletonLoader({ 
  lines = 3, 
  className = '' 
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <motion.div
          key={index}
          className="h-4 bg-slate-700/50 rounded overflow-hidden"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: index * 0.1,
            ease: 'easeInOut'
          }}
          style={{ width: index === lines - 1 ? '70%' : '100%' }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-transparent via-slate-600/30 to-transparent"
            animate={{ x: [-300, 300] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear'
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}
