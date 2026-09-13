import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  maxWidth,
  closeOnOverlayClick = true,
  showCloseButton = true
}) {
  const effectiveSize = size === 'md' && maxWidth ? maxWidth : size;
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    '2xl': 'max-w-2xl',
    xl: 'max-w-4xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-7xl'
  };
  const sizeClass = sizes[effectiveSize] || sizes.md;

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      onClose();
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden no-print"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{ willChange: 'opacity' }}
        >
          {/* Backdrop Overlay */}
          <div
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px] transition-opacity"
            onClick={handleOverlayClick}
          />

          {/* Modal Container */}
          <motion.div
            className={`modal ${sizeClass} relative z-10 w-full max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl`}
            initial={{ scale: 0.97, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 8 }}
            transition={{ 
              duration: 0.15,
              ease: [0.16, 1, 0.3, 1]
            }}
            style={{ willChange: 'transform, opacity' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="modal-header flex items-center justify-between p-5 border-b border-slate-800">
                <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
                
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors group cursor-pointer"
                    aria-label="Close modal"
                  >
                    <X 
                      className="w-5 h-5 transition-transform group-hover:rotate-90" 
                      strokeWidth={2}
                    />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="modal-body p-5">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// Optional: Specialized Modal variants
export function AlertModal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  icon: Icon,
  iconColor = 'text-blue-400',
  iconBgColor = 'bg-blue-500/10'
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{ willChange: 'opacity' }}
        >
          <div
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            className="modal max-w-md relative z-10 w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6"
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform, opacity' }}
            onClick={(e) => e.stopPropagation()}
          >
            {Icon && (
              <div className="flex justify-center mb-4">
                <div className={`p-3 rounded-full ${iconBgColor}`}>
                  <Icon className={`w-8 h-8 ${iconColor}`} strokeWidth={2} />
                </div>
              </div>
            )}

            {title && (
              <h3 className="text-xl font-semibold text-slate-100 text-center mb-4">
                {title}
              </h3>
            )}

            <div>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Slide-in Modal (from side)
export function SlideModal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  position = 'right' // 'left', 'right', 'top', 'bottom'
}) {
  const slideVariants = {
    right: { x: '100%' },
    left: { x: '-100%' },
    top: { y: '-100%' },
    bottom: { y: '100%' }
  };

  const positionClasses = {
    right: 'right-0 top-0 h-full',
    left: 'left-0 top-0 h-full',
    top: 'top-0 left-0 w-full',
    bottom: 'bottom-0 left-0 w-full'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed inset-0 z-50 no-print"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <div
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            className={`absolute ${positionClasses[position]} bg-slate-900 border border-slate-800 shadow-2xl max-w-md w-full overflow-auto`}
            initial={slideVariants[position]}
            animate={{ x: 0, y: 0 }}
            exit={slideVariants[position]}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
