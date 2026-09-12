/**
 * Temporary Migration Script: Fix Washed-Out Skeletons & Sidebar Background
 * 
 * Purpose:
 * 1. Upgrades all skeleton loaders across Bharat Enterprise to high-contrast,
 *    WCAG-accessible light and dark mode tokens with hardware-accelerated 60fps shimmer sweep.
 * 2. Fixes Sidebar background color so that in dark mode it matches the exact deep black (bg-slate-950)
 *    used across all application pages.
 * 
 * Target Files:
 * 1. frontend/src/index.css
 * 2. frontend/src/features/salesAnalytics/components/SkeletonCards.jsx
 * 3. frontend/src/components/Common/Feedback/Loader.jsx
 * 4. frontend/src/components/Layout/Sidebar.jsx
 * 5. frontend/src/components/Layout/AppShellSkeleton.jsx
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const cssPath = path.join(rootDir, 'frontend/src/index.css');
const skeletonCardsPath = path.join(rootDir, 'frontend/src/features/salesAnalytics/components/SkeletonCards.jsx');
const loaderPath = path.join(rootDir, 'frontend/src/components/Common/Feedback/Loader.jsx');
const sidebarPath = path.join(rootDir, 'frontend/src/components/Layout/Sidebar.jsx');
const appShellSkeletonPath = path.join(rootDir, 'frontend/src/components/Layout/AppShellSkeleton.jsx');

console.log('🚀 Starting skeleton and sidebar fix script...');

// 1. Update frontend/src/index.css
console.log('📝 Updating index.css...');
let cssContent = fs.readFileSync(cssPath, 'utf8');

const shimmerBoneCSS = `
/* ═══════════════════════════════════════════
   SKELETON & SHIMMER BONE SYSTEM
   High-contrast, accessible loading states
   ═══════════════════════════════════════════ */
.shimmer-bone {
  position: relative;
  overflow: hidden;
  background-color: #cbd5e1 !important; /* Solid slate-300: crisp contrast on white cards */
}

html.dark .shimmer-bone {
  background-color: #334155 !important; /* Solid slate-700: visible on dark surfaces */
}

.shimmer-bone::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.70) 50%,
    transparent 100%
  );
  animation: shimmer-sweep 1.8s ease-in-out infinite;
  pointer-events: none;
}

html.dark .shimmer-bone::after {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.08) 50%,
    transparent 100%
  );
}

@keyframes shimmer-sweep {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
`;

if (!cssContent.includes('.shimmer-bone {')) {
  cssContent += '\n' + shimmerBoneCSS + '\n';
  fs.writeFileSync(cssPath, cssContent, 'utf8');
  console.log('✅ Injected .shimmer-bone styles into index.css');
} else {
  console.log('ℹ️ .shimmer-bone styles already present in index.css');
}

// 2. Update SkeletonCards.jsx
console.log('📝 Updating SkeletonCards.jsx...');
let skeletonCardsContent = fs.readFileSync(skeletonCardsPath, 'utf8');

const oldShimmerBoneRegex = /export const ShimmerBone = \(\{[\s\S]*?\}\) => \([\s\S]*?<\/div>\s*\);/;
const newShimmerBone = `export const ShimmerBone = ({ className = '', style = {}, children = null, ...props }) => (
  <div className={\`shimmer-bone rounded \${className}\`} style={style} {...props}>
    {children}
  </div>
);`;

if (skeletonCardsContent.match(oldShimmerBoneRegex)) {
  skeletonCardsContent = skeletonCardsContent.replace(oldShimmerBoneRegex, newShimmerBone);
  fs.writeFileSync(skeletonCardsPath, skeletonCardsContent, 'utf8');
  console.log('✅ Refactored ShimmerBone in SkeletonCards.jsx');
} else {
  console.log('ℹ️ ShimmerBone in SkeletonCards.jsx already refactored or regex did not match.');
}

// 3. Update Loader.jsx
console.log('📝 Updating Loader.jsx...');
let loaderContent = fs.readFileSync(loaderPath, 'utf8');

loaderContent = loaderContent.replace(
  /className="h-4 bg-slate-700\/50 rounded animate-pulse"/g,
  'className="h-4 shimmer-bone rounded"'
);
loaderContent = loaderContent.replace(
  /className="h-4 bg-slate-700\/50 rounded overflow-hidden"/g,
  'className="h-4 shimmer-bone rounded"'
);
loaderContent = loaderContent.replace(
  /className=\{`h-3 bg-slate-700\/60 rounded \$\{colWidths\[i % colWidths\.length\]\}`\}/g,
  'className={`h-3 shimmer-bone rounded ${colWidths[i % colWidths.length]}`}'
);
loaderContent = loaderContent.replace(
  /className=\{`h-4 bg-slate-700\/40 rounded animate-pulse \$\{colWidths\[colIndex % colWidths\.length\]\}`\}/g,
  'className={`h-4 shimmer-bone rounded ${colWidths[colIndex % colWidths.length]}`}'
);

fs.writeFileSync(loaderPath, loaderContent, 'utf8');
console.log('✅ Refactored Loader.jsx skeleton components to shimmer-bone');

// 4. Update Sidebar.jsx (Fix sidebar background color and badge rings to match black in other pages)
console.log('📝 Updating Sidebar.jsx background color...');
let sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

if (sidebarContent.includes('bg-slate-900/95')) {
  sidebarContent = sidebarContent.replaceAll('bg-slate-900/95', 'bg-slate-900 dark:bg-slate-950');
  console.log('✅ Updated Sidebar.jsx background to bg-slate-900 dark:bg-slate-950');
}

// Also update collapsed badge ring to match the dark black background
if (sidebarContent.includes('ring-2 ring-slate-900') && !sidebarContent.includes('dark:ring-slate-950')) {
  sidebarContent = sidebarContent.replace(/ring-2 ring-slate-900/g, 'ring-2 ring-slate-900 dark:ring-slate-950');
  console.log('✅ Updated badge ring in Sidebar.jsx to dark:ring-slate-950');
}

fs.writeFileSync(sidebarPath, sidebarContent, 'utf8');

// 5. Update AppShellSkeleton.jsx (Fix skeleton sidebar background color)
console.log('📝 Updating AppShellSkeleton.jsx background color...');
let appShellContent = fs.readFileSync(appShellSkeletonPath, 'utf8');

if (appShellContent.includes('bg-slate-900/95')) {
  appShellContent = appShellContent.replace('bg-slate-900/95', 'bg-slate-900 dark:bg-slate-950');
  fs.writeFileSync(appShellSkeletonPath, appShellContent, 'utf8');
  console.log('✅ Updated AppShellSkeleton.jsx to bg-slate-900 dark:bg-slate-950');
} else {
  console.log('ℹ️ AppShellSkeleton.jsx already has updated background color');
}

console.log('🎉 Skeleton and sidebar migration completed successfully!');
