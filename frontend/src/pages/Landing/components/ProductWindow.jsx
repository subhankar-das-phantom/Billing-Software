import React from 'react';

/**
 * Reusable enterprise ProductWindow framing component.
 * Features macOS-style traffic dots as visual framing (no fake URLs).
 * Supports full Dark & Light mode theming and 5 compositional variants:
 *  - 'hero': Grand presentation with depth, ambient glow, and optional floating badges.
 *  - 'standard': Balanced framed window for invoices and ledgers.
 *  - 'editorial': Compact asymmetrical framing for 2-column feature narratives.
 *  - 'edge-to-edge': Full-width high-density data canvas for analytics and reports.
 *  - 'mobile-crop': Focus-cropped framing preventing microscopic downscaling on mobile.
 */
export default function ProductWindow({
  src,
  alt = 'Application Screenshot',
  variant = 'standard',
  title = 'Bharat Enterprise',
  status,
  badges = [],
  className = '',
  priority = false,
  imageClassName = '',
}) {
  // Base window header - theme aware
  const renderHeader = (compact = false) => (
    <div
      className={`flex items-center justify-between px-4 ${
        compact ? 'py-2.5' : 'py-3'
      } bg-slate-850 border-b border-slate-800 select-none transition-colors`}
    >
      {/* Visual traffic framing lights */}
      <div className="flex items-center space-x-2">
        <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-sm" aria-hidden="true" />
        <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-sm" aria-hidden="true" />
        <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-sm" aria-hidden="true" />
      </div>

      {/* Center view title / descriptor (Framing device, not a fake URL) */}
      <div className="flex items-center space-x-2 px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200 shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block animate-pulse" aria-hidden="true" />
        <span className="tracking-tight">{title}</span>
      </div>

      {/* Right status badge or subtle action mark */}
      <div className="flex items-center space-x-2">
        {status ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            {status}
          </span>
        ) : (
          <div className="w-12" aria-hidden="true" />
        )}
      </div>
    </div>
  );

  // Derive desktop, tablet, and small mobile webp variants from src if available
  const isPng = typeof src === 'string' && src.endsWith('.png');
  const desktopWebp = isPng
    ? src.replace(/\.png$/i, '.webp')
    : typeof src === 'string' && (src.endsWith('-mobile.webp') || src.endsWith('-sm.webp'))
    ? src.replace(/-mobile\.webp|-sm\.webp/i, '.webp')
    : src;
  const mobileWebp = isPng
    ? src.replace(/\.png$/i, '-mobile.webp')
    : src;
  const smWebp = isPng
    ? src.replace(/\.png$/i, '-sm.webp')
    : src;

  const renderImage = (extraClasses = '') => (
    <picture className="block w-full h-full">
      <source media="(max-width: 640px)" type="image/webp" srcSet={smWebp} />
      <source media="(max-width: 1024px)" type="image/webp" srcSet={mobileWebp} />
      <source type="image/webp" srcSet={desktopWebp} />
      <img
        src={src}
        alt={alt}
        width={2880}
        height={1800}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
        className={`w-full h-auto block object-cover aspect-[16/10] ${extraClasses} ${imageClassName}`}
      />
    </picture>
  );

  // Variant: HERO
  if (variant === 'hero') {
    return (
      <div className={`relative w-full max-w-6xl mx-auto group ${className}`}>
        {/* Ambient background glow */}
        <div
          className="absolute -inset-1.5 bg-gradient-to-b from-blue-500/10 via-cyan-500/10 to-transparent rounded-2xl blur-xl opacity-60 group-hover:opacity-80 transition duration-700 pointer-events-none"
          aria-hidden="true"
        />

        {/* Window Container */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl transition-colors">
          {renderHeader(false)}

          <div className="relative bg-slate-950 overflow-hidden aspect-[16/10]">
            {renderImage('transform transition-transform duration-700 will-change-transform')}
          </div>
        </div>

        {/* Floating live data badges */}
        {badges.map((badge, idx) => (
          <div
            key={idx}
            className={`hidden md:flex items-center space-x-2.5 px-3.5 py-2 rounded-xl backdrop-blur-md bg-slate-900/95 border border-slate-700/80 shadow-xl text-xs text-slate-200 absolute ${badge.position || 'bottom-6 left-6'} z-10 transition-colors`}
          >
            {badge.icon && <span className="text-blue-400">{badge.icon}</span>}
            <span className="font-semibold">{badge.text}</span>
          </div>
        ))}
      </div>
    );
  }

  // Variant: EDITORIAL (2-Column split with asymmetrical backdrop)
  if (variant === 'editorial') {
    return (
      <div className={`relative w-full rounded-xl p-1 bg-slate-900/40 border border-slate-800 shadow-lg transition-colors ${className}`}>
        <div className="rounded-lg overflow-hidden bg-slate-900 border border-slate-800">
          {renderHeader(true)}
          <div className="relative overflow-hidden bg-slate-950 aspect-[16/10]">
            {renderImage()}
          </div>
        </div>
      </div>
    );
  }

  // Variant: EDGE-TO-EDGE (Full wide canvas for multi-column dashboards & intelligence)
  if (variant === 'edge-to-edge') {
    return (
      <div className={`w-full max-w-7xl mx-auto rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl transition-colors ${className}`}>
        {renderHeader(false)}
        <div className="relative overflow-hidden bg-slate-950 aspect-[16/10]">
          {renderImage()}
        </div>
      </div>
    );
  }

  // Variant: MOBILE-CROP (Focused viewport view without tiny text)
  if (variant === 'mobile-crop') {
    return (
      <div className={`w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shadow-md transition-colors ${className}`}>
        {renderHeader(true)}
        <div className="relative overflow-hidden bg-slate-950 max-h-[420px] aspect-[16/10]">
          {renderImage('object-top')}
        </div>
      </div>
    );
  }

  // Variant: STANDARD (Default framed view)
  return (
    <div className={`w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl transition-colors ${className}`}>
      {renderHeader(true)}
      <div className="relative overflow-hidden bg-slate-950 aspect-[16/10]">
        {renderImage()}
      </div>
    </div>
  );
}
