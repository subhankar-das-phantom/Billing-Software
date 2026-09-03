import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, X, ArrowRight, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';

const SUPPORT_EMAIL = 'support@bharatenterprise.com';

/**
 * SubscriptionBanner — shown in DashboardLayout when subscription
 * is in grace period, expired, or trial ending soon.
 * Fully responsive for desktop, tablet, and mobile screens.
 */
export default function SubscriptionBanner() {
  const { isGrace, isExpired, isTrial, daysRemaining, planName } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  // Don't show if subscription is healthy or dismissed
  if (dismissed) return null;
  if (!isGrace && !isExpired && !(isTrial && daysRemaining <= 7)) return null;

  // Determine banner style, labels and content
  let bgClass, borderClass, iconColor, Icon, title, buttonLabel, messageNode;

  if (isExpired) {
    bgClass = 'bg-red-500/10';
    borderClass = 'border-red-500/30';
    iconColor = 'text-red-400';
    Icon = AlertTriangle;
    title = 'Subscription Expired';
    buttonLabel = 'Renew Subscription';
    messageNode = (
      <span>
        Your account is in read-only mode. To renew your plan, contact us at{' '}
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=Subscription%20Renewal%20Inquiry`}
          className="text-red-300 hover:text-red-200 underline font-medium break-all"
        >
          {SUPPORT_EMAIL}
        </a>.
      </span>
    );
  } else if (isGrace) {
    bgClass = 'bg-amber-500/10';
    borderClass = 'border-amber-500/30';
    iconColor = 'text-amber-400';
    Icon = Clock;
    title = 'Grace Period Active';
    buttonLabel = 'Renew Plan';
    messageNode = (
      <span>
        Your subscription has expired (
        <strong className="text-amber-200 font-semibold">
          {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
        </strong>
        ). To renew, contact{' '}
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=Grace%20Period%20Renewal%20Inquiry`}
          className="text-amber-300 hover:text-amber-200 underline font-medium break-all"
        >
          {SUPPORT_EMAIL}
        </a>.
      </span>
    );
  } else {
    // Trial ending soon
    bgClass = 'bg-blue-500/10';
    borderClass = 'border-blue-500/30';
    iconColor = 'text-blue-400';
    Icon = Clock;
    title = 'Trial Ending Soon';
    buttonLabel = 'Upgrade Plan';
    messageNode = (
      <span>
        Your trial of the <strong className="text-slate-100 font-semibold">{planName}</strong> plan ends in{' '}
        <strong className="text-blue-300 font-semibold">
          {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
        </strong>
        . To upgrade, contact{' '}
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=Trial%20Upgrade%20Inquiry%20for%20${encodeURIComponent(planName)}`}
          className="text-blue-400 hover:text-blue-300 underline font-medium break-all"
        >
          {SUPPORT_EMAIL}
        </a>.
      </span>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -20, height: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={`relative ${bgClass} border ${borderClass} rounded-xl p-3.5 sm:p-4 mb-4 sm:mb-6 shadow-sm`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 sm:gap-4">
          {/* Left: Icon & Text block */}
          <div className="flex items-start gap-3 min-w-0 pr-8 sm:pr-0">
            <div className={`p-2 rounded-lg ${bgClass} flex-shrink-0 mt-0.5 sm:mt-0`}>
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className={`font-semibold text-xs sm:text-sm ${iconColor} leading-tight`}>
                {title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300/90 mt-1 leading-relaxed">
                {messageNode}
              </p>
            </div>
          </div>

          {/* Right / Bottom: Action button & Dismiss button */}
          <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto pt-1 sm:pt-0">
            <motion.button
              className={`w-full sm:w-auto px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold ${
                isExpired
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              } transition-colors flex items-center justify-center gap-1.5 shadow-sm`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                navigate('/subscription');
              }}
            >
              <span>{buttonLabel}</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </motion.button>

            {!isExpired && (
              <motion.button
                onClick={() => setDismissed(true)}
                className="absolute top-3 right-3 sm:static p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label="Dismiss notification"
                title="Dismiss"
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

