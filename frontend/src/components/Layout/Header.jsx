import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, 
  Bell, 
  Search, 
  User, 
  Settings, 
  LogOut, 
  ChevronDown,
  X,
  Moon,
  Sun
} from 'lucide-react';

export default function Header({ onMenuClick, title }) {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications] = useState([
    { id: 1, text: 'New invoice created', time: '2m ago', unread: true },
    { id: 2, text: 'Customer updated', time: '1h ago', unread: true },
    { id: 3, text: 'Payment received', time: '3h ago', unread: false }
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <motion.header 
      className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex items-center justify-between px-4 md:px-6 h-16">
        {/* Left side */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <motion.button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
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

          {/* Search button */}
          <motion.button 
            onClick={() => setSearchOpen(!searchOpen)}
            className="hidden sm:flex p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Search"
          >
            <Search size={20} />
          </motion.button>

          {/* Notifications dropdown */}
          <div className="relative">
            <motion.button 
              onClick={() => setNotificationOpen(!notificationOpen)}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <motion.span 
                  className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-slate-900"
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    repeatType: 'loop'
                  }}
                />
              )}
            </motion.button>

            {/* Notifications dropdown menu */}
            <AnimatePresence>
              {notificationOpen && (
                <>
                  <motion.div
                    className="fixed inset-0 z-40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setNotificationOpen(false)}
                  />
                  <motion.div
                    className="absolute right-0 mt-2 w-80 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden z-50"
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                      <h3 className="text-white font-semibold">Notifications</h3>
                      {unreadCount > 0 && (
                        <motion.span 
                          className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full font-medium"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          {unreadCount} new
                        </motion.span>
                      )}
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map((notification, index) => (
                        <motion.div
                          key={notification.id}
                          className={`p-4 hover:bg-slate-700/50 cursor-pointer border-b border-slate-700/50 last:border-0 ${
                            notification.unread ? 'bg-slate-700/30' : ''
                          }`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ x: 4 }}
                        >
                          <div className="flex items-start gap-3">
                            {notification.unread && (
                              <motion.div 
                                className="w-2 h-2 bg-blue-500 rounded-full mt-2"
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              />
                            )}
                            <div className="flex-1">
                              <p className="text-slate-200 text-sm">{notification.text}</p>
                              <span className="text-slate-500 text-xs">{notification.time}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="p-3 border-t border-slate-700 text-center">
                      <motion.button 
                        className="text-blue-400 text-sm hover:text-blue-300 font-medium"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        View all notifications
                      </motion.button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Profile dropdown */}
          <div className="relative">
            <motion.button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1.5 pr-3 rounded-lg hover:bg-slate-800 transition-colors group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div 
                className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
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
                      <p className="text-white font-semibold">John Doe</p>
                      <p className="text-slate-400 text-sm">john@example.com</p>
                    </motion.div>

                    {/* Menu items */}
                    <div className="py-2">
                      {[
                        { icon: User, label: 'Profile', onClick: () => {} },
                        { icon: Settings, label: 'Settings', onClick: () => {} },
                        { icon: Moon, label: 'Dark Mode', onClick: () => {} }
                      ].map((item, index) => (
                        <motion.button
                          key={item.label}
                          onClick={item.onClick}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-colors"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * (index + 1) }}
                          whileHover={{ x: 4 }}
                        >
                          <item.icon size={18} />
                          <span className="text-sm">{item.label}</span>
                        </motion.button>
                      ))}
                    </div>

                    {/* Logout */}
                    <motion.div 
                      className="border-t border-slate-700 p-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      <motion.button
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

      {/* Search bar overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            className="border-t border-slate-700 p-4"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <motion.input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                autoFocus
              />
              <motion.button
                onClick={() => setSearchOpen(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <X size={20} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
