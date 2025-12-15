import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useState } from 'react';

const MotionCard = ({ 
  children, 
  className = '', 
  delay = 0,
  variant = 'default', // 'default', 'tilt', 'glow', 'lift', 'minimal'
  clickable = false,
  showIcon = false,
  hoverable = true,
  ...props 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Animation variants
  const variants = {
    default: {
      hover: {
        y: -5,
        boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.3)',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        transition: { 
          type: 'spring',
          stiffness: 400,
          damping: 17
        }
      },
      tap: { scale: 0.98 }
    },
    lift: {
      hover: {
        y: -12,
        scale: 1.02,
        boxShadow: '0 20px 40px -15px rgba(59, 130, 246, 0.4)',
        borderColor: 'rgba(59, 130, 246, 0.8)',
        transition: {
          type: 'spring',
          stiffness: 300,
          damping: 20
        }
      },
      tap: { scale: 0.97, y: -8 }
    },
    glow: {
      hover: {
        boxShadow: '0 0 30px rgba(59, 130, 246, 0.6), 0 10px 30px -10px rgba(0, 0, 0, 0.3)',
        borderColor: 'rgba(59, 130, 246, 1)',
        scale: 1.01,
        transition: { duration: 0.3 }
      },
      tap: { scale: 0.98 }
    },
    minimal: {
      hover: {
        backgroundColor: 'rgba(51, 65, 85, 0.6)',
        transition: { duration: 0.2 }
      },
      tap: { scale: 0.99 }
    }
  };

  const selectedVariant = variants[variant] || variants.default;

  // Tilt effect (3D rotation on hover)
  if (variant === 'tilt') {
    return <TiltCard delay={delay} className={className} {...props}>
      {children}
    </TiltCard>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5, 
        delay,
        ease: [0.22, 1, 0.36, 1] // Custom easing curve
      }}
      whileHover={hoverable ? selectedVariant.hover : undefined}
      whileTap={clickable ? selectedVariant.tap : undefined}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`glass-card relative overflow-hidden ${clickable ? 'cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {/* Animated background gradient on hover */}
      {variant === 'glow' && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 opacity-0"
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Content wrapper */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Optional corner icon */}
      {showIcon && (
        <motion.div
          className="absolute top-3 right-3"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ 
            opacity: isHovered ? 1 : 0,
            scale: isHovered ? 1 : 0.8,
            rotate: isHovered ? 45 : 0
          }}
          transition={{ duration: 0.2 }}
        >
          <ArrowUpRight className="w-5 h-5 text-blue-400" />
        </motion.div>
      )}
    </motion.div>
  );
};

// Tilt Card with 3D effect
const TiltCard = ({ children, delay, className, ...props }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['7.5deg', '-7.5deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-7.5deg', '7.5deg']);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d'
      }}
      whileHover={{ 
        scale: 1.05,
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.4)'
      }}
      className={`glass-card ${className}`}
      {...props}
    >
      <div style={{ transform: 'translateZ(50px)', transformStyle: 'preserve-3d' }}>
        {children}
      </div>
    </motion.div>
  );
};

// Grid wrapper for staggered card animations
export const CardGrid = ({ children, stagger = 0.1, className = '' }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: stagger
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 24
      }
    }
  };

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
};

// Feature Card with icon
export const FeatureCard = ({ 
  title, 
  description, 
  icon: Icon = Sparkles,
  delay = 0,
  className = ''
}) => {
  return (
    <MotionCard 
      variant="lift" 
      delay={delay} 
      clickable 
      className={className}
    >
      <motion.div
        className="flex items-start gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.2 }}
      >
        <motion.div
          className="p-3 bg-blue-500/10 rounded-lg"
          whileHover={{ rotate: 360, scale: 1.1 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          <Icon className="w-6 h-6 text-blue-400" />
        </motion.div>
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
        </div>
      </motion.div>
    </MotionCard>
  );
};

// Interactive Card with state
export const InteractiveCard = ({ children, className = '' }) => {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <motion.div
      className={`glass-card cursor-pointer ${className}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ 
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.97 }}
      onTapStart={() => setIsPressed(true)}
      onTap={() => setIsPressed(false)}
      onTapCancel={() => setIsPressed(false)}
    >
      <motion.div
        animate={{ 
          borderColor: isPressed ? 'rgba(59, 130, 246, 1)' : 'rgba(51, 65, 85, 1)'
        }}
        className="relative"
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

export default MotionCard;
