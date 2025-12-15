import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import Modal from './Modal';

const variantConfig = {
  danger: {
    icon: AlertTriangle,
    iconColor: 'text-red-400',
    buttonClass: 'btn-danger',
    iconBgClass: 'bg-red-500/10'
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-green-400',
    buttonClass: 'btn-success',
    iconBgClass: 'bg-green-500/10'
  },
  primary: {
    icon: Info,
    iconColor: 'text-blue-400',
    buttonClass: 'btn-primary',
    iconBgClass: 'bg-blue-500/10'
  }
};

export default function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ 
              type: 'spring', 
              stiffness: 300, 
              damping: 25,
              duration: 0.2
            }}
          >
            {/* Icon Header */}
            <motion.div 
              className="flex justify-center mb-4"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
            >
              <div className={`p-3 rounded-full ${config.iconBgClass}`}>
                <Icon className={`w-8 h-8 ${config.iconColor}`} strokeWidth={2} />
              </div>
            </motion.div>

            {/* Title */}
            <motion.h3 
              className="text-xl font-semibold text-slate-100 text-center mb-3"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              {title}
            </motion.h3>

            {/* Message */}
            <motion.p 
              className="text-slate-300 text-center mb-6 leading-relaxed"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              {message}
            </motion.p>

            {/* Action Buttons */}
            <motion.div 
              className="flex justify-end gap-3"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.3 }}
            >
              <motion.button
                onClick={onClose}
                className="btn btn-secondary flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <X className="w-4 h-4" />
                {cancelText}
              </motion.button>
              
              <motion.button
                onClick={handleConfirm}
                className={`btn ${config.buttonClass} flex items-center gap-2`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <Icon className="w-4 h-4" />
                {confirmText}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
