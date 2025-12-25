import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  FilePlus, 
  FileText, 
  LogOut,
  X,
  ChevronRight,
  Settings,
  HelpCircle,
  BarChart3,
  Sparkles,
  User,
  StickyNote
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { invoiceService } from '../../services/invoiceService';
import { useMotionConfig } from '../../hooks';

const getMenuItems = (invoiceCount) => [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, badge: null },
  { path: '/products', label: 'Products', icon: Package, badge: null },
  { path: '/customers', label: 'Customers', icon: Users, badge: null },
  { path: '/invoices/create', label: 'Create Invoice', icon: FilePlus, badge: 'New', badgeColor: 'bg-emerald-500' },
  { path: '/invoices', label: 'All Invoices', icon: FileText, badge: invoiceCount > 0 ? String(invoiceCount) : null, badgeColor: 'bg-blue-500' },
];

const quickActions = [
  { path: '/notes', label: 'Notes', icon: StickyNote },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/help', label: 'Help Center', icon: HelpCircle },
];

// Adaptive sidebar variants - simplified for mobile
const createSidebarVariants = (isMobile) => ({
  open: { 
    x: 0, 
    opacity: 1,
    transition: isMobile 
      ? { type: 'tween', duration: 0.25, ease: 'easeOut' }
      : { type: 'spring', stiffness: 300, damping: 30 }
  },
  closed: { 
    x: '-100%', 
    opacity: 0,
    transition: isMobile
      ? { type: 'tween', duration: 0.2, ease: 'easeIn' }
      : { type: 'spring', stiffness: 300, damping: 30 }
  },
});

const createMenuContainerVariants = (isMobile, shouldStagger) => ({
  open: {
    transition: {
      staggerChildren: shouldStagger ? 0.05 : 0,
      delayChildren: isMobile ? 0 : 0.1
    }
  },
  closed: {
    transition: {
      staggerChildren: 0,
      staggerDirection: -1
    }
  }
});

const createMenuItemVariants = (isMobile) => ({
  open: {
    x: 0,
    opacity: 1,
    transition: isMobile
      ? { type: 'tween', duration: 0.2, ease: 'easeOut' }
      : { type: 'spring', stiffness: 300, damping: 24 }
  },
  closed: {
    x: -10,
    opacity: 0
  }
});

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { admin, logout } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const shouldShow = isOpen || isDesktop;
  const [hoveredItem, setHoveredItem] = useState(null);
  const [invoiceCount, setInvoiceCount] = useState(0);
  
  // Adaptive motion configuration
  const motionConfig = useMotionConfig();
  
  // Memoize variants based on device type
  const sidebarVariants = useMemo(
    () => createSidebarVariants(motionConfig.isMobile), 
    [motionConfig.isMobile]
  );
  const menuContainerVariants = useMemo(
    () => createMenuContainerVariants(motionConfig.isMobile, motionConfig.shouldStagger), 
    [motionConfig.isMobile, motionConfig.shouldStagger]
  );
  const menuItemVariants = useMemo(
    () => createMenuItemVariants(motionConfig.isMobile), 
    [motionConfig.isMobile]
  );

  // Fetch invoice count on component mount
  useEffect(() => {
    const fetchInvoiceCount = async () => {
      try {
        const data = await invoiceService.getInvoices({ limit: 1 });
        setInvoiceCount(data.total || 0);
      } catch (err) {
        console.error('Failed to fetch invoice count:', err);
      }
    };
    fetchInvoiceCount();
  }, []);

  const menuItems = getMenuItems(invoiceCount);

  return (
    <>
      {/* Overlay for mobile */}
      <AnimatePresence>
        {isOpen && !isDesktop && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { delay: 0.15 } }}
            className="sidebar-overlay fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm" 
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={shouldShow ? "open" : "closed"}
        variants={sidebarVariants}
        className="sidebar fixed top-0 left-0 h-full w-64 bg-slate-900/95 border-r border-slate-700 flex flex-col z-40 md:translate-x-0 md:static backdrop-blur-xl"
      >
        {/* Logo Section */}
        <motion.div 
          className="p-6 border-b border-slate-700 flex justify-between items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link to="/" className="flex items-center gap-3 group" onClick={onClose}>
            <motion.div 
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 relative overflow-hidden"
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-white font-bold text-lg relative z-10">B</span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-500"
                initial={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
            </motion.div>
            <div>
              <motion.h1 
                className="font-bold text-lg text-white tracking-tight"
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
              >
                Bharat
              </motion.h1>
              <motion.p 
                className="text-xs text-slate-400 font-medium"
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Enterprise
              </motion.p>
            </div>
          </Link>
          
          {/* Close button for mobile */}
          <motion.button 
            onClick={onClose} 
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
          >
            <X size={20} />
          </motion.button>
        </motion.div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar">
          {/* Main Menu */}
          <motion.div
            variants={menuContainerVariants}
            initial="closed"
            animate={shouldShow ? "open" : "closed"}
          >
            <motion.div
              variants={menuItemVariants}
              className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3"
            >
              Main Menu
            </motion.div>
            
            <ul className="space-y-1">
              {menuItems.map((item, index) => {
                // Check if we're on an edit page
                const isEditPage = location.pathname.includes('/edit');
                
                let isActive;
                if (item.path === '/invoices/create') {
                  // Create Invoice is active for both /invoices/create and /invoices/:id/edit
                  isActive = location.pathname === '/invoices/create' || isEditPage;
                } else if (item.path === '/invoices') {
                  // All Invoices is active only for exact /invoices path (not edit pages)
                  isActive = location.pathname === '/invoices' || 
                    (location.pathname.startsWith('/invoices/') && !isEditPage && !location.pathname.includes('/create'));
                } else {
                  // Default logic for other items
                  isActive = location.pathname === item.path || 
                    (item.path !== '/' && location.pathname.startsWith(item.path));
                }
                
                return (
                  <motion.li 
                    key={item.path}
                    variants={menuItemVariants}
                    onHoverStart={() => setHoveredItem(item.path)}
                    onHoverEnd={() => setHoveredItem(null)}
                  >
                    <Link
                      to={item.path}
                      onClick={onClose}
                      className="relative block"
                    >
                      {/* Active indicator background */}
                      {isActive && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl"
                          initial={false}
                          transition={{ 
                            type: "spring", 
                            stiffness: 500, 
                            damping: 30,
                            mass: 0.8
                          }}
                        />
                      )}
                      
                      {/* Hover background */}
                      <AnimatePresence>
                        {hoveredItem === item.path && !isActive && (
                          <motion.div
                            className="absolute inset-0 bg-slate-800/50 rounded-xl"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                          />
                        )}
                      </AnimatePresence>

                      <div className={`relative flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                        isActive ? 'text-blue-400' : 'text-slate-400 hover:text-white'
                      }`}>
                        {/* Icon - simplified on mobile, no infinite animations */}
                        <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                        
                        <span className="font-medium flex-1">{item.label}</span>
                        
                        {/* Badge */}
                        {item.badge && (
                          <motion.span
                            className={`${item.badgeColor || 'bg-blue-500'} text-white text-xs px-2 py-0.5 rounded-full font-semibold`}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ 
                              type: 'spring',
                              stiffness: 500,
                              damping: 15,
                              delay: 0.3 + index * 0.05
                            }}
                          >
                            {item.badge}
                          </motion.span>
                        )}
                        
                        {/* Hover arrow */}
                        <AnimatePresence>
                          {hoveredItem === item.path && (
                            <motion.div
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronRight size={16} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </Link>
                  </motion.li>
                );
              })}
            </ul>

            {/* Quick Actions */}
            <motion.div
              variants={menuItemVariants}
              className="mt-6"
            >
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">
                Quick Actions
              </div>
              
              <ul className="space-y-1">
                {quickActions.map((item) => (
                  <motion.li 
                    key={item.path}
                    variants={menuItemVariants}
                    whileHover={motionConfig.shouldHover ? { x: 4 } : undefined}
                  >
                    <Link
                      to={item.path}
                      onClick={onClose}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors group"
                    >
                      {/* Icon - no rotation animation on mobile */}
                      <item.icon size={18} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </motion.div>


          </motion.div>
        </nav>

        {/* User Section */}
        <motion.div 
          className="p-4 border-t border-slate-700 bg-slate-900/50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div 
            className="flex items-center gap-3 mb-4 p-2 rounded-xl hover:bg-slate-800/50 transition-colors cursor-pointer group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div 
              className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 relative overflow-hidden"
              whileHover={{ scale: 1.1 }}
            >
              <span className="text-white font-semibold relative z-10">
                {admin?.firmName?.charAt(0) || 'A'}
              </span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-teal-600 to-emerald-500"
                initial={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              />
            </motion.div>
            
            <div className="flex-1 min-w-0">
              <motion.p 
                className="text-sm font-medium text-white truncate"
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                {admin?.firmName || 'Admin'}
              </motion.p>
              <motion.p 
                className="text-xs text-slate-400 truncate"
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {admin?.email || 'admin@bharat.com'}
              </motion.p>
            </div>

            <motion.div
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              initial={{ rotate: 0 }}
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
            >
              <Settings size={16} className="text-slate-400" />
            </motion.div>
          </motion.div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/10 hover:border-red-500/30 group relative overflow-hidden"
          >
            <motion.div
              className="absolute inset-0 bg-red-500/20"
              initial={{ x: '-100%' }}
              whileHover={{ x: 0 }}
              transition={{ duration: 0.3 }}
            />
            <motion.div
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.3 }}
              className="relative z-10"
            >
              <LogOut size={18} />
            </motion.div>
            <span className="font-medium relative z-10">Logout</span>
          </motion.button>
        </motion.div>
      </motion.aside>
    </>
  );
}
