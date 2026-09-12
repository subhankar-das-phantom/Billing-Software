#!/usr/bin/env node
/**
 * Text-White Migration Script
 *
 * Systematically migrates plain text-white occurrences to theme-adaptive text-slate-100,
 * while strictly preserving text-white on colored buttons, badges, gradients, and action elements.
 *
 * Usage:
 *   node scripts/migrate-text-white.mjs          # Dry run (preview changes)
 *   node scripts/migrate-text-white.mjs --apply  # Apply changes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../src');
const APPLY = process.argv.includes('--apply');

// Colored backgrounds, buttons, badges, gradients where text-white MUST be preserved
const COLORED_ACTION_REGEX = /btn-(primary|danger|success)|enhanced-btn|badge-(primary|danger|success|info|warning|error)|bg-(blue|emerald|green|red|amber|teal|purple|indigo|violet|rose|cyan)|from-(blue|emerald|teal|cyan|purple|indigo|rose|amber)/i;

function getAllFiles(dir, extensions = ['.jsx', '.js']) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }

  return results;
}

function processLine(line) {
  if (!line.includes('text-white')) {
    return { line, changed: false };
  }

  // If the line contains a colored action element (btn-primary, bg-blue-*, badge, etc.), preserve text-white
  if (COLORED_ACTION_REGEX.test(line)) {
    return { line, changed: false, preserved: true };
  }

  let newLine = line;

  // 1. Replace hover:text-white with hover:text-slate-100 on plain surfaces
  newLine = newLine.replace(/(?<![\w-])hover:text-white(?![\w-])/g, 'hover:text-slate-100');

  // 2. Replace standalone text-white with text-slate-100
  newLine = newLine.replace(/(?<![\w-])text-white(?![\w-])/g, 'text-slate-100');

  return {
    line: newLine,
    changed: newLine !== line
  };
}

function run() {
  console.log(`\n======================================================`);
  console.log(`  TEXT-WHITE MIGRATION TOOL (${APPLY ? 'APPLY MODE' : 'DRY RUN'})`);
  console.log(`======================================================\n`);

  const files = getAllFiles(SRC_DIR);
  let totalFilesChanged = 0;
  let totalReplacements = 0;
  let totalPreserved = 0;

  for (const filePath of files) {
    const relativePath = path.relative(SRC_DIR, filePath);
    const originalContent = fs.readFileSync(filePath, 'utf8');
    const lines = originalContent.split('\n');

    let fileModified = false;
    let fileReplacements = 0;

    const newLines = lines.map((line, index) => {
      const result = processLine(line);
      if (result.preserved) {
        totalPreserved++;
      }
      if (result.changed) {
        fileModified = true;
        fileReplacements++;
        totalReplacements++;
        if (!APPLY && fileReplacements <= 3) {
          console.log(`  [${relativePath}:${index + 1}]`);
          console.log(`   - ${line.trim()}`);
          console.log(`   + ${result.line.trim()}\n`);
        }
      }
      return result.line;
    });

    if (fileModified) {
      totalFilesChanged++;
      if (APPLY) {
        fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
      }
    }
  }

  console.log(`------------------------------------------------------`);
  console.log(`Summary:`);
  console.log(`  Files scanned:         ${files.length}`);
  console.log(`  Files to update:       ${totalFilesChanged}`);
  console.log(`  Total replacements:    ${totalReplacements} (text-white -> text-slate-100)`);
  console.log(`  Preserved text-white:  ${totalPreserved} (on colored buttons/badges/gradients)`);
  console.log(`------------------------------------------------------`);

  if (!APPLY) {
    console.log(`\nTo apply these changes, run:`);
    console.log(`  node scripts/migrate-text-white.mjs --apply\n`);
  } else {
    console.log(`\n✅ Changes successfully applied to ${totalFilesChanged} files!\n`);
  }
}

run();
