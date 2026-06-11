import { motion } from 'framer-motion';
import { Lock, Crown } from 'lucide-react';

/**
 * UpgradeBadge — shown next to locked navigation items.
 *
 * Two variants:
 * - "lock" — small lock icon (for sidebar items)
 * - "badge" — "PRO" / "Upgrade" text badge (for navbar)
 */
export default function UpgradeBadge({ variant = 'lock', planNeeded = 'Upgrade' }) {
  if (variant === 'badge') {
    return (
      <motion.span
        className="text-[10px] px-1.5 py-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 rounded font-semibold border border-amber-500/20 flex items-center gap-1"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      >
        <Crown className="w-3 h-3" />
        <span>{planNeeded}</span>
      </motion.span>
    );
  }

  // Lock variant
  return (
    <motion.div
      className="text-slate-600"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
    >
      <Lock className="w-3.5 h-3.5" />
    </motion.div>
  );
}
