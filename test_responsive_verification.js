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

// Check for form centering implementation  
function checkFormCentering() {
  console.log('2. Checking form centering implementation...');
  
  const authLayoutFile = 'app/(auth)/layout.tsx';
  
  if (fs.existsSync(authLayoutFile)) {
    const content = fs.readFileSync(authLayoutFile, 'utf8');
    
    // Check for the required centering classes
    const hasFlexCenter = content.includes('min-h-screen flex items-center justify-center');
    const hasPadding = content.includes('p-4');
    const hasOverflowAuto = content.includes('overflow-auto');
    
    console.log(`   ${hasFlexCenter ? '✅' : '❌'} Flex centering: ${hasFlexCenter}`);
    console.log(`   ${hasPadding ? '✅' : '❌'} Padding (p-4): ${hasPadding}`);
    console.log(`   ${hasOverflowAuto ? '✅' : '❌'} Overflow auto: ${hasOverflowAuto}`);
    
    const allCenteringFeatures = hasFlexCenter && hasPadding && hasOverflowAuto;
    console.log(`   📊 Form centering implementation: ${allCenteringFeatures ? 'COMPLETE' : 'INCOMPLETE'}\n`);
    return allCenteringFeatures;
  } else {
    console.log(`   ❌ ${authLayoutFile}: File not found\n`);
    return false;
  }
}

// Check for loader implementation with timing
function checkLoaderImplementation() {
  console.log('3. Checking loader implementation...');
  
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
  console.log('4. Checking CSS for responsive breakpoints...');
  
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
  console.log('5. Manual Testing Commands');
  console.log('==========================');
  
  const viewports = [
    { name: 'Mobile (320px)', width: 320, height: 568 },
    { name: 'Tablet (768px)', width: 768, height: 1024 },
    { name: 'Desktop (1280px)', width: 1280, height: 800 },
    { name: 'Large Desktop (1920px)', width: 1920, height: 1080 }
  ];
  
  console.log('To test form centering manually:');
  console.log('1. Navigate to /sign-in or /sign-up');
  console.log('2. Open Chrome DevTools (F12)');
  console.log('3. Click the device toolbar icon');
  console.log('4. Set these dimensions and verify form centering:\n');
  
  viewports.forEach(viewport => {
    console.log(`   ${viewport.name}: ${viewport.width}px × ${viewport.height}px`);
    console.log(`   - Form stays horizontally centered`);
    console.log(`   - Form stays vertically centered when space allows`);
    console.log(`   - Form moves to top-center with scroll when needed`);
    console.log(`   - No horizontal overflow issues\n`);
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
  const formCenteringCheck = checkFormCentering();
  const loaderCheck = checkLoaderImplementation();
  const cssCheck = checkCSSBreakpoints();
  
  generateTestingCommands();
  
  console.log('6. Summary');
  console.log('==========');
  console.log(`Responsive patterns: ${responsiveCheck ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Form centering: ${formCenteringCheck ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Loader implementation: ${loaderCheck ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`CSS breakpoints: ${cssCheck ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = responsiveCheck && formCenteringCheck && loaderCheck && cssCheck;
  console.log(`\nOverall: ${allPassed ? '✅ READY FOR MANUAL TESTING' : '⚠️  NEEDS ATTENTION'}`);
  
  if (allPassed) {
    console.log('\n📋 Next Steps:');
    console.log('1. Start the development server: npm run dev');
    console.log('2. Navigate to /sign-in or /sign-up');
    console.log('3. Test form centering at 320px, 768px, 1280px, and 1920px widths');
    console.log('4. Verify form stays centered vertically/horizontally when space allows');
    console.log('5. Verify form moves to top-center with scroll on small screens');
  }
  
  return allPassed;
}

// Run the script
if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}

module.exports = { checkResponsivePatterns, checkLoaderImplementation, checkCSSBreakpoints };
