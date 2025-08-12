const lighthouse = require('lighthouse').default;
const chromeLauncher = require('chrome-launcher');

async function runLighthouseAudit() {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-web-security', '--no-sandbox']
  });

  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['accessibility'],
    port: chrome.port,
  };

  // Desktop audit
  console.log('🖥️  Running Desktop Lighthouse audit...');
  const desktopConfig = {
    extends: 'lighthouse:default',
    settings: {
      formFactor: 'desktop',
      throttling: {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1,
        requestLatencyMs: 0,
        downloadThroughputKbps: 0,
        uploadThroughputKbps: 0,
      },
      screenEmulation: {
        mobile: false,
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        disabled: false,
      },
      emulatedUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
  };

  const desktopResults = await lighthouse('http://localhost:3000/community-mock-interview/interview', options, desktopConfig);

  // Mobile audit
  console.log('📱 Running Mobile Lighthouse audit...');
  const mobileConfig = {
    extends: 'lighthouse:default',
    settings: {
      formFactor: 'mobile',
      throttling: {
        rttMs: 150,
        throughputKbps: 1600,
        cpuSlowdownMultiplier: 4,
        requestLatencyMs: 0,
        downloadThroughputKbps: 0,
        uploadThroughputKbps: 0,
      },
      screenEmulation: {
        mobile: true,
        width: 375,
        height: 667,
        deviceScaleFactor: 2,
        disabled: false,
      },
      emulatedUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    },
  };

  const mobileResults = await lighthouse('http://localhost:3000/community-mock-interview/interview', options, mobileConfig);

  await chrome.kill();

  return {
    desktop: desktopResults,
    mobile: mobileResults
  };
}

function analyzeResults(results, formFactor) {
  const lhr = results.lhr;
  const accessibility = lhr.categories.accessibility;
  
  console.log(`\n📊 ${formFactor} Lighthouse Results:`);
  console.log(`- Accessibility Score: ${Math.round(accessibility.score * 100)}/100`);
  
  // Check for violations
  const audits = lhr.audits;
  const violations = [];
  
  Object.keys(audits).forEach(auditId => {
    const audit = audits[auditId];
    if (audit.score !== null && audit.score < 1 && audit.scoreDisplayMode !== 'notApplicable') {
      violations.push({
        id: auditId,
        title: audit.title,
        description: audit.description,
        score: audit.score,
        details: audit.details
      });
    }
  });

  if (violations.length === 0) {
    console.log('✅ No accessibility violations found!');
  } else {
    console.log(`⚠️  Found ${violations.length} accessibility issues:`);
    violations.forEach((violation, index) => {
      console.log(`${index + 1}. ${violation.title} (Score: ${Math.round(violation.score * 100)}/100)`);
      console.log(`   ${violation.description}`);
    });
  }

  return {
    score: accessibility.score,
    violations: violations
  };
}

async function main() {
  try {
    console.log('🚀 Starting Lighthouse accessibility audit...');
    const results = await runLighthouseAudit();
    
    const desktopAnalysis = analyzeResults(results.desktop, 'Desktop');
    const mobileAnalysis = analyzeResults(results.mobile, 'Mobile');
    
    console.log('\n📈 Summary:');
    console.log(`Desktop: ${Math.round(desktopAnalysis.score * 100)}/100 (${desktopAnalysis.violations.length} issues)`);
    console.log(`Mobile: ${Math.round(mobileAnalysis.score * 100)}/100 (${mobileAnalysis.violations.length} issues)`);
    
    if (desktopAnalysis.violations.length === 0 && mobileAnalysis.violations.length === 0) {
      console.log('🎉 All accessibility tests passed!');
    }
    
  } catch (error) {
    console.error('❌ Error running Lighthouse audit:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
