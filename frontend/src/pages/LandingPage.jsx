import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  FileText, Package, Users, IndianRupee, Shield, Zap,
  BarChart3, ArrowRight, Check, Smartphone, Lock,
  TrendingUp, Receipt, BookOpen, UserCheck, Menu, X,
  ChevronDown, CreditCard, Layers, Eye, Globe,
  Clock, Heart, Rocket, Star
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { HeroGeometric } from '@/components/ui/shape-landing-hero';

// ─── Helpers ───────────────────────────────────────
const getReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const scrollToSection = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
};

// ─── Animated Counter ──────────────────────────────
function AnimatedStat({ value, suffix = '', prefix = '' }) {
  const ref = useRef(null);
  const numRef = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    if (!isInView || !numRef.current) return;
    const dur = 2000;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = Math.round(value * eased);
      if (numRef.current) numRef.current.textContent = `${prefix}${cur.toLocaleString()}${suffix}`;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [isInView, value, prefix, suffix]);

  return <span ref={ref}><span ref={numRef}>{prefix}0{suffix}</span></span>;
}

// ─── Reveal Wrapper ────────────────────────────────
function Reveal({ children, className = '', id, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.12 });
  return (
    <motion.section
      ref={ref}
      id={id}
      initial={{ opacity: 0, y: 60 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

// Staggered card reveal
function StaggerCard({ children, className = '', index = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{
        duration: 0.6,
        delay: index * 0.1,
        ease: [0.22, 1, 0.36, 1]
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ════════════════════════════════════════════════════
//                   FLOATING NAV
// ════════════════════════════════════════════════════
function FloatingNav({ reduceMotion, isLoggedIn }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const navClick = useCallback((id) => {
    scrollToSection(id);
    setMobileOpen(false);
  }, []);

  const links = [
    { label: 'Features', id: 'features' },
    { label: 'How It Works', id: 'how-it-works' },
    { label: 'Pricing', id: 'pricing' },
  ];

  return (
    <motion.nav
      initial={{ y: 0 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
        ? 'bg-slate-950/80 backdrop-blur-2xl border-b border-white/[0.06] shadow-2xl shadow-black/30'
        : 'bg-transparent'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <button onClick={() => scrollToSection('hero')} className="flex items-center gap-3 group bg-transparent border-none cursor-pointer p-0">
            <motion.div
              whileHover={reduceMotion ? undefined : { scale: 1.1, rotate: 5 }}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-shadow relative overflow-hidden"
            >
              <span className="text-white font-bold text-xl relative z-10">B</span>
              {!reduceMotion && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-500"
                  animate={{ opacity: [0, 0.5, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              )}
            </motion.div>
            <span className="text-white font-bold text-lg tracking-tight hidden sm:block">
              Bharat Enterprise
            </span>
          </button>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-8">
            {links.map(l => (
              <button
                key={l.id}
                onClick={() => navClick(l.id)}
                className="relative text-slate-400 hover:text-white transition-colors text-sm font-medium bg-transparent border-none cursor-pointer group py-1"
              >
                {l.label}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 group-hover:w-full transition-all duration-300 rounded-full" />
              </button>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-4">
            {isLoggedIn ? (
              <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all no-underline">
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors no-underline">
                  Sign In
                </Link>
                <Link to="/register" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all no-underline">
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile burger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors bg-transparent border-none cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden bg-slate-950/98 backdrop-blur-2xl border-b border-white/5 overflow-hidden"
          >
            <div className="px-6 py-8 space-y-1">
              {links.map(l => (
                <button
                  key={l.id}
                  onClick={() => navClick(l.id)}
                  className="block w-full text-left py-3.5 text-slate-300 hover:text-white transition-colors font-medium text-base bg-transparent border-none cursor-pointer rounded-lg hover:bg-slate-800/50 px-3"
                >
                  {l.label}
                </button>
              ))}
              <div className="pt-6 mt-4 border-t border-slate-800 space-y-3">
                {isLoggedIn ? (
                  <Link to="/" className="block text-center py-3 text-white font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25 no-underline">
                    Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="block text-center py-3 text-slate-300 hover:text-white font-medium border border-slate-700 rounded-xl no-underline transition-colors">
                      Sign In
                    </Link>
                    <Link to="/register" className="block text-center py-3 text-white font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25 no-underline">
                      Get Started Free
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ════════════════════════════════════════════════════
//          HERO SECTION (HeroGeometric Integration)
// ════════════════════════════════════════════════════
function HeroSection({ reduceMotion, isLoggedIn }) {
  return (
    <section id="hero">
      <HeroGeometric
        badge="Built for Shop Owners & Distributors"
        title1="Bill Fast. Stay Accurate."
        title2="Run Your Business with Confidence"
        description="Create invoices in seconds, track stock automatically, and know exactly what every customer owes you — all from your phone or desktop. No complicated setup."
      >
        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          {isLoggedIn ? (
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all no-underline hover:scale-[1.02] active:scale-[0.98]"
            >
              Go to Dashboard
              <ArrowRight className="w-5 h-5" />
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all no-underline hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-slate-300 border border-slate-700 rounded-xl hover:border-slate-500 hover:text-white hover:bg-slate-800/50 transition-all no-underline"
              >
                Sign In
              </Link>
            </>
          )}
        </div>

        {/* Trust row */}
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-400">
          {['No credit card required', 'Free to start', 'Set up in minutes'].map((t) => (
            <span key={t} className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{t}</span>
            </span>
          ))}
        </div>
      </HeroGeometric>
    </section>
  );
}

// ════════════════════════════════════════════════════
//                 FEATURES SECTION
// ════════════════════════════════════════════════════
const features = [
  {
    icon: Receipt,
    title: 'Fast GST Billing',
    desc: 'Create professional GST invoices in seconds — automatic tax calculation, no manual errors, no guesswork.',
    color: 'from-blue-500 to-blue-600',
    glow: 'group-hover:shadow-blue-500/20',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Package,
    title: 'Accurate Stock Tracking',
    desc: 'Your stock updates automatically with every sale. Always know what is in stock — no manual counting needed.',
    color: 'from-emerald-500 to-emerald-600',
    glow: 'group-hover:shadow-emerald-500/20',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: CreditCard,
    title: 'Customer Balance Tracking',
    desc: 'See exactly what each customer owes at a glance. Track payments, outstanding dues, and credit history easily.',
    color: 'from-amber-500 to-orange-500',
    glow: 'group-hover:shadow-amber-500/20',
    bg: 'bg-amber-500/10',
  },
  {
    icon: BookOpen,
    title: 'Clear Financial Ledger',
    desc: 'Every invoice, payment, and credit note in one place. Know your complete financial picture at any time.',
    color: 'from-purple-500 to-purple-600',
    glow: 'group-hover:shadow-purple-500/20',
    bg: 'bg-purple-500/10',
  },
  {
    icon: BarChart3,
    title: 'Daily Reports & Analytics',
    desc: 'Check your daily collections, top customers, and sales trends — straight from your phone or desktop.',
    color: 'from-rose-500 to-rose-600',
    glow: 'group-hover:shadow-rose-500/20',
    bg: 'bg-rose-500/10',
  },
  {
    icon: Shield,
    title: 'Staff Access Control',
    desc: 'Give your staff the right level of access. Admins see everything; employees see only what they need.',
    color: 'from-cyan-500 to-cyan-600',
    glow: 'group-hover:shadow-cyan-500/20',
    bg: 'bg-cyan-500/10',
  },
];

function FeaturesSection({ reduceMotion }) {
  return (
    <Reveal id="features" className="py-20 lg:py-32 relative">
      {/* Subtle bg accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-500/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 lg:mb-20">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium mb-6">
            <Layers className="w-3.5 h-3.5" />
            Powerful Features
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-5">
            Everything you need to{' '}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              run your business
            </span>
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            Designed for real shop owners and distributors. No accounting degree needed —
            just open and start billing.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((f, i) => (
            <StaggerCard key={f.title} index={i}>
              <motion.div
                whileHover={reduceMotion ? undefined : { y: -8, scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className={`group relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:border-slate-600/80 transition-all duration-300 cursor-pointer h-full shadow-lg hover:shadow-2xl ${f.glow}`}
              >
                {/* Gradient overlay on hover */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-300`} />

                <div className="relative z-10">
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${f.color} mb-6 shadow-lg`}>
                    <f.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
                  <p className="text-slate-400 leading-relaxed text-[15px]">{f.desc}</p>
                </div>
              </motion.div>
            </StaggerCard>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

// ════════════════════════════════════════════════════
//              HOW IT WORKS SECTION
// ════════════════════════════════════════════════════
const steps = [
  {
    num: '01',
    icon: UserCheck,
    title: 'Create Your Account',
    desc: 'Sign up in seconds with just your email. No credit card, no paperwork, no hassle.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    num: '02',
    icon: Package,
    title: 'Add Your Products',
    desc: 'Import or add your product catalog with GST details, HSN codes, pricing, and stock quantities.',
    color: 'from-purple-500 to-purple-600',
  },
  {
    num: '03',
    icon: Zap,
    title: 'Start Billing',
    desc: 'Create invoices in seconds with smart search, auto-calculations, and instant stock updates.',
    color: 'from-emerald-500 to-emerald-600',
  },
];

function HowItWorksSection({ reduceMotion }) {
  return (
    <Reveal id="how-it-works" className="py-20 lg:py-32 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/50 to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 lg:mb-20">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6">
            <Rocket className="w-3.5 h-3.5" />
            Quick Setup
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-5">
            Get started in{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              minutes
            </span>
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            Three simple steps to modernize your billing workflow.
            No training required.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-6 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden lg:block absolute top-[72px] left-[16.6%] right-[16.6%] h-px">
            <div className="w-full h-full bg-gradient-to-r from-blue-500/40 via-purple-500/40 to-emerald-500/40" />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/40 via-purple-500/40 to-emerald-500/40 blur-sm" />
          </div>

          {steps.map((s, i) => (
            <StaggerCard key={s.num} index={i}>
              <div className="relative text-center lg:text-left">
                {/* Number badge */}
                <div className="flex justify-center lg:justify-start mb-8">
                  <motion.div
                    whileHover={reduceMotion ? undefined : { scale: 1.15, rotate: 10 }}
                    className={`relative w-[88px] h-[88px] rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-2xl`}
                  >
                    <s.icon className="w-10 h-10 text-white" />
                    <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center text-xs font-bold text-white">
                      {s.num}
                    </span>
                  </motion.div>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
                <p className="text-slate-400 leading-relaxed max-w-sm mx-auto lg:mx-0">{s.desc}</p>
              </div>
            </StaggerCard>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

// ════════════════════════════════════════════════════
//                 STATS SECTION
// ════════════════════════════════════════════════════
const stats = [
  { value: 5, suffix: ' min', label: 'To Get Started', sub: 'No complicated setup' },
  { value: 0, suffix: '', label: 'Billing Errors', sub: 'Auto-calculated totals' },
  { value: 100, suffix: '%', label: 'Mobile Friendly', sub: 'Works on any device' },
  { value: 0, suffix: ' ₹', label: 'Upfront Cost', sub: 'Free to start' },
];

function StatsSection() {
  return (
    <Reveal className="py-20 lg:py-28 relative">
      {/* Gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/[0.04] via-purple-500/[0.06] to-blue-500/[0.04] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6">
            <TrendingUp className="w-3.5 h-3.5" />
            Built for Daily Use
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-5">
            Designed for{' '}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              real shop owners
            </span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Handles real billing workloads smoothly — works fast even with large data and multiple users.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {stats.map((s, i) => (
            <StaggerCard key={s.label} index={i}>
              <div className="text-center p-6 lg:p-8 rounded-2xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/40 hover:border-slate-600/60 transition-colors">
                <p className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-2 tracking-tight">
                  <AnimatedStat value={s.value} suffix={s.suffix} prefix={s.prefix || ''} />
                </p>
                <p className="text-sm font-semibold text-slate-300 mb-1">{s.label}</p>
                <p className="text-xs text-slate-400">{s.sub}</p>
              </div>
            </StaggerCard>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

// ════════════════════════════════════════════════════
//                WHY CHOOSE US
// ════════════════════════════════════════════════════
const reasons = [
  { icon: IndianRupee, title: 'Free to Start', desc: 'No upfront cost, no credit card required. Get started and see the value before anything else.', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { icon: Smartphone, title: 'Works on Mobile', desc: 'Bill from your phone, check stock on the go. Designed for daily use in the field.', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { icon: Globe, title: 'Made for India', desc: 'Built for Indian pharma distributors with full GST support and INR-first design.', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { icon: Lock, title: 'Safe & Reliable', desc: 'Your billing data is protected. Every transaction is recorded accurately — no data loss.', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { icon: Eye, title: 'Nothing Hidden', desc: 'Every entry, every payment, every change is logged. Full visibility into your business.', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { icon: Clock, title: 'Always Up to Date', desc: 'Stock, balances, and reports update instantly — no manual refresh, no stale numbers.', color: 'text-rose-400', bg: 'bg-rose-500/10' },
];

function WhyChooseSection({ reduceMotion }) {
  return (
    <Reveal className="py-20 lg:py-32 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-500/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16 lg:mb-20">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-6">
            <Heart className="w-3.5 h-3.5" />
            Why Bharat Enterprise
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-5">
            Built for{' '}
            <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              real businesses
            </span>
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            Simple enough to use on day one. Powerful enough to run your business every day.
            No training required.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reasons.map((r, i) => (
            <StaggerCard key={r.title} index={i}>
              <motion.div
                whileHover={reduceMotion ? undefined : { y: -4 }}
                className="flex items-start gap-4 p-6 rounded-2xl bg-slate-800/30 border border-slate-700/30 hover:border-slate-600/50 hover:bg-slate-800/50 transition-all cursor-default"
              >
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${r.bg} flex items-center justify-center`}>
                  <r.icon className={`w-6 h-6 ${r.color}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1.5">{r.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{r.desc}</p>
                </div>
              </motion.div>
            </StaggerCard>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

// ════════════════════════════════════════════════════
//                PRICING SECTION
// ════════════════════════════════════════════════════
const pricingFeatures = [
  'Unlimited invoices',
  'Unlimited products & customers',
  'GST-compliant billing',
  'Customer credit tracking',
  'Financial ledger',
  'Analytics & reports dashboard',
  'Export to PDF, CSV & Excel',
  'Role-based access control',
  'Activity logging',
  'Mobile-first responsive design',
  'Credit notes & returns',
  'Payment tracking',
];

function PricingSection({ reduceMotion, isLoggedIn }) {
  return (
    <Reveal id="pricing" className="py-20 lg:py-32 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-blue-500/[0.03] rounded-full blur-[150px]" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-14 lg:mb-16">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-6">
            <IndianRupee className="w-3.5 h-3.5" />
            Simple Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-5">
            Start free.{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              No credit card needed.
            </span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Every feature is available from day one. No limits, no locked features, no surprise charges.
          </p>
        </div>

        {/* Pricing card */}
        <motion.div
          whileHover={reduceMotion ? undefined : { y: -6 }}
          transition={{ duration: 0.3 }}
          className="relative bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl max-w-lg mx-auto"
        >
          {/* Top gradient bar */}
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500" />

          {/* Shimmer */}
          {!reduceMotion && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
            />
          )}

          <div className="relative z-10 p-8 sm:p-10">
            {/* Price */}
            <div className="text-center mb-8">
              <p className="text-sm font-semibold text-purple-400 mb-3 uppercase tracking-wider">Currently Free</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-6xl sm:text-7xl font-extrabold text-white">₹0</span>
                <span className="text-xl text-slate-400 font-medium">/month</span>
              </div>
              <p className="text-slate-400 mt-2">No upfront cost. No credit card required.</p>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent mb-8" />

            {/* Features list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
              {pricingFeatures.map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="text-sm text-slate-300">{f}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link
              to={isLoggedIn ? '/' : '/register'}
              className="flex items-center justify-center gap-2 w-full py-4 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all no-underline hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoggedIn ? 'Go to Dashboard' : 'Get Started Free'}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-center text-xs text-slate-500 mt-4">
              Pricing may evolve as we grow — early users always get the best deal.
            </p>
          </div>
        </motion.div>
      </div>
    </Reveal>
  );
}

// ════════════════════════════════════════════════════
//                  CTA SECTION
// ════════════════════════════════════════════════════
function CTASection({ reduceMotion, isLoggedIn }) {
  return (
    <Reveal className="py-20 lg:py-28 relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-indigo-500/10 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.04)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Orbs */}
      {!reduceMotion && (
        <>
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 6, repeat: Infinity }}
            className="absolute -top-20 -left-20 w-[300px] h-[300px] bg-blue-500/15 rounded-full blur-[80px] pointer-events-none"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 8, repeat: Infinity, delay: 2 }}
            className="absolute -bottom-20 -right-20 w-[300px] h-[300px] bg-purple-500/15 rounded-full blur-[80px] pointer-events-none"
          />
        </>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-6">
          Your billing,{' '}
          <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-[gradient-shift_4s_ease_infinite]">
            done right.
          </span>
        </h2>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Fast invoicing. Accurate stock. Clear customer balances.
          Start free today — it takes less than 5 minutes to set up.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to={isLoggedIn ? '/' : '/register'}
            className="inline-flex items-center gap-2 px-10 py-4 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all no-underline hover:scale-[1.02] active:scale-[0.98]"
          >
            {isLoggedIn ? 'Go to Dashboard' : 'Get Started Free — No Credit Card'}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </Reveal>
  );
}

// ════════════════════════════════════════════════════
//                    FOOTER
// ════════════════════════════════════════════════════
function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-8">
          {/* Brand */}
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <span className="text-white font-bold text-xl">B</span>
              </div>
              <span className="text-white font-bold text-lg tracking-tight">Bharat Enterprise</span>
            </div>
            <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
              Fast billing, accurate stock, and clear customer balances — built for Indian shop owners and distributors.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-8 text-sm">
            <div className="space-y-3">
              <p className="font-semibold text-slate-300">Product</p>
              <button onClick={() => scrollToSection('features')} className="block text-slate-500 hover:text-white transition-colors bg-transparent border-none cursor-pointer p-0">Features</button>
              <button onClick={() => scrollToSection('pricing')} className="block text-slate-500 hover:text-white transition-colors bg-transparent border-none cursor-pointer p-0">Pricing</button>
              <button onClick={() => scrollToSection('how-it-works')} className="block text-slate-500 hover:text-white transition-colors bg-transparent border-none cursor-pointer p-0">How It Works</button>
            </div>
            <div className="space-y-3">
              <p className="font-semibold text-slate-300">Account</p>
              <Link to="/login" className="block text-slate-500 hover:text-white transition-colors no-underline">Sign In</Link>
              <Link to="/register" className="block text-slate-500 hover:text-white transition-colors no-underline">Register</Link>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Bharat Enterprise. All rights reserved.
          </p>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            Built with <Heart className="w-3 h-3 text-red-400 fill-red-400" /> in India
          </p>
        </div>
      </div>
    </footer>
  );
}

// ════════════════════════════════════════════════════
//               MAIN LANDING PAGE
// ════════════════════════════════════════════════════
export default function LandingPage() {
  const reduceMotion = useMemo(() => getReducedMotion(), []);
  const { user } = useAuth();
  const isLoggedIn = !!user;

  // Scroll to top on mount
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-slate-950 overflow-x-hidden">
      <FloatingNav reduceMotion={reduceMotion} isLoggedIn={isLoggedIn} />

      <main>

      <HeroSection reduceMotion={reduceMotion} isLoggedIn={isLoggedIn} />

      {/* Section divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />

      <FeaturesSection reduceMotion={reduceMotion} />

      <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />

      <HowItWorksSection reduceMotion={reduceMotion} />

      <StatsSection />

      <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />

      <WhyChooseSection reduceMotion={reduceMotion} />

      <div className="h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />

      <PricingSection reduceMotion={reduceMotion} isLoggedIn={isLoggedIn} />

      <CTASection reduceMotion={reduceMotion} isLoggedIn={isLoggedIn} />
      </main>

      <Footer />
    </div>
  );
}
