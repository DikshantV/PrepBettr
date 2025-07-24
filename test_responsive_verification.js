#!/usr/bin/env node

/**
 * Responsive Design Verification Script
 * 
 * This script helps verify the responsive design aspects of the dashboard
 * and confirms that the marketing loader is properly implemented.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Responsive Design Verification Script');
console.log('=========================================\n');

// Check for responsive design patterns in the codebase
function checkResponsivePatterns() {
  console.log('1. Checking for Tailwind responsive classes...');
  
  const responsiveClasses = [
    'sm:', 'md:', 'lg:', 'xl:', '2xl:',
    // Flexbox responsive
    'flex-col', 'sm:flex-row', 'md:flex-row', 'lg:flex-row',
    // Grid responsive
    'grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4',
    // Spacing responsive
    'px-4', 'sm:px-6', 'md:px-8', 'lg:px-12',
    // Text responsive
    'text-sm', 'sm:text-base', 'md:text-lg', 'lg:text-xl'
  ];
  
  const filesToCheck = [
    'app/dashboard/DashboardClient.tsx',
    'components/DashboardLayout.tsx',
    'components/authenticated-layout.tsx',
    'app/marketing/page.tsx'
  ];
  
  let responsiveCount = 0;
  
  filesToCheck.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const foundClasses = responsiveClasses.filter(cls => content.includes(cls));
      if (foundClasses.length > 0) {
        console.log(`   ✅ ${file}: Found ${foundClasses.length} responsive classes`);
        responsiveCount += foundClasses.length;
      } else {
        console.log(`   ⚠️  ${file}: No responsive classes found`);
      }
    } else {
      console.log(`   ❌ ${file}: File not found`);
    }
  });
  
  console.log(`   📊 Total responsive classes found: ${responsiveCount}\n`);
  return responsiveCount > 0;
}

// Check for loader implementation with timing
function checkLoaderImplementation() {
  console.log('2. Checking loader implementation...');
  
  const files = [
    'hooks/usePageLoadComplete.tsx',
    'components/ui/BanterLoader.tsx',
    'components/ui/loader.tsx'
  ];
  
  let hasMinimumDelay = false;
  
  files.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for 500ms delay
      if (content.includes('500') && (content.includes('setTimeout') || content.includes('delay'))) {
        console.log(`   ✅ ${file}: Found 500ms delay implementation`);
        hasMinimumDelay = true;
      } else {
        console.log(`   ℹ️  ${file}: File exists but no 500ms delay found`);
      }
    } else {
      console.log(`   ❌ ${file}: File not found`);
    }
  });
  
  console.log();
  return hasMinimumDelay;
}

// Check CSS for responsive breakpoints
function checkCSSBreakpoints() {
  console.log('3. Checking CSS for responsive breakpoints...');
  
  const cssFiles = [
    'app/globals.css',
    'tailwind.config.js',
    'tailwind.config.ts'
  ];
  
  let hasBreakpoints = false;
  
  cssFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for common breakpoints
      const breakpoints = ['320px', '768px', '1024px', '1280px', '1536px'];
      const foundBreakpoints = breakpoints.filter(bp => content.includes(bp));
      
      if (foundBreakpoints.length > 0) {
        console.log(`   ✅ ${file}: Found breakpoints: ${foundBreakpoints.join(', ')}`);
        hasBreakpoints = true;
      } else if (content.includes('@media') || content.includes('screens')) {
        console.log(`   ✅ ${file}: Contains media queries or screen configurations`);
        hasBreakpoints = true;
      } else {
        console.log(`   ℹ️  ${file}: No explicit breakpoints found`);
      }
    }
  });
  
  console.log();
  return hasBreakpoints;
}

// Generate viewport testing commands
function generateTestingCommands() {
  console.log('4. Manual Testing Commands');
  console.log('==========================');
  
  const viewports = [
    { name: 'Mobile', width: 320, height: 568 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1280, height: 800 }
  ];
  
  console.log('To test responsiveness manually:');
  console.log('1. Open Chrome DevTools (F12)');
  console.log('2. Click the device toolbar icon');
  console.log('3. Set these dimensions and test:\n');
  
  viewports.forEach(viewport => {
    console.log(`   ${viewport.name}: ${viewport.width}px × ${viewport.height}px`);
    console.log(`   - Check layout adapts properly`);
    console.log(`   - Verify no horizontal scrolling`);
    console.log(`   - Test all interactive elements\n`);
  });
  
  console.log('To test loader timing:');
  console.log('1. Open Chrome DevTools');
  console.log('2. Go to Network tab');
  console.log('3. Set throttling to "Slow 3G"');
  console.log('4. Navigate to /marketing');
  console.log('5. Verify loader displays for ≥500ms\n');
}

// Main execution
function main() {
  const responsiveCheck = checkResponsivePatterns();
  const loaderCheck = checkLoaderImplementation();
  const cssCheck = checkCSSBreakpoints();
  
  generateTestingCommands();
  
  console.log('5. Summary');
  console.log('==========');
  console.log(`Responsive patterns: ${responsiveCheck ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Loader implementation: ${loaderCheck ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`CSS breakpoints: ${cssCheck ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = responsiveCheck && loaderCheck && cssCheck;
  console.log(`\nOverall: ${allPassed ? '✅ READY FOR MANUAL TESTING' : '⚠️  NEEDS ATTENTION'}`);
  
  if (allPassed) {
    console.log('\n📋 Next Steps:');
    console.log('1. Start the development server: npm run dev');
    console.log('2. Follow the manual testing guide in manual_testing_guide.md');
    console.log('3. Test responsiveness at 320px, 768px, and 1280px widths');
    console.log('4. Verify loader timing with slow-3G throttling');
  }
  
  return allPassed;
}

// Run the script
if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}

module.exports = { checkResponsivePatterns, checkLoaderImplementation, checkCSSBreakpoints };
