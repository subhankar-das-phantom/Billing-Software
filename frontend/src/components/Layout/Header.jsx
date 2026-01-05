import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  User, 
  LogOut, 
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Header({ onMenuClick, title }) {
  const { admin, user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header 
      className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700"
    >
      <div className="flex items-center justify-between px-4 md:px-6 h-16">
        {/* Left side */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <motion.button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            aria-label="Open menu"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95, rotate: 90 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <Menu size={24} />
          </motion.button>

          {/* Page title with animation */}
          <motion.h1 
            className="text-lg md:text-xl font-semibold text-white tracking-tight"
            key={title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {title}
          </motion.h1>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Current date */}
          <motion.span 
            className="hidden md:block text-sm text-slate-400 font-medium px-3 py-1.5 bg-slate-800/50 rounded-lg"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short'
            })}
          </motion.span>



          {/* Profile dropdown */}
          <div className="relative">
            <motion.button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1.5 pr-3 rounded-lg hover:bg-slate-800 transition-colors group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div 
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isAdmin 
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600' 
                    : 'bg-gradient-to-br from-blue-500 to-purple-600'
                }`}
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
              >
                <User size={18} className="text-white" />
              </motion.div>
              <ChevronDown 
                size={16} 
                className="text-slate-400 group-hover:text-white transition-colors hidden md:block" 
              />
            </motion.button>

            {/* Profile dropdown menu */}
            <AnimatePresence>
              {profileOpen && (
                <>
                  <motion.div
                    className="fixed inset-0 z-40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setProfileOpen(false)}
                  />
                  <motion.div
                    className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden z-50"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    {/* Profile header */}
                    <motion.div 
                      className="p-4 border-b border-slate-700"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      <p className="text-white font-semibold">
                        {isAdmin ? (admin?.firmName || 'Admin') : (user?.name || 'Employee')}
                      </p>
                      <p className="text-slate-400 text-sm">
                        {isAdmin ? (admin?.email || 'admin@bharat.com') : (user?.email || 'employee')}
                      </p>
                    </motion.div>

                    {/* Profile link - Admin only */}
                    {isAdmin && (
                      <div className="py-2">
                        <motion.button
                          onClick={() => { setProfileOpen(false); navigate('/profile'); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-colors"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 }}
                          whileHover={{ x: 4 }}
                        >
                          <User size={18} />
                          <span className="text-sm">Profile</span>
                        </motion.button>
                      </div>
                    )}

                    {/* Logout */}
                    <motion.div 
                      className="border-t border-slate-700 p-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <motion.button
                        onClick={() => { setProfileOpen(false); logout(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors rounded-lg"
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <LogOut size={18} />
                        <span className="text-sm font-medium">Logout</span>
                      </motion.button>
                    </motion.div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>


    </header>
  );
}
