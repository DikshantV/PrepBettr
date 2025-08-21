const path = require('path');

// Test Firebase admin import issues
console.log('=== Firebase Import Test ===');

try {
  // Try the relative import from middleware
  const middlewarePath = path.join(__dirname, 'lib', 'middleware', 'authMiddleware.ts');
  console.log('Middleware path:', middlewarePath);
  
  // Try to check the firebase admin import
  const adminPath = path.join(__dirname, 'firebase', 'admin.ts');
  console.log('Admin path:', adminPath);
  
  const libAdminPath = path.join(__dirname, 'lib', 'firebase', 'admin.ts');
  console.log('Lib Admin path:', libAdminPath);
  
  const fs = require('fs');
  
  // Check which files exist
  console.log('middleware exists:', fs.existsSync(middlewarePath));
  console.log('firebase/admin exists:', fs.existsSync(adminPath));
  console.log('lib/firebase/admin exists:', fs.existsSync(libAdminPath));
  
  // Check the import statement in middleware
  if (fs.existsSync(middlewarePath)) {
    const content = fs.readFileSync(middlewarePath, 'utf8');
    const importLine = content.split('\n').find(line => line.includes("from '@/firebase/admin'"));
    console.log('Import line:', importLine);
  }
  
} catch (error) {
  console.error('Error:', error.message);
}

console.log('=== End Firebase Test ===');
