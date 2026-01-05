import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  FileText,
  FilePlus,
  LogOut,
  User,
  ChevronDown,
  Sparkles,
  StickyNote,
  Wallet,
  UsersRound,
  BarChart3,
  Shield,
  Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/products', label: 'Products', icon: Package },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/invoices', label: 'Invoices', icon: FileText },
  { path: '/credits', label: 'Credits', icon: Wallet },
  { path: '/notes', label: 'Notes', icon: StickyNote },
  { path: '/invoices/create', label: 'Create Invoice', icon: FilePlus, highlight: true },
];

// Admin-only nav items
const adminNavItems = [
  { path: '/employees', label: 'Employees', icon: UsersRound, adminOnly: true },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, adminOnly: true },
  { path: '/activity-log', label: 'Activity Log', icon: Clock, adminOnly: true },
  { path: '/manual-entries', label: 'Manual Entries', icon: FileText, adminOnly: true },
];

export default function Navbar() {
  const location = useLocation();
  const { admin, user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  // Combine nav items - add admin items if user is admin
  // Updated: We now render admin items in a separate dropdown to save space
  const mainNavItems = navItems;

  return (
    <motion.nav 
      className="fixed top-0 left-0 right-0 z-40 glass-card border-b border-slate-700/50 backdrop-blur-xl bg-slate-900/95"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="max-w-[1600px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
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
              <h1 className="font-bold text-lg text-white tracking-tight">
                Bharat
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Enterprise
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-2">
            {mainNavItems.map((item) => {
              // Check if we're on an edit page
              const isEditPage = location.pathname.includes('/edit');
              
              let isActive;
              if (item.path === '/invoices/create') {
                // Create Invoice is active for both /invoices/create and /invoices/:id/edit
                isActive = location.pathname === '/invoices/create' || isEditPage;
              } else if (item.path === '/invoices') {
                // Invoices is active only for exact /invoices path (not edit pages)
                isActive = location.pathname === '/invoices' || 
                  (location.pathname.startsWith('/invoices/') && !isEditPage && !location.pathname.includes('/create'));
              } else {
                // Default logic for other items
                isActive = location.pathname === item.path || 
                  (item.path !== '/' && location.pathname.startsWith(item.path));
              }
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="relative"
                >
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="navActiveTab"
                      className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl"
                      initial={false}
                      transition={{ 
                        type: "spring", 
                        stiffness: 500, 
                        damping: 30 
                      }}
                    />
                  )}
                  
                  <motion.div
                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors group ${
                      isActive 
                        ? 'text-blue-400' 
                        : item.highlight
                          ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.div
                      animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ 
                        duration: 0.5, 
                        repeat: isActive ? Infinity : 0, 
                        repeatDelay: 3 
                      }}
                    >
                      <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                    </motion.div>
                    <span className="font-medium text-sm hidden xl:block">{item.label}</span>
                    
                    {/* Tooltip for icon-only mode (< xl screens) */}
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 border border-slate-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none xl:hidden z-50">
                      {item.label}
                    </div>
                    
                    {item.highlight && (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                      >
                        <Sparkles className="w-3 h-3 text-yellow-400" />
                      </motion.div>
                    )}
                    {item.adminOnly && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded font-semibold hidden xl:inline-block">Admin</span>
                    )}
                  </motion.div>
                </Link>
              );
            })}

            {/* Admin Dropdown - Groups admin items to save space */}
            {isAdmin && (
              <div className="relative">
                <motion.button
                  onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors ${
                    location.pathname.includes('/employees') || location.pathname.includes('/analytics')
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Shield size={18} />
                  <span className="font-medium text-sm hidden xl:block">Admin</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${adminMenuOpen ? 'rotate-180' : ''}`} />
                </motion.button>
                
                <AnimatePresence>
                  {adminMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setAdminMenuOpen(false)} />
                      <motion.div
                        className="absolute right-0 top-full mt-2 w-48 glass-card border border-slate-700 rounded-xl shadow-xl overflow-hidden z-40 py-1"
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      >
                        {adminNavItems.map((item) => (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setAdminMenuOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors ${
                              location.pathname === item.path ? 'text-blue-400 bg-blue-500/5' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <item.icon size={18} />
                            <span className="text-sm font-medium">{item.label}</span>
                          </Link>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <motion.button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <span className="text-white font-semibold text-sm">
                  {isAdmin ? (admin?.firmName?.charAt(0) || 'A') : (user?.name?.charAt(0) || 'E')}
                </span>
              </div>
              <div className="hidden xl:block text-left">
                <p className="text-sm font-medium text-white truncate max-w-[150px]">
                  {isAdmin ? (admin?.firmName || 'Admin') : (user?.name || 'Employee')}
                </p>
                <p className="text-xs text-slate-400 truncate max-w-[150px]">
                  {isAdmin ? (admin?.email || 'admin@bharat.com') : (user?.email || 'employee')}
                </p>
              </div>
              <motion.div
                animate={{ rotate: userMenuOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={16} className="text-slate-400" />
              </motion.div>
            </motion.button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {userMenuOpen && (
                <>
                  {/* Backdrop */}
                  <motion.div
                    className="fixed inset-0 z-40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setUserMenuOpen(false)}
                  />
                  
                  {/* Menu */}
                  <motion.div
                    className="absolute right-0 mt-2 w-56 glass-card border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50"
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <div className="p-4 border-b border-slate-700/50">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">
                          {isAdmin ? (admin?.firmName || 'Admin') : (user?.name || 'Employee')}
                        </p>
                        {isAdmin && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">Admin</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {isAdmin ? (admin?.email || 'admin@bharat.com') : (user?.email || 'employee')}
                      </p>
                    </div>
                    
                    <div className="p-2">
                      {isAdmin && (
                        <motion.button
                          onClick={() => {
                            setUserMenuOpen(false);
                            navigate('/profile');
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors text-left"
                          whileHover={{ x: 4 }}
                        >
                          <User size={18} />
                          <span className="text-sm font-medium">Profile</span>
                        </motion.button>
                      )}
                      
                      <motion.button
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left mt-1"
                        whileHover={{ x: 4 }}
                      >
                        <LogOut size={18} />
                        <span className="text-sm font-medium">Logout</span>
                      </motion.button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
