#!/usr/bin/env node

/**
 * Pre-commit hook to prevent installation of React Server Component packages
 * This helps maintain client-side only architecture
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FORBIDDEN_PACKAGES = [
  'react-server-dom-webpack',
  'react-server-dom-parcel',
  'react-server-dom-turbopack',
];

const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

const allDependencies = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
};

const foundForbidden = FORBIDDEN_PACKAGES.filter(pkg => allDependencies[pkg]);

if (foundForbidden.length > 0) {
  console.error('❌ SECURITY VIOLATION: Forbidden packages detected!');
  console.error('');
  console.error('The following packages enable React Server Components and are NOT allowed:');
  foundForbidden.forEach(pkg => console.error(`  - ${pkg}`));
  console.error('');
  console.error('This project uses CLIENT-SIDE RENDERING ONLY.');
  console.error('See SECURITY.md for more information.');
  console.error('');
  process.exit(1);
}

console.log('✅ Package.json security check passed');
process.exit(0);

