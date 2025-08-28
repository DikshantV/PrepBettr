const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('🚀 Setting up test environment...\n');

  // Create necessary directories for test artifacts
  const testDirs = [
    'tests/coverage',
    'tests/reports',
    'tests/screenshots',
    'tests/tmp'
  ];

  for (const dir of testDirs) {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }

  // Set up test environment variables
  process.env.NODE_ENV = 'test';
  process.env.AZURE_COSMOS_ENDPOINT = 'https://test-cosmos.documents.azure.com:443/';
  process.env.AZURE_COSMOS_DATABASE_ID = 'test-db';
  process.env.AZURE_OPENAI_ENDPOINT = 'https://test-openai.openai.azure.com/';
  process.env.AZURE_OPENAI_API_VERSION = '2024-02-15-preview';

  // Mock external dependencies that shouldn't run in tests
  process.env.DISABLE_EXTERNAL_CALLS = 'true';
  process.env.MOCK_BROWSER_SERVICE = 'true';
  process.env.MOCK_COSMOS_DB = 'true';

  console.log('✅ Environment variables configured');

  // Set global timeout for test operations
  global.testStartTime = Date.now();

  console.log('🧪 Test environment ready!\n');
};
