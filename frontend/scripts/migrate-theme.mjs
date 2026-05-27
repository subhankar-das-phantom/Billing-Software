#!/usr/bin/env node
/**
 * Theme Migration Script
 * Replaces all hardcoded purple/indigo/violet/fuchsia colors
 * with centralized accent/accent2 tokens.
 *
 * Usage:
 *   node scripts/migrate-theme.mjs          # Dry run (preview changes)
 *   node scripts/migrate-theme.mjs --apply  # Apply changes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../src');
const APPLY = process.argv.includes('--apply');

// ═══════════════════════════════════════════════════
// REPLACEMENT RULES (order matters — longest first)
// ═══════════════════════════════════════════════════

const TAILWIND_REPLACEMENTS = [
  // purple → accent
  ['purple-400', 'accent-400'],
  ['purple-500', 'accent-500'],
  ['purple-600', 'accent-600'],

  // indigo → accent2
  ['indigo-400', 'accent2-400'],
  ['indigo-500', 'accent2-500'],
  ['indigo-600', 'accent2-600'],

  // violet → accent
  ['violet-400', 'accent-400'],
  ['violet-500', 'accent-500'],
  ['violet-600', 'accent-600'],

  // fuchsia → accent2
  ['fuchsia-400', 'accent2-400'],
  ['fuchsia-500', 'accent2-500'],
  ['fuchsia-600', 'accent2-600'],
];

const CSS_RAW_REPLACEMENTS = [
  // rgba(139, 92, 246, ...) → rgba(20, 184, 166, ...) [purple/violet → teal]
  [/rgba\(\s*139\s*,\s*92\s*,\s*246/g, 'rgba(20, 184, 166'],
  // rgba(99, 102, 241, ...) → rgba(6, 182, 212, ...) [indigo → cyan]
  [/rgba\(\s*99\s*,\s*102\s*,\s*241/g, 'rgba(6, 182, 212'],
  // rgba(30, 27, 75, ...) → rgba(6, 78, 79, ...) [dark indigo bg → dark teal bg]
  [/rgba\(\s*30\s*,\s*27\s*,\s*75/g, 'rgba(6, 78, 79'],
];

// Hex replacements that require THEME import (JS variable references)
const HEX_THEME_REPLACEMENTS = [
  // These hex values appear in dashboardService.js, NotesPage.jsx
  ["'#8b5cf6'", "THEME.accent.hex"],
  ["'#8B5CF6'", "THEME.accent.hex"],
  ["'#6366f1'", "THEME.accent2.hex"],
];

// Hex replacements that are simple string swaps (no import needed)
const HEX_INLINE_REPLACEMENTS = [
  // Console log CSS colors in api.js (single and double quoted)
  ['color: #8b5cf6', 'color: #14b8a6'],
];

// String literal color values used in dynamic class construction
const STRING_LITERAL_REPLACEMENTS = [
  // color: 'purple' → color: 'accent' (used in stat cards etc.)
  [/color:\s*'purple'/g, "color: 'accent'"],
  [/color:\s*"purple"/g, 'color: "accent"'],
  [/color="purple"/g, 'color="accent"'],

  // Color lookup map keys
  [/purple:\s*'from-purple/g, "accent: 'from-accent"],

  // id/label in customerTheme.js and NotesPage.jsx
  [/id:\s*'purple'/g, "id: 'teal'"],
  [/label:\s*'Purple'/g, "label: 'Teal'"],
];

// ═══════════════════════════════════════════════════
// FILES THAT NEED THEME IMPORT (for hex replacements)
// ═══════════════════════════════════════════════════

const FILES_NEEDING_THEME_IMPORT = [
  'services/dashboardService.js',
  'pages/NotesPage.jsx',
];

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function getAllFiles(dir, extensions = ['.jsx', '.js', '.css']) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...getAllFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function applyReplacements(content, filePath) {
  let modified = content;
  const changes = [];
  const relPath = path.relative(SRC_DIR, filePath);

  // 1. CSS raw value replacements (rgba)
  for (const [regex, replacement] of CSS_RAW_REPLACEMENTS) {
    const matches = modified.match(regex);
    if (matches) {
      changes.push(`  rgba() → ${replacement}... (${matches.length}×)`);
      modified = modified.replace(regex, replacement);
    }
  }

  // 2a. Hex value replacements requiring THEME import (only in specific files)
  const isHexFile = FILES_NEEDING_THEME_IMPORT.some(f => relPath.replace(/\\/g, '/').endsWith(f));
  if (isHexFile) {
    for (const [oldVal, newVal] of HEX_THEME_REPLACEMENTS) {
      if (modified.includes(oldVal)) {
        const count = modified.split(oldVal).length - 1;
        changes.push(`  ${oldVal} → ${newVal} (${count}×)`);
        modified = modified.replaceAll(oldVal, newVal);
      }
    }
  }

  // 2b. Inline hex swaps (simple string replacement, no import needed)
  for (const [oldVal, newVal] of HEX_INLINE_REPLACEMENTS) {
    if (modified.includes(oldVal)) {
      const count = modified.split(oldVal).length - 1;
      changes.push(`  ${oldVal} → ${newVal} (${count}×)`);
      modified = modified.replaceAll(oldVal, newVal);
    }
  }

  // 3. String literal replacements (color: 'purple', etc.)
  for (const [regex, replacement] of STRING_LITERAL_REPLACEMENTS) {
    const matches = modified.match(regex);
    if (matches) {
      changes.push(`  ${regex.source || regex} → ${replacement} (${matches.length}×)`);
      modified = modified.replace(regex, replacement);
    }
  }

  // 4. Tailwind class replacements (the bulk)
  for (const [oldColor, newColor] of TAILWIND_REPLACEMENTS) {
    if (modified.includes(oldColor)) {
      const count = modified.split(oldColor).length - 1;
      changes.push(`  ${oldColor} → ${newColor} (${count}×)`);
      modified = modified.replaceAll(oldColor, newColor);
    }
  }

  return { modified, changes };
}

function addThemeImport(content, filePath) {
  const relPath = path.relative(SRC_DIR, filePath).replace(/\\/g, '/');
  const needsImport = FILES_NEEDING_THEME_IMPORT.some(f => relPath.endsWith(f));

  if (!needsImport) return content;
  if (content.includes('themeColors')) return content; // Already imported

  // Calculate relative path to utils/themeColors.js
  const fileDir = path.dirname(filePath);
  const themeColorsPath = path.resolve(SRC_DIR, 'utils/themeColors.js');
  let relativePath = path.relative(fileDir, themeColorsPath).replace(/\\/g, '/');
  if (!relativePath.startsWith('.')) relativePath = './' + relativePath;
  // Remove .js extension for cleaner imports
  relativePath = relativePath.replace(/\.js$/, '');

  // Add import after the last existing import
  const lines = content.split('\n');
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith('import ')) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, `import { THEME } from '${relativePath}';`);
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════

console.log(`\n🎨 Theme Migration: purple/indigo → accent/accent2 tokens`);
console.log(`   Mode: ${APPLY ? '🔴 APPLYING CHANGES' : '🟡 DRY RUN (use --apply to write)'}\n`);

const files = getAllFiles(SRC_DIR);
let totalFiles = 0;
let totalChanges = 0;

for (const filePath of files) {
  const relPath = path.relative(SRC_DIR, filePath);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Apply replacements
  const { modified, changes } = applyReplacements(content, filePath);

  if (changes.length === 0) continue;

  // Add THEME import if needed
  const finalContent = addThemeImport(modified, filePath);

  totalFiles++;
  totalChanges += changes.length;

  console.log(`📄 ${relPath}`);
  for (const change of changes) {
    console.log(change);
  }
  if (finalContent !== modified) {
    console.log(`  + Added THEME import`);
  }
  console.log('');

  if (APPLY) {
    fs.writeFileSync(filePath, finalContent, 'utf-8');
  }
}

console.log(`${'─'.repeat(50)}`);
console.log(`✅ ${totalFiles} files with ${totalChanges} replacement groups`);

if (!APPLY) {
  console.log(`\n💡 Run with --apply to write changes:`);
  console.log(`   node scripts/migrate-theme.mjs --apply\n`);
} else {
  console.log(`\n🎉 All changes applied!\n`);
  console.log(`⚠️  Manual steps remaining:`);
  console.log(`   1. Add @theme block to index.css (before @layer base)`);
  console.log(`   2. Create src/utils/themeColors.js`);
  console.log(`   3. Run: npm run dev — verify no errors`);
  console.log(`   4. Visual QA on key pages\n`);
}
