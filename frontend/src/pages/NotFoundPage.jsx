import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home,
  ArrowLeft,
  Search,
  AlertCircle,
  Compass,
  FileQuestion,
  Sparkles,
  Zap
} from "lucide-react";
import { useMemo } from "react";

// ----- Animation Presets -----
const springItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

const pageFadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, staggerChildren: 0.2, delayChildren: 0.3 },
  },
};

const glowAnimation = {
  animate: {
    scale: [1, 1.2, 1],
    opacity: [0.5, 0.8, 0.5],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
};

const floatAnim = (duration, delay = 0) => ({
  y: [0, -15, 0],
  rotate: [0, 10, -10, 0],
  opacity: [0.3, 0.6, 0.3],
  transition: { duration, repeat: Infinity, ease: "easeInOut", delay },
});

// Floating Icon Component
const FloatingIcon = ({ Icon, pos, delay, index }) => (
  <motion.div
    className="absolute text-slate-700/30"
    style={pos}
    animate={floatAnim(4 + index, delay)}
  >
    <Icon size={40} />
  </motion.div>
);

export default function NotFoundPage() {
  // Precompute random particles to avoid rerender jumps
  const particles = useMemo(
    () =>
      Array.from({ length: 15 }).map(() => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        duration: 3 + Math.random() * 2,
      })),
    []
  );

  const floatingIcons = [
    { Icon: FileQuestion, pos: { top: "15%", left: "10%" }, delay: 0 },
    { Icon: Search, pos: { top: "20%", right: "15%" }, delay: 1 },
    { Icon: Compass, pos: { bottom: "25%", left: "15%" }, delay: 2 },
    { Icon: Sparkles, pos: { bottom: "20%", right: "10%" }, delay: 1.5 },
  ];

  return (
    <div className="min-h-[80vh] flex items-center justify-center relative overflow-hidden">
      {/* ----- Animated Background Glow Blobs ----- */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3], scale: [1, 1.2, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 20, 0], opacity: [0.3, 0.6, 0.3], scale: [1, 1.3, 1] }}
          transition={{ duration: 7, repeat: Infinity, delay: 1, ease: "easeInOut" }}
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
        />
      </div>

      {/* Floating icons */}
      {floatingIcons.map((item, i) => (
        <FloatingIcon key={i} {...item} index={i} />
      ))}

      {/* ----- Main Wrapper ----- */}
      <motion.div
        variants={pageFadeIn}
        initial="hidden"
        animate="visible"
        className="text-center relative z-10 px-4"
      >
        {/* 404 Section */}
        <motion.div className="relative mb-8">
          <motion.div
            variants={glowAnimation}
            animate="animate"
            className="absolute inset-0 bg-gradient-to-r 
            from-blue-500/20 via-purple-500/20 to-blue-500/20 
            rounded-full blur-3xl"
          />

          <motion.h1
            className="text-9xl md:text-[12rem] font-bold gradient-text tracking-tighter relative"
            style={{ textShadow: "0 0 60px rgba(59, 130, 246, 0.5)" }}
          >
            {["4", "0", "4"].map((digit, i) => (
              <motion.span
                key={i}
                className="inline-block"
                initial={{ opacity: 0, y: -50, rotateX: -90 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{
                  delay: i * 0.2,
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                }}
                whileHover={{
                  scale: 1.1,
                  rotate: [0, -5, 5, 0],
                  transition: { duration: 0.3 },
                }}
              >
                {digit}
              </motion.span>
            ))}
          </motion.h1>

          {/* Rotating dots */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-blue-400/50 rounded-full"
                style={{
                  transform: `rotate(${i * 45}deg) translateY(-80px)`,
                }}
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </motion.div>
        </motion.div>

        {/* Error Icon */}
        <motion.div
          variants={springItem}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl 
          bg-gradient-to-br from-red-500/20 to-orange-500/20 
          border border-red-500/30 mb-6 relative"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <AlertCircle size={40} className="text-red-400" />
          </motion.div>

          <motion.div
            className="absolute -top-2 -right-2"
            animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          >
            <Zap size={20} className="text-yellow-400" />
          </motion.div>
        </motion.div>

        {/* Text + Buttons */}
        <motion.h2 variants={springItem} className="text-3xl md:text-4xl font-bold text-white mb-4">
          Oops! Page Not Found
        </motion.h2>

        <motion.p variants={springItem} className="text-slate-400 text-lg mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved to another dimension.
        </motion.p>

        {/* Action buttons */}
        <motion.div variants={springItem} className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              to="/"
              className="btn btn-primary flex items-center gap-2 shadow-lg shadow-blue-500/30 
              relative overflow-hidden group"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
              <Home className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="relative z-10">Go to Dashboard</span>
            </Link>
          </motion.div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <button onClick={() => window.history.back()} className="btn btn-secondary flex items-center gap-2">
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span>Go Back</span>
            </button>
          </motion.div>
        </motion.div>

        {/* Helpful Links */}
        <motion.div
          variants={springItem}
          className="mt-12 p-6 rounded-xl bg-slate-800/50 border border-slate-700/50 
          backdrop-blur-sm max-w-2xl mx-auto"
        >
          <p className="text-slate-400 text-sm mb-4">Maybe you were looking for:</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { to: "/products", label: "Products", Icon: FileQuestion },
              { to: "/customers", label: "Customers", Icon: Search },
              { to: "/invoices", label: "Invoices", Icon: FileQuestion },
              { to: "/invoices/create", label: "New Invoice", Icon: Sparkles },
            ].map(({ to, label, Icon }, i) => (
              <motion.div key={to} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.1 }}
              >
                <Link
                  to={to}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg bg-slate-800/50 
                  hover:bg-slate-700/50 border border-slate-700/30 hover:border-slate-600/50 
                  transition-all group"
                >
                  <motion.div whileHover={{ rotate: 360, scale: 1.2 }} transition={{ duration: 0.5 }}>
                    <Icon size={24} className="text-blue-400 group-hover:text-blue-300" />
                  </motion.div>
                  <span className="text-slate-300 text-sm group-hover:text-white">
                    {label}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Fun Message */}
        <motion.p
          variants={springItem}
          className="mt-8 text-slate-500 text-sm flex items-center justify-center gap-2"
        >
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
            🚀
          </motion.div>
          Lost in space? Don't worry, we'll help you find your way!
        </motion.p>
      </motion.div>

      {/* Floating Particles */}
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-blue-400/30 rounded-full"
          style={{ left: p.left, top: p.top }}
          animate={{ y: [0, -30, 0], opacity: [0, 1, 0], scale: [0, 1, 0] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}
    </div>
  );
}
