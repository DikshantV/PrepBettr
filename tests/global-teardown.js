const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('\n🧹 Cleaning up test environment...');

  // Calculate total test runtime
  if (global.testStartTime) {
    const totalRuntime = Date.now() - global.testStartTime;
    console.log(`⏱️ Total test runtime: ${(totalRuntime / 1000).toFixed(2)}s`);
  }

  // Clean up temporary test files
  const tmpDir = path.join(__dirname, 'tmp');
  if (fs.existsSync(tmpDir)) {
    try {
      const files = fs.readdirSync(tmpDir);
      for (const file of files) {
        const filePath = path.join(tmpDir, file);
        fs.unlinkSync(filePath);
      }
      console.log('🗑️ Cleaned up temporary test files');
    } catch (error) {
      console.warn('⚠️ Warning: Failed to clean up temporary files:', error.message);
    }
  }

  // Clean up screenshot files older than 1 hour (in case of test failures)
  const screenshotDir = path.join(__dirname, 'screenshots');
  if (fs.existsSync(screenshotDir)) {
    try {
      const files = fs.readdirSync(screenshotDir);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      let cleanedCount = 0;
      for (const file of files) {
        const filePath = path.join(screenshotDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < oneHourAgo) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🖼️ Cleaned up ${cleanedCount} old screenshot files`);
      }
    } catch (error) {
      console.warn('⚠️ Warning: Failed to clean up screenshot files:', error.message);
    }
  }

  // Report coverage information location
  const coverageDir = path.join(__dirname, 'coverage');
  if (fs.existsSync(coverageDir)) {
    console.log(`📊 Coverage report available at: ${coverageDir}/index.html`);
  }

  // Report test results location
  const reportsDir = path.join(__dirname, 'reports');
  if (fs.existsSync(reportsDir)) {
    console.log(`📋 Test reports available at: ${reportsDir}/`);
  }

  console.log('✅ Test environment cleanup completed\n');
};
