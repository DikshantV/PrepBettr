#!/usr/bin/env node

/**
 * Check for duplicate API routes between Pages Router and App Router
 * This script helps prevent routing conflicts in Next.js 15
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');

function getAppRouterRoutes(): string[] {
  try {
    const cmd = `find "${REPO_ROOT}/app/api" -name "route.ts" | sed 's|/route.ts||' | sed 's|.*/app/api/||'`;
    const output = execSync(cmd, { encoding: 'utf-8' });
    return output.trim().split('\n').filter(route => route.length > 0).sort();
  } catch (error) {
    return [];
  }
}

function getPagesRouterRoutes(): string[] {
  try {
    const cmd = `find "${REPO_ROOT}/pages/api" -name "*.ts" | sed 's|.*/pages/api/||' | sed 's|\\.ts||'`;
    const output = execSync(cmd, { encoding: 'utf-8' });
    return output.trim().split('\n').filter(route => route.length > 0).sort();
  } catch (error) {
    return [];
  }
}

function findDuplicates(appRoutes: string[], pagesRoutes: string[]): string[] {
  const duplicates: string[] = [];
  
  for (const route of appRoutes) {
    if (pagesRoutes.includes(route)) {
      duplicates.push(route);
    }
  }
  
  return duplicates;
}

function main(): void {
  console.log('🔍 Checking for duplicate API routes...\n');

  // Check if directories exist
  const appApiExists = existsSync(path.join(REPO_ROOT, 'app/api'));
  const pagesApiExists = existsSync(path.join(REPO_ROOT, 'pages/api'));

  if (!appApiExists && !pagesApiExists) {
    console.log('ℹ️  No API directories found. Skipping check.');
    process.exit(0);
  }

  const appRoutes = getAppRouterRoutes();
  const pagesRoutes = getPagesRouterRoutes();

  console.log(`📁 App Router routes (${appRoutes.length}):`);
  appRoutes.forEach(route => console.log(`   /api/${route}`));

  console.log(`\n📄 Pages Router routes (${pagesRoutes.length}):`);
  pagesRoutes.forEach(route => console.log(`   /api/${route}`));

  const duplicates = findDuplicates(appRoutes, pagesRoutes);

  if (duplicates.length === 0) {
    console.log('\n✅ No duplicate routes found! Your routing is clean.');
    process.exit(0);
  }

  console.log(`\n🚨 Found ${duplicates.length} duplicate route(s):\n`);
  
  duplicates.forEach(route => {
    console.log(`❌ Duplicate: /api/${route}`);
    console.log(`   App Router:   app/api/${route}/route.ts`);
    console.log(`   Pages Router: pages/api/${route}.ts\n`);
  });

  console.log('🔧 To fix these duplicates:');
  console.log('1. Choose one canonical location (prefer App Router for Next.js 15)');
  console.log('2. Migrate or remove the duplicate files');
  console.log('3. Test that all endpoints still work correctly\n');

  console.log('💡 For Next.js 15, we recommend using App Router (app/api) exclusively.');
  
  process.exit(1); // Exit with error code for CI
}

if (require.main === module) {
  main();
}

export { getAppRouterRoutes, getPagesRouterRoutes, findDuplicates };
