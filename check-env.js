"use strict";

// Check for required Firebase environment variables
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
];

console.log('Checking Firebase environment variables...\n');

let missingVars = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingVars.push(envVar);
    console.log(`❌ Missing: ${envVar}`);
  } else {
    // Only show first few characters for security
    const value = process.env[envVar];
    const maskedValue = value.length > 10 
      ? `${value.substring(0, 5)}...${value.substring(value.length - 5)}`
      : '✓✓✓ (present)';
    console.log(`✅ Found: ${envVar} = ${maskedValue}`);
  }
}

if (missingVars.length > 0) {
  console.log('\n⚠️ Warning: Missing required environment variables. Tests may fail.');
  console.log('Please set the following environment variables:');
  missingVars.forEach(variable => console.log(`  - ${variable}`));
} else {
  console.log('\n✅ All required environment variables are set.');
}
