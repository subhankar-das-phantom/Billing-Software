import React from 'react';
import { Layers, FileText, BarChart3, Database } from 'lucide-react';

/**
 * Reusable enterprise ProductWindow framing component.
 * Delivers visual rhythm across landing sections without browser-chrome monotony:
 *  - 'hero': Flagship framed window with macOS traffic dots, title pill, subtle ambient glow, and data badges.
 *  - 'editorial': Refined technical frame with section breadcrumb and hairline border. Zero traffic dots.
 *  - 'edge-to-edge': Full-width data canvas with slim metadata bar, maximized product viewport. Zero traffic dots.
 *  - 'standard': Balanced framed container with clean single-line title. Zero traffic dots.
 *
 * Supports explicit three-tier responsive assets:
 *  - <= 640px: mobileSmallSrc (720×450 fallback)
 *  - 641px–768px: mobileSrc (1080×675 Retina crop)
 *  - > 768px: src (1920×1200 desktop full view)
 */
export default function ProductWindow({
  src,
  mobileSrc,
  mobileSmallSrc,
  alt = 'Application Screenshot',
  variant = 'standard',
  title = 'Bharat Enterprise',
  status,
  badges = [],
  className = '',
  priority = false,
  sizes,
  imageClassName = '',
}) {
  // Resolve desktop webp, mobile webp, and small mobile webp with explicit preference
  const isPng = typeof src === 'string' && src.endsWith('.png');
  const resolvedDesktopWebp = typeof src === 'string' && src.endsWith('.webp')
    ? src
    : isPng
    ? src.replace(/\.png$/i, '.webp')
    : src;

  const resolvedMobileSrc = mobileSrc || (
    typeof src === 'string' && src.endsWith('.png')
      ? src.replace(/\.png$/i, '-mobile.webp')
      : typeof src === 'string' && src.endsWith('.webp')
      ? src.replace(/\.webp$/i, '-mobile.webp')
      : src
  );

  const resolvedSmallSrc = mobileSmallSrc || (
    typeof src === 'string' && src.endsWith('.png')
      ? src.replace(/\.png$/i, '-sm.webp')
      : typeof src === 'string' && src.endsWith('.webp')
      ? src.replace(/\.webp$/i, '-sm.webp')
      : src
  );

  // Variant-specific responsive sizes attribute derived from actual layout widths
  const resolvedSizes = sizes || (
    variant === 'hero'
      ? '(max-width: 640px) 100vw, (max-width: 768px) 92vw, (max-width: 1280px) 90vw, 1152px'
      : variant === 'editorial' || variant === 'standard'
      ? '(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 710px'
      : '(max-width: 640px) 100vw, (max-width: 1280px) 92vw, 1216px' // edge-to-edge
  );

  // Responsive image element with zero-CLS 16:10 aspect ratio
  // Serves crisp high-DPR mobile WebP for viewports <= 768px (aligned with index.html preload)
  // and full desktop WebP for wider screens, eliminating smartphone blurriness.
  const renderImage = (extraClasses = '') => (
    <picture className="block w-full h-full">
      {resolvedMobileSrc && (
        <source
          media="(max-width: 768px)"
          type="image/webp"
          srcSet={
            resolvedSmallSrc && resolvedSmallSrc !== resolvedMobileSrc
              ? `${resolvedSmallSrc} 720w, ${resolvedMobileSrc} 1440w`
              : resolvedMobileSrc
          }
          sizes="(max-width: 768px) 100vw, 768px"
        />
      )}
      <source type="image/webp" srcSet={resolvedDesktopWebp} />
      <img
        src={src}
        alt={alt}
        width={2880}
        height={1800}
        sizes={resolvedSizes}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
        className={`w-full h-auto block object-cover aspect-[16/10] ${extraClasses} ${imageClassName}`}
      />
    </picture>
  );

  // ─────────────────────────────────────────────────────────────
  // Variant: HERO (Flagship framed window with macOS traffic lights)
  // ─────────────────────────────────────────────────────────────
  if (variant === 'hero') {
    return (
      <div className={`relative w-full max-w-6xl xl:max-w-7xl mx-auto group ${className}`}>
        {/* Restrained ambient background glow */}
        <div
          className="absolute -inset-1.5 bg-gradient-to-b from-blue-500/10 via-cyan-500/10 to-transparent rounded-2xl blur-xl opacity-60 pointer-events-none"
          aria-hidden="true"
        />

        {/* Window Container */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl transition-colors">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-850 border-b border-slate-800 select-none">
            {/* macOS traffic framing lights */}
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-[#ff5f56] inline-block shadow-sm" aria-hidden="true" />
              <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block shadow-sm" aria-hidden="true" />
              <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block shadow-sm" aria-hidden="true" />
            </div>

            {/* Title Capsule with steady indicator (no artificial pulsing) */}
            <div className="flex items-center space-x-2 px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" aria-hidden="true" />
              <span className="tracking-tight">{title}</span>
            </div>

            {/* Status chip */}
            <div className="flex items-center space-x-2">
              {status ? (
                <span
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium ${
                    status.includes('Showcase') || status.includes('Sample')
                      ? 'bg-slate-800/90 text-slate-300 border border-slate-700/80'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {status.includes('Showcase') || status.includes('Sample') ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" aria-hidden="true" />
                  ) : null}
                  <span>{status}</span>
                </span>
              ) : (
                <div className="w-12" aria-hidden="true" />
              )}
            </div>
          </div>

          <div className="relative bg-slate-950 overflow-hidden aspect-[16/10]">
            {renderImage()}
          </div>
        </div>

        {/* Floating context badges */}
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

  // ─────────────────────────────────────────────────────────────
  // Variant: EDITORIAL (Technical breadcrumb frame, zero traffic lights)
  // ─────────────────────────────────────────────────────────────
  if (variant === 'editorial') {
    return (
      <div className={`w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-lg transition-colors ${className}`}>
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-850/80 border-b border-slate-800 select-none">
          <div className="flex items-center space-x-2 text-xs font-medium text-slate-300">
            <FileText className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
            <span className="tracking-tight text-slate-200">{title}</span>
          </div>
          {status && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
              {status}
            </span>
          )}
        </div>
        <div className="relative overflow-hidden bg-slate-950 aspect-[16/10]">
          {renderImage()}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Variant: EDGE-TO-EDGE (Wide data canvas with slim metadata strip)
  // ─────────────────────────────────────────────────────────────
  if (variant === 'edge-to-edge') {
    return (
      <div className={`w-full max-w-7xl mx-auto rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl transition-colors ${className}`}>
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-850/70 border-b border-slate-800 select-none">
          <div className="flex items-center space-x-2 text-xs font-medium text-slate-300">
            <BarChart3 className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
            <span className="tracking-tight text-slate-200">{title}</span>
          </div>
          {status && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {status}
            </span>
          )}
        </div>
        <div className="relative overflow-hidden bg-slate-950 aspect-[16/10]">
          {renderImage()}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Variant: STANDARD (Balanced clean frame with single-line identifier)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className={`w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-lg transition-colors ${className}`}>
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-850/80 border-b border-slate-800 select-none">
        <div className="flex items-center space-x-2 text-xs font-medium text-slate-300">
          <Database className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
          <span className="tracking-tight text-slate-200">{title}</span>
        </div>
        {status && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            {status}
          </span>
        )}
      </div>
      <div className="relative overflow-hidden bg-slate-950 aspect-[16/10]">
        {renderImage()}
      </div>
    </div>
  );
}
