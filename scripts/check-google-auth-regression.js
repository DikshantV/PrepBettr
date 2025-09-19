#!/usr/bin/env node
/**
 * Regression Prevention Script for GoogleAuthButton
 * 
 * This script checks that GoogleAuthButton uses the helper function approach
 * and not the direct Firebase SDK calls that caused the issue.
 * 
 * Run with: node scripts/check-google-auth-regression.js
 */

const fs = require('fs');
const path = require('path');

const GOOGLE_AUTH_BUTTON_PATH = path.join(__dirname, '..', 'components', 'GoogleAuthButton.tsx');

function checkGoogleAuthButtonRegression() {
  if (!fs.existsSync(GOOGLE_AUTH_BUTTON_PATH)) {
    console.error('❌ GoogleAuthButton.tsx not found at expected path');
    process.exit(1);
  }

  const content = fs.readFileSync(GOOGLE_AUTH_BUTTON_PATH, 'utf8');
  
  // Check for correct helper function import
  const hasHelperImport = content.includes('import { authenticateWithGoogle, validateFirebaseIdToken } from "@/lib/firebase/auth.js"');
  
  // Check for problematic direct Firebase imports (broken version)
  const hasDirectFirebaseImport = content.includes('from "@/firebase/client"');
  const hasDirectAuthImport = content.includes('from "firebase/auth"');
  const hasUseFirebaseReady = content.includes('useFirebaseReady');
  
  // Check for helper function usage
  const usesHelperFunction = content.includes('await authenticateWithGoogle()');
  
  // Check for direct Firebase calls (broken version)
  const usesDirectFirebase = content.includes('signInWithPopup(authService, providerService)') || 
                            content.includes('auth()') || 
                            content.includes('googleProvider()');

  console.log('🔍 GoogleAuthButton Regression Check');
  console.log('=====================================');
  
  let hasIssues = false;
  
  if (!hasHelperImport) {
    console.error('❌ Missing helper function import from @/lib/firebase/auth.js');
    hasIssues = true;
  } else {
    console.log('✅ Correct helper function import found');
  }
  
  if (!usesHelperFunction) {
    console.error('❌ Missing authenticateWithGoogle() helper function call');
    hasIssues = true;
  } else {
    console.log('✅ Uses authenticateWithGoogle() helper function');
  }
  
  if (hasDirectFirebaseImport) {
    console.error('❌ Found direct Firebase client import - this may indicate regression');
    hasIssues = true;
  } else {
    console.log('✅ No direct Firebase client imports');
  }
  
  if (hasDirectAuthImport) {
    console.error('❌ Found direct firebase/auth import - this may indicate regression');  
    hasIssues = true;
  } else {
    console.log('✅ No direct firebase/auth imports');
  }
  
  if (hasUseFirebaseReady) {
    console.error('❌ Found useFirebaseReady hook - this indicates the broken complex implementation');
    hasIssues = true;
  } else {
    console.log('✅ No useFirebaseReady hook (good - simpler implementation)');
  }
  
  if (usesDirectFirebase) {
    console.error('❌ Found direct Firebase SDK calls - this may indicate regression to broken version');
    hasIssues = true;
  } else {
    console.log('✅ No direct Firebase SDK calls');
  }
  
  if (hasIssues) {
    console.log('\n❌ REGRESSION DETECTED!');
    console.log('The GoogleAuthButton appears to have reverted to the problematic direct Firebase implementation.');
    console.log('Please ensure it uses the helper function approach from commit 8b3c2d7.');
    console.log('\nFor reference, the working implementation should:');
    console.log('- Import from "@/lib/firebase/auth.js"');
    console.log('- Use authenticateWithGoogle() helper');
    console.log('- NOT use direct Firebase SDK calls');
    console.log('- NOT use useFirebaseReady hook');
    process.exit(1);
  } else {
    console.log('\n✅ All checks passed! GoogleAuthButton uses the correct helper-function implementation.');
  }
}

if (require.main === module) {
  checkGoogleAuthButtonRegression();
}

module.exports = { checkGoogleAuthButtonRegression };