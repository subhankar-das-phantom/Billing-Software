import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, X, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';

/**
 * SubscriptionBanner — shown in DashboardLayout when subscription
 * is in grace period, expired, or trial ending soon.
 */
export default function SubscriptionBanner() {
  const { isGrace, isExpired, isTrial, daysRemaining, planName, subscription } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  // Don't show if subscription is healthy or dismissed
  if (dismissed) return null;
  if (!isGrace && !isExpired && !(isTrial && daysRemaining <= 7)) return null;

  // Determine banner style and message
  let bgClass, borderClass, iconColor, Icon, title, message;

  if (isExpired) {
    bgClass = 'bg-red-500/10';
    borderClass = 'border-red-500/30';
    iconColor = 'text-red-400';
    Icon = AlertTriangle;
    title = 'Subscription Expired';
    message = 'Your account is in read-only mode. Renew your subscription to create invoices, payments, and more.';
  } else if (isGrace) {
    bgClass = 'bg-amber-500/10';
    borderClass = 'border-amber-500/30';
    iconColor = 'text-amber-400';
    Icon = Clock;
    title = 'Grace Period Active';
    message = `Your subscription has expired. You have ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} of grace period remaining before write access is disabled.`;
  } else {
    // Trial ending soon
    bgClass = 'bg-blue-500/10';
    borderClass = 'border-blue-500/30';
    iconColor = 'text-blue-400';
    Icon = Clock;
    title = 'Trial Ending Soon';
    message = `Your free trial of the ${planName} plan ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Subscribe now to continue using all features.`;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -20, height: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`${bgClass} border ${borderClass} rounded-xl p-4 mb-6`}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${bgClass}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-sm ${iconColor}`}>{title}</h3>
            <p className="text-sm text-slate-400 mt-1">{message}</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <motion.button
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                isExpired
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } transition-colors flex items-center gap-2`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                navigate('/subscription');
              }}
            >
              <span>Contact us to upgrade this plan.</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>

            {!isExpired && (
              <motion.button
                onClick={() => setDismissed(true)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
