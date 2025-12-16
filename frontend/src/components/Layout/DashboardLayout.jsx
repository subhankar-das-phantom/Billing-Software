import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Header from './Header';
import PageTransition from '../Common/PageTransition';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Close sidebar on route change (mobile)
    setSidebarOpen(false);
  }, [location.pathname]);

  const getTitle = () => {
    if (pageTitles[location.pathname]) {
      return pageTitles[location.pathname];
    }
    if (location.pathname.startsWith('/customers/')) return 'Customer Details';
    if (location.pathname.startsWith('/invoices/')) return 'Invoice Details';
    if (location.pathname.startsWith('/products/')) return 'Product Details';
    return 'Dashboard';
  };

  const getIcon = () => {
    if (pageIcons[location.pathname]) {
      return pageIcons[location.pathname];
    }
    if (location.pathname.startsWith('/customers/')) return Users;
    if (location.pathname.startsWith('/invoices/')) return FileText;
    if (location.pathname.startsWith('/products/')) return Package;
    return LayoutDashboard;
  };

  // Use consistent fade animation to avoid horizontal shifting issues
  const getTransitionVariant = () => {
    return 'fadeUp';
  };

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Mobile Sidebar - only visible on small screens */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { delay: 0.2 } }}
              transition={{ duration: 0.3 }}
              onClick={() => setSidebarOpen(false)}
            />
            
            {/* Sidebar panel */}
            <motion.div
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ 
                type: 'spring',
                stiffness: 300,
                damping: 30
              }}
            >
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Navbar - only visible on large screens */}
        <div className="hidden lg:block">
          <Navbar />
        </div>

        {/* Mobile Header - visible on small and medium screens */}
        <motion.div
          className="lg:hidden"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ 
            type: 'spring',
            stiffness: 300,
            damping: 30
          }}
        >
          <Header 
            onMenuClick={() => setSidebarOpen(true)} 
            title="Bharat Enterprise" 
          />
        </motion.div>

        {/* Main content area */}
        <main className="flex-1 p-6 lg:p-8 lg:pt-24 xl:p-10 xl:pt-24 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 max-w-full">
          <div className="max-w-[1600px] mx-auto w-full">
            <AnimatePresence mode="wait">
            <PageTransition 
              key={location.pathname} 
              variant={getTransitionVariant()}
              transition="smooth"
              className="h-full"
            >
              {/* Content wrapper with stagger effect */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Outlet />
              </motion.div>
            </PageTransition>
          </AnimatePresence>

          {/* Animated background gradient */}
          <motion.div
            className="fixed inset-0 pointer-events-none opacity-30"
            animate={{
              background: [
                'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)',
                'radial-gradient(circle at 80% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
                'radial-gradient(circle at 50% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)',
                'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)'
              ]
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'linear'
            }}
          />
          </div>
        </main>

        {/* Loading indicator bar */}
        <AnimatePresence>
          <motion.div
            className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 origin-left z-50"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 0 }}
            exit={{ scaleX: 1 }}
            transition={{ duration: 0.3 }}
            key={location.pathname}
          />
        </AnimatePresence>
      </div>

      {/* Scroll to top button */}
      <motion.button
        className="fixed bottom-6 right-6 p-3 bg-blue-500 text-white rounded-full shadow-lg hover:shadow-xl z-30"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 300 }}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Scroll to top"
      >
        <ChevronRight className="w-5 h-5 -rotate-90" />
      </motion.button>
    </div>
  );
}
