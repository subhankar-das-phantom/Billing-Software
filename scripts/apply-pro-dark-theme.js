/**
 * Migration Script: Apply Pro UI/UX Obsidian Dark Mode Palette
 * 
 * Replaces the odd navy-blue dark background (#020617 / #0f172a) with
 * the pro UI/UX industry standard obsidian charcoal palette (#09090b / #121215)
 * modeled after Linear, Vercel, Supabase, and shadcn/ui.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const cssPath = path.join(rootDir, 'frontend/src/index.css');
const htmlPath = path.join(rootDir, 'frontend/index.html');
const themeContextPath = path.join(rootDir, 'frontend/src/contexts/ThemeContext.jsx');
const trendChartPath = path.join(rootDir, 'frontend/src/features/salesAnalytics/components/charts/MonthlySalesTrendChart.jsx');
const dashboardChartPath = path.join(rootDir, 'frontend/src/components/Dashboard/DashboardChartsSection.jsx');

console.log('🚀 Starting Pro UI/UX Obsidian Dark Theme migration...');

// 1. Update frontend/src/index.css
console.log('📝 Updating index.css dark mode palette...');
let cssContent = fs.readFileSync(cssPath, 'utf8');

const oldDarkPaletteRegex = /\.dark,\s*html\.dark\s*\{[\s\S]*?color-scheme:\s*dark;\s*\}/;
const newDarkPalette = `.dark,
html.dark {
  /* ── Pro UI/UX Obsidian Dark Mode Palette (Linear / Vercel / Zinc Standard) ── */
  --color-slate-950: #09090b; /* canvas: sleek, neutral obsidian black */
  --color-slate-900: #121215; /* primary card, elevated surfaces & sidebar */
  --color-slate-850: #17171c; /* inner panels / nested surface */
  --color-slate-800: #1c1d22; /* secondary surface, table zebra, input hover */
  --color-slate-700: #2a2b32; /* primary borders & dividers */
  --color-slate-600: #3f404a; /* secondary borders */
  --color-slate-500: #71717a; /* muted labels */
  --color-slate-400: #a1a1aa; /* secondary text */
  --color-slate-300: #d4d4d8; /* body / subtle text */
  --color-slate-200: #e4e4e7; /* prominent text */
  --color-slate-100: #f4f4f5; /* titles & subheadings */
  --color-slate-50:  #ffffff; /* boldest headings */

  color-scheme: dark;
}`;

if (cssContent.match(oldDarkPaletteRegex)) {
  cssContent = cssContent.replace(oldDarkPaletteRegex, newDarkPalette);
  console.log('✅ Updated dark palette variables in index.css');
}

// Update light mode slate-50 to neutral obsidian heading
cssContent = cssContent.replace(
  /--color-slate-50:\s*#020617;\s*\/\*\s*boldest headings\s*\*\//g,
  '--color-slate-50:  #09090b; /* boldest headings */'
);

// Update hardcoded dark card elevation in index.css
cssContent = cssContent.replace(
  /html\.dark \.glass-card,\s*html\.dark \.stat-card\s*\{\s*background-color:\s*#0f172a;/g,
  'html.dark .glass-card,\n  html.dark .stat-card {\n    background-color: #121215;'
);

// Update dark search dropdown hover in index.css
cssContent = cssContent.replace(
  /html\.dark \.search-dropdown-item:hover,\s*html\.dark \.search-dropdown-item:focus-visible\s*\{\s*background-color:\s*#1e293b !important;/g,
  'html.dark .search-dropdown-item:hover,\n  html.dark .search-dropdown-item:focus-visible {\n    background-color: #1c1d22 !important;'
);

// Update dark shimmer bone base in index.css
cssContent = cssContent.replace(
  /html\.dark \.shimmer-bone\s*\{\s*background-color:\s*#334155 !important;\s*\}/g,
  'html.dark .shimmer-bone {\n  background-color: #24252b !important;\n}'
);

// Update base color variables fallback
cssContent = cssContent.replace(
  /--color-bg-primary:\s*15 23 42;/g,
  '--color-bg-primary: 9 9 11;'
);
cssContent = cssContent.replace(
  /--color-bg-secondary:\s*30 41 59;/g,
  '--color-bg-secondary: 28 29 34;'
);
cssContent = cssContent.replace(
  /--color-bg-tertiary:\s*51 65 85;/g,
  '--color-bg-tertiary: 42 43 50;'
);

fs.writeFileSync(cssPath, cssContent, 'utf8');

// 2. Update frontend/index.html
console.log('📝 Updating index.html dark tokens...');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

htmlContent = htmlContent.replaceAll('#020617', '#09090b');
htmlContent = htmlContent.replace('border: 3px solid #334155;', 'border: 3px solid #2a2b32;');
htmlContent = htmlContent.replace('color: #94a3b8;', 'color: #a1a1aa;');

fs.writeFileSync(htmlPath, htmlContent, 'utf8');
console.log('✅ Updated index.html');

// 3. Update frontend/src/contexts/ThemeContext.jsx
console.log('📝 Updating ThemeContext.jsx...');
let themeContextContent = fs.readFileSync(themeContextPath, 'utf8');

themeContextContent = themeContextContent.replaceAll('#020617', '#09090b');

// Update chart colors in dark mode
themeContextContent = themeContextContent.replace(
  /gridStroke:\s*'#334155'/g,
  "gridStroke: '#2a2b32'"
);
themeContextContent = themeContextContent.replace(
  /axisStroke:\s*'#94a3b8'/g,
  "axisStroke: '#71717a'"
);
themeContextContent = themeContextContent.replace(
  /tooltipBg:\s*'#1e293b'/g,
  "tooltipBg: '#121215'"
);
themeContextContent = themeContextContent.replace(
  /tooltipBorder:\s*'#334155'/g,
  "tooltipBorder: '#2a2b32'"
);
themeContextContent = themeContextContent.replace(
  /cursorFill:\s*'#1e293b'/g,
  "cursorFill: '#1c1d22'"
);

fs.writeFileSync(themeContextPath, themeContextContent, 'utf8');
console.log('✅ Updated ThemeContext.jsx');

// 4. Update chart stroke accents in dark mode
if (fs.existsSync(trendChartPath)) {
  let chartContent = fs.readFileSync(trendChartPath, 'utf8');
  if (chartContent.includes('stroke: "#0f172a"')) {
    chartContent = chartContent.replace(/stroke: "#0f172a"/g, 'stroke: "#09090b"');
    fs.writeFileSync(trendChartPath, chartContent, 'utf8');
    console.log('✅ Updated MonthlySalesTrendChart.jsx stroke');
  }
}

if (fs.existsSync(dashboardChartPath)) {
  let chartContent = fs.readFileSync(dashboardChartPath, 'utf8');
  if (chartContent.includes('stroke="#0f172a"')) {
    chartContent = chartContent.replace(/stroke="#0f172a"/g, 'stroke="#09090b"');
    fs.writeFileSync(dashboardChartPath, chartContent, 'utf8');
    console.log('✅ Updated DashboardChartsSection.jsx stroke');
  }
}

console.log('🎉 Pro UI/UX Obsidian Dark Theme applied successfully!');
