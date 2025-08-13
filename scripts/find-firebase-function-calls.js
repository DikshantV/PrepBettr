#!/usr/bin/env node

/**
 * Firebase to Azure Functions Migration Scanner
 * 
 * This script scans your codebase to find Firebase Cloud Function calls
 * that may need to be migrated to Azure Functions.
 */

const fs = require('fs');
const path = require('path');

// File extensions to scan
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Patterns to look for
const PATTERNS = {
  firebaseFunction: /firebase\.functions\(\)/g,
  httpsCallable: /httpsCallable\s*\(/g,
  functionsCallable: /functions\(\)\.httpsCallable/g,
  specificFunctions: {
    verifyToken: /['"`]verifyToken['"`]/g,
    createSessionCookie: /['"`]createSessionCookie['"`]/g,
    deleteUserData: /['"`]deleteUserData['"`]/g,
    onUserPlanChange: /['"`]onUserPlanChange['"`]/g,
    processScheduledDeletions: /['"`]processScheduledDeletions['"`]/g
  }
};

// Directories to exclude from scanning
const EXCLUDE_DIRS = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'azure/node_modules',
  'coverage',
  'coverage-baseline-cleanup'
];

/**
 * Check if file should be scanned
 */
function shouldScanFile(filePath) {
  const ext = path.extname(filePath);
  return EXTENSIONS.includes(ext);
}

/**
 * Check if directory should be excluded
 */
function shouldExcludeDir(dirPath) {
  const dirName = path.basename(dirPath);
  return EXCLUDE_DIRS.some(exclude => 
    dirName === exclude || dirPath.includes(`/${exclude}/`)
  );
}

/**
 * Scan file for Firebase function patterns
 */
function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const results = [];
    
    // Check for general Firebase function patterns
    Object.entries(PATTERNS).forEach(([patternName, pattern]) => {
      if (patternName === 'specificFunctions') {
        // Handle specific function name patterns
        Object.entries(pattern).forEach(([funcName, funcPattern]) => {
          const matches = [...content.matchAll(funcPattern)];
          if (matches.length > 0) {
            matches.forEach(match => {
              results.push({
                type: 'specific-function',
                pattern: funcName,
                line: getLineNumber(content, match.index),
                match: match[0]
              });
            });
          }
        });
      } else {
        const matches = [...content.matchAll(pattern)];
        if (matches.length > 0) {
          matches.forEach(match => {
            results.push({
              type: 'general-pattern',
              pattern: patternName,
              line: getLineNumber(content, match.index),
              match: match[0]
            });
          });
        }
      }
    });
    
    return results;
  } catch (error) {
    console.error(`Error scanning file ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Get line number from character index
 */
function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

/**
 * Recursively scan directory
 */
function scanDirectory(dirPath) {
  const results = {};
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        if (!shouldExcludeDir(itemPath)) {
          const subResults = scanDirectory(itemPath);
          Object.assign(results, subResults);
        }
      } else if (stat.isFile() && shouldScanFile(itemPath)) {
        const fileResults = scanFile(itemPath);
        if (fileResults.length > 0) {
          results[itemPath] = fileResults;
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error.message);
  }
  
  return results;
}

/**
 * Generate migration suggestions
 */
function generateSuggestions(results) {
  const suggestions = [];
  
  Object.entries(results).forEach(([filePath, matches]) => {
    matches.forEach(match => {
      switch (match.pattern) {
        case 'verifyToken':
          suggestions.push({
            file: filePath,
            line: match.line,
            issue: 'Direct call to Firebase verifyToken function',
            suggestion: 'Replace with azureFunctionsClient.verifyToken(token)',
            priority: 'HIGH'
          });
          break;
        case 'createSessionCookie':
          suggestions.push({
            file: filePath,
            line: match.line,
            issue: 'Direct call to Firebase createSessionCookie function',
            suggestion: 'Replace with azureFunctionsClient.createSessionCookie(idToken)',
            priority: 'HIGH'
          });
          break;
        case 'deleteUserData':
          suggestions.push({
            file: filePath,
            line: match.line,
            issue: 'Direct call to Firebase deleteUserData function',
            suggestion: 'Replace with azureFunctionsClient.requestGDPRDeletion(userId, userEmail, reason)',
            priority: 'MEDIUM'
          });
          break;
        default:
          suggestions.push({
            file: filePath,
            line: match.line,
            issue: `Firebase function pattern found: ${match.pattern}`,
            suggestion: 'Review and consider migrating to Azure Functions',
            priority: 'LOW'
          });
      }
    });
  });
  
  return suggestions;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Scanning codebase for Firebase Cloud Function calls...\n');
  
  const rootDir = process.argv[2] || process.cwd();
  
  if (!fs.existsSync(rootDir)) {
    console.error(`Directory not found: ${rootDir}`);
    process.exit(1);
  }
  
  console.log(`Scanning: ${rootDir}`);
  console.log(`Excluding: ${EXCLUDE_DIRS.join(', ')}\n`);
  
  const results = scanDirectory(rootDir);
  const suggestions = generateSuggestions(results);
  
  if (Object.keys(results).length === 0) {
    console.log('✅ No Firebase Cloud Function calls found!');
    return;
  }
  
  console.log(`📊 Found ${Object.keys(results).length} files with Firebase function calls:\n`);
  
  // Display results by file
  Object.entries(results).forEach(([filePath, matches]) => {
    const relativePath = path.relative(rootDir, filePath);
    console.log(`📄 ${relativePath}`);
    
    matches.forEach(match => {
      console.log(`   Line ${match.line}: ${match.pattern} (${match.match})`);
    });
    console.log('');
  });
  
  // Display migration suggestions
  if (suggestions.length > 0) {
    console.log('🔄 Migration Suggestions:\n');
    
    const priorityOrder = ['HIGH', 'MEDIUM', 'LOW'];
    priorityOrder.forEach(priority => {
      const prioritySuggestions = suggestions.filter(s => s.priority === priority);
      if (prioritySuggestions.length > 0) {
        console.log(`${priority} PRIORITY:`);
        prioritySuggestions.forEach(suggestion => {
          const relativePath = path.relative(rootDir, suggestion.file);
          console.log(`  📍 ${relativePath}:${suggestion.line}`);
          console.log(`     Issue: ${suggestion.issue}`);
          console.log(`     Fix: ${suggestion.suggestion}\n`);
        });
      }
    });
  }
  
  // Summary
  console.log('📋 Summary:');
  console.log(`   Files scanned: ${Object.keys(results).length}`);
  console.log(`   Total matches: ${Object.values(results).flat().length}`);
  console.log(`   High priority fixes: ${suggestions.filter(s => s.priority === 'HIGH').length}`);
  console.log(`   Medium priority fixes: ${suggestions.filter(s => s.priority === 'MEDIUM').length}`);
  console.log(`   Low priority fixes: ${suggestions.filter(s => s.priority === 'LOW').length}\n`);
  
  console.log('📖 For migration guide, see: scripts/firebase-to-azure-migration-guide.md');
  
  // Exit with error code if high priority issues found
  const highPriorityIssues = suggestions.filter(s => s.priority === 'HIGH').length;
  if (highPriorityIssues > 0) {
    console.log(`\n⚠️  ${highPriorityIssues} high priority migration issues need attention!`);
    process.exit(1);
  }
}

// Run the scanner
if (require.main === module) {
  main();
}

module.exports = {
  scanDirectory,
  scanFile,
  generateSuggestions
};
