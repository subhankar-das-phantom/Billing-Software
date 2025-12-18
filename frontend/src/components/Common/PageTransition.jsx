import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useMotionConfig } from '../../hooks';

// Multiple transition variants for different pages
const transitionVariants = {
  // Fade and slide up (default)
  fadeUp: {
    initial: { opacity: 0, y: 20 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -20 }
  },

  // Fade and slide from side
  slideRight: {
    initial: { opacity: 0, x: -50 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: 50 }
  },

  slideLeft: {
    initial: { opacity: 0, x: 50 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: -50 }
  },

  // Zoom and fade
  zoom: {
    initial: { opacity: 0, scale: 0.95 },
    in: { opacity: 1, scale: 1 },
    out: { opacity: 0, scale: 1.05 }
  },

  // Scale down
  scaleDown: {
    initial: { opacity: 0, scale: 1.1 },
    in: { opacity: 1, scale: 1 },
    out: { opacity: 0, scale: 0.9 }
  },

  // Flip effect
  flip: {
    initial: { opacity: 0, rotateX: -90, transformPerspective: 1000 },
    in: { opacity: 1, rotateX: 0, transformPerspective: 1000 },
    out: { opacity: 0, rotateX: 90, transformPerspective: 1000 }
  },

  // Slide and rotate
  rotate: {
    initial: { opacity: 0, rotate: -5, y: 20 },
    in: { opacity: 1, rotate: 0, y: 0 },
    out: { opacity: 0, rotate: 5, y: -20 }
  },

  // Blur effect
  blur: {
    initial: { opacity: 0, filter: 'blur(10px)' },
    in: { opacity: 1, filter: 'blur(0px)' },
    out: { opacity: 0, filter: 'blur(10px)' }
  },

  // Stack/Layer effect
  stack: {
    initial: { opacity: 0, y: 50, scale: 0.95 },
    in: { opacity: 1, y: 0, scale: 1 },
    out: { opacity: 0, y: -50, scale: 1.05 }
  }
};

// Desktop transition configurations (richer, longer)
const desktopConfigs = {
  default: { type: 'tween', ease: 'anticipate', duration: 0.5 },
  spring: { type: 'spring', stiffness: 300, damping: 30 },
  smooth: { type: 'tween', ease: [0.43, 0.13, 0.23, 0.96], duration: 0.6 },
  bouncy: { type: 'spring', stiffness: 400, damping: 20 },
  slow: { type: 'tween', ease: 'easeInOut', duration: 0.8 },
  fast: { type: 'tween', ease: 'easeOut', duration: 0.3 }
};

// Mobile transition configurations (snappier, efficient)
const mobileConfigs = {
  default: { type: 'tween', ease: 'easeOut', duration: 0.25 },
  spring: { type: 'spring', stiffness: 400, damping: 35 },
  smooth: { type: 'tween', ease: [0.25, 0.1, 0.25, 1], duration: 0.3 },
  bouncy: { type: 'spring', stiffness: 450, damping: 28 },
  slow: { type: 'tween', ease: 'easeInOut', duration: 0.4 },
  fast: { type: 'tween', ease: 'easeOut', duration: 0.15 }
};

// Get transition config based on device
const getTransitionConfig = (transition, isMobile) => {
  const configs = isMobile ? mobileConfigs : desktopConfigs;
  return configs[transition] || configs.default;
};

const PageTransition = ({ 
  children, 
  className = '',
  variant = 'fadeUp', // 'fadeUp', 'slideRight', 'slideLeft', 'zoom', etc.
  transition = 'default', // 'default', 'spring', 'smooth', 'bouncy', 'slow', 'fast'
  delay = 0,
  showLoadingIndicator = false
}) => {
  const motionConfig = useMotionConfig();
  
  // Use simpler variants on mobile for better performance
  const getVariant = () => {
    // On mobile, simplify complex variants to basic fade
    if (motionConfig.isMobile && ['flip', 'blur', 'rotate'].includes(variant)) {
      return transitionVariants.fadeUp;
    }
    return transitionVariants[variant] || transitionVariants.fadeUp;
  };
  
  const selectedVariant = getVariant();
  const selectedTransition = {
    ...getTransitionConfig(transition, motionConfig.isMobile),
    delay
  };

  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={selectedVariant}
      transition={selectedTransition}
      className={`relative ${className}`}
    >
      {showLoadingIndicator && (
        <motion.div
          className="absolute top-0 left-0 right-0 h-1 bg-blue-500 origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          exit={{ scaleX: 0 }}
          transition={{ duration: motionConfig.isMobile ? 0.3 : 0.5 }}
        />
      )}
      {children}
    </motion.div>
  );
};

// Route-aware page transition wrapper
export const RouteTransition = ({ 
  children, 
  location,
  variant = 'fadeUp',
  transition = 'default'
}) => {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition
        key={location.pathname}
        variant={variant}
        transition={transition}
      >
        {children}
      </PageTransition>
    </AnimatePresence>
  );
};

// Staggered container for page content
export const StaggerContainer = ({ 
  children, 
  stagger = 0.1,
  className = '' 
}) => {
  const containerVariants = {
    initial: { opacity: 0 },
    in: {
      opacity: 1,
      transition: {
        staggerChildren: stagger,
        delayChildren: 0.1
      }
    },
    out: {
      opacity: 0,
      transition: {
        staggerChildren: 0.05,
        staggerDirection: -1
      }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="in"
      exit="out"
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Individual staggered item
export const StaggerItem = ({ children, className = '' }) => {
  const itemVariants = {
    initial: { opacity: 0, y: 20 },
    in: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 24
      }
    },
    out: { opacity: 0, y: -20 }
  };

  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
};

// Page with header transition
export const PageWithHeader = ({ 
  title, 
  subtitle,
  icon: Icon,
  children,
  variant = 'fadeUp',
  className = ''
}) => {
  return (
    <PageTransition variant={variant} className={className}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="mb-8"
      >
        {Icon && (
          <motion.div
            className="inline-flex p-3 bg-blue-500/10 rounded-lg mb-4"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              type: 'spring',
              stiffness: 200,
              delay: 0.3
            }}
          >
            <Icon className="w-8 h-8 text-blue-400" />
          </motion.div>
        )}
        
        <h1 className="text-4xl font-bold text-white mb-2">{title}</h1>
        
        {subtitle && (
          <motion.p
            className="text-slate-400 text-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {subtitle}
          </motion.p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {children}
      </motion.div>
    </PageTransition>
  );
};

// Loading transition overlay
export const LoadingTransition = ({ isLoading }) => {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="inline-block mb-4"
            >
              <Loader2 className="w-12 h-12 text-blue-500" />
            </motion.div>
            <p className="text-slate-300 font-medium">Loading...</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Direction-aware transition (for next/prev navigation)
export const DirectionalTransition = ({ 
  children, 
  direction = 'forward', // 'forward' or 'backward'
  className = '' 
}) => {
  const variants = direction === 'forward' 
    ? transitionVariants.slideLeft 
    : transitionVariants.slideRight;

  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={variants}
      transition={transitionConfigs.smooth}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
