import { motion } from "framer-motion";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── CSS Gradient Orbs Fallback ─────────────────────
// Lightweight animated background for mobile / loading / reduced-motion.
// Uses GPU-composited CSS animations — zero JS overhead.
function GradientOrbsFallback() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {/* Blue orb — top-left */}
      <div
        className="absolute rounded-full opacity-30"
        style={{
          width: 500,
          height: 500,
          top: "-10%",
          left: "-10%",
          background: "radial-gradient(circle, rgba(59,130,246,0.35) 0%, transparent 70%)",
          animation: "heroOrbFloat1 8s ease-in-out infinite",
        }}
      />
      {/* Cyan orb — center-right */}
      <div
        className="absolute rounded-full opacity-25"
        style={{
          width: 400,
          height: 400,
          top: "30%",
          right: "-5%",
          background: "radial-gradient(circle, rgba(34,211,238,0.30) 0%, transparent 70%)",
          animation: "heroOrbFloat2 10s ease-in-out infinite",
        }}
      />
      {/* Teal orb — bottom-left */}
      <div
        className="absolute rounded-full opacity-20"
        style={{
          width: 350,
          height: 350,
          bottom: "5%",
          left: "10%",
          background: "radial-gradient(circle, rgba(45,212,191,0.30) 0%, transparent 70%)",
          animation: "heroOrbFloat3 12s ease-in-out infinite",
        }}
      />
      {/* Emerald orb — top-right */}
      <div
        className="absolute rounded-full opacity-15"
        style={{
          width: 250,
          height: 250,
          top: "10%",
          right: "15%",
          background: "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 70%)",
          animation: "heroOrbFloat1 14s ease-in-out infinite reverse",
        }}
      />
    </div>
  );
}


function HeroGeometric({
  badge = "Design Collective",
  title1 = "Elevate Your Digital Vision",
  title2 = "Crafting Exceptional Websites",
  description,
  children,
  reduceMotion = false,
}) {
  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 1,
        delay: 0.5 + i * 0.2,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-transparent pt-16">
      {/* Subtle gradient wash — matches existing blue/teal palette */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.06] via-transparent to-accent-500/[0.06] blur-3xl" />

      {/* Grid pattern — matches the rest of the landing page */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,black,transparent)]" />

      {/* Text content — z-10 to stay above background layers */}
      <div className="relative z-10 container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/[0.08] border border-blue-500/[0.15] mb-8 md:mb-12"
          >
            <Circle className="h-2 w-2 fill-blue-400/80" />
            <span className="text-sm text-slate-400 tracking-wide">
              {badge}
            </span>
          </motion.div>

          {/* Title */}
          <motion.div
            custom={1}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
          >
            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6 md:mb-8 tracking-tight leading-[1.1]">
              <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                {title1}
              </span>
              <br />
              <span
                className={cn(
                  "bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-accent-400 to-emerald-400"
                )}
              >
                {title2}
              </span>
            </h1>
          </motion.div>

          {/* Description */}
          <motion.div
            custom={2}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
          >
            <p className="text-base sm:text-lg md:text-xl text-slate-400 mb-8 leading-relaxed font-light tracking-wide max-w-xl mx-auto px-4">
              {description ||
                "Crafting exceptional digital experiences through innovative design and cutting-edge technology."}
            </p>
          </motion.div>

          {/* Children (CTAs, trust badges, etc.) */}
          {children && (
            <motion.div
              custom={3}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
            >
              {children}
            </motion.div>
          )}
        </div>
      </div>

      {/* Dark vignette overlay — ensures text readability over particles */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_20%,rgba(2,6,23,0.6)_100%)] pointer-events-none" />

      {/* Bottom fade — blends into the slate-950 sections below */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/60 pointer-events-none" />
    </div>
  );
}

export { HeroGeometric, GradientOrbsFallback };
