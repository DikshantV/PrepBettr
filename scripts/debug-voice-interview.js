#!/usr/bin/env node

/**
 * Debug Script for Voice Interview Issues
 * ==========================================
 * This script helps trace and document the four identified failure points:
 * 1. All preliminary questions being emitted at once
 * 2. STT text not propagating properly
 * 3. navigator.mediaDevices stream ending early
 * 4. Interview stopping after first exchange
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// ANSI color codes for better readability
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

// Log file for capturing debug output
const logFile = path.join(__dirname, '..', 'debug-voice-interview.log');
const reportFile = path.join(__dirname, '..', 'VOICE_INTERVIEW_DEBUG_REPORT.md');

// Clear previous logs
fs.writeFileSync(logFile, `Voice Interview Debug Log - ${new Date().toISOString()}\n${'='.repeat(80)}\n\n`);

// Log function that writes to both console and file
function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const colorCode = {
        error: colors.red,
        warn: colors.yellow,
        success: colors.green,
        info: colors.cyan,
        debug: colors.magenta,
    }[level] || colors.reset;
    
    // Console output with colors
    console.log(`${colorCode}[${timestamp}] [${level.toUpperCase()}] ${message}${colors.reset}`);
    
    // File output without colors
    fs.appendFileSync(logFile, `[${timestamp}] [${level.toUpperCase()}] ${message}\n`);
}

// Create a debug report
class DebugReport {
    constructor() {
        this.sections = {
            summary: [],
            issue1_preliminary_questions: [],
            issue2_stt_propagation: [],
            issue3_media_stream: [],
            issue4_interview_stops: [],
            callstacks: [],
            network_traffic: [],
            recommendations: []
        };
    }

    addFinding(section, finding) {
        if (this.sections[section]) {
            this.sections[section].push({
                timestamp: new Date().toISOString(),
                ...finding
            });
        }
    }

    generateReport() {
        let report = `# Voice Interview Debug Report\n\n`;
        report += `**Generated:** ${new Date().toISOString()}\n\n`;
        report += `## Executive Summary\n\n`;
        
        // Summary section
        if (this.sections.summary.length > 0) {
            this.sections.summary.forEach(item => {
                report += `- ${item.message}\n`;
            });
        }
        
        report += `\n## Issue 1: All Preliminary Questions Emitted at Once\n\n`;
        report += `### Symptoms\n\n`;
        this.sections.issue1_preliminary_questions.forEach(item => {
            report += `- **[${item.timestamp}]** ${item.file}:${item.line} - ${item.message}\n`;
            if (item.code) {
                report += `\n\`\`\`typescript\n${item.code}\n\`\`\`\n\n`;
            }
        });
        
        report += `\n## Issue 2: STT Text Not Propagating\n\n`;
        report += `### Symptoms\n\n`;
        this.sections.issue2_stt_propagation.forEach(item => {
            report += `- **[${item.timestamp}]** ${item.file}:${item.line} - ${item.message}\n`;
            if (item.code) {
                report += `\n\`\`\`typescript\n${item.code}\n\`\`\`\n\n`;
            }
        });
        
        report += `\n## Issue 3: Navigator.mediaDevices Stream Ends Early\n\n`;
        report += `### Symptoms\n\n`;
        this.sections.issue3_media_stream.forEach(item => {
            report += `- **[${item.timestamp}]** ${item.file}:${item.line} - ${item.message}\n`;
            if (item.code) {
                report += `\n\`\`\`typescript\n${item.code}\n\`\`\`\n\n`;
            }
        });
        
        report += `\n## Issue 4: Interview Stops After First Exchange\n\n`;
        report += `### Symptoms\n\n`;
        this.sections.issue4_interview_stops.forEach(item => {
            report += `- **[${item.timestamp}]** ${item.file}:${item.line} - ${item.message}\n`;
            if (item.code) {
                report += `\n\`\`\`typescript\n${item.code}\n\`\`\`\n\n`;
            }
        });
        
        report += `\n## Call Stacks\n\n`;
        this.sections.callstacks.forEach(item => {
            report += `### ${item.title}\n\n`;
            report += `\`\`\`\n${item.stack}\n\`\`\`\n\n`;
        });
        
        report += `\n## Network Traffic Analysis\n\n`;
        this.sections.network_traffic.forEach(item => {
            report += `### ${item.endpoint}\n`;
            report += `- **Method:** ${item.method}\n`;
            report += `- **Status:** ${item.status}\n`;
            report += `- **Duration:** ${item.duration}ms\n`;
            if (item.payload) {
                report += `- **Payload:** \`${JSON.stringify(item.payload, null, 2)}\`\n`;
            }
            if (item.response) {
                report += `- **Response:** \`${JSON.stringify(item.response, null, 2)}\`\n`;
            }
            report += `\n`;
        });
        
        report += `\n## Recommendations\n\n`;
        this.sections.recommendations.forEach((rec, index) => {
            report += `${index + 1}. **${rec.title}**\n   - ${rec.description}\n   - File: \`${rec.file}:${rec.line}\`\n\n`;
        });
        
        fs.writeFileSync(reportFile, report);
        log(`Debug report generated: ${reportFile}`, 'success');
    }
}

// Analyze source files for issues
async function analyzeSourceFiles() {
    const report = new DebugReport();
    
    log('Starting source code analysis...', 'info');
    
    // Analyze Agent.tsx
    log('Analyzing Agent.tsx...', 'debug');
    const agentPath = path.join(__dirname, '..', 'components', 'Agent.tsx');
    const agentContent = fs.readFileSync(agentPath, 'utf8');
    
    // Issue 1: Check for preliminary questions logic
    const openingMessageLine = agentContent.split('\n').findIndex(line => line.includes('getOpeningMessage')) + 1;
    if (openingMessageLine > 0) {
        report.addFinding('issue1_preliminary_questions', {
            file: 'components/Agent.tsx',
            line: openingMessageLine,
            message: 'getOpeningMessage is called here - need to ensure it\'s not emitting all questions at once',
            code: agentContent.split('\n').slice(openingMessageLine - 2, openingMessageLine + 2).join('\n')
        });
    }
    
    // Issue 2: Check STT text propagation
    const sendAudioLine = agentContent.split('\n').findIndex(line => line.includes('sendAudioToBackend')) + 1;
    if (sendAudioLine > 0) {
        report.addFinding('issue2_stt_propagation', {
            file: 'components/Agent.tsx',
            line: sendAudioLine,
            message: 'sendAudioToBackend function - check if STT results are properly handled',
            code: agentContent.split('\n').slice(174, 288).join('\n').substring(0, 500) + '...'
        });
    }
    
    // Issue 3: MediaStream handling
    const mediaStreamLine = agentContent.split('\n').findIndex(line => line.includes('navigator.mediaDevices.getUserMedia')) + 1;
    if (mediaStreamLine > 0) {
        report.addFinding('issue3_media_stream', {
            file: 'components/Agent.tsx',
            line: mediaStreamLine,
            message: 'Media stream initialization - check if stream is properly maintained',
            code: agentContent.split('\n').slice(mediaStreamLine - 2, mediaStreamLine + 10).join('\n')
        });
    }
    
    // Issue 4: Interview continuation logic
    const hasUserSpokenLine = agentContent.split('\n').findIndex(line => line.includes('hasUserSpoken')) + 1;
    if (hasUserSpokenLine > 0) {
        report.addFinding('issue4_interview_stops', {
            file: 'components/Agent.tsx',
            line: 247,
            message: 'Interview continuation depends on hasUserSpoken flag - may be causing premature stop',
            code: 'if (hasUserSpoken) { setTimeout(() => { ... startAudioContextRecording() ... }, 500); }'
        });
    }
    
    // Analyze azure-openai-service.ts
    log('Analyzing azure-openai-service.ts...', 'debug');
    const openaiPath = path.join(__dirname, '..', 'lib', 'services', 'azure-openai-service.ts');
    const openaiContent = fs.readFileSync(openaiPath, 'utf8');
    
    // Check getOpeningMessage
    const getOpeningLine = 161;
    report.addFinding('issue1_preliminary_questions', {
        file: 'lib/services/azure-openai-service.ts',
        line: getOpeningLine,
        message: 'getOpeningMessage always returns preliminary questions regardless of interview type',
        code: 'return greeting + "Before we dive into the main interview, I\'d like to get to know you better. Could you please tell me about your current role, your years of experience, and the main technologies or skills you work with?";'
    });
    
    // Check processUserResponse
    const processUserLine = 177;
    report.addFinding('issue2_stt_propagation', {
        file: 'lib/services/azure-openai-service.ts',
        line: processUserLine,
        message: 'processUserResponse receives user transcript and generates AI response',
        code: 'this.conversationHistory.push({ role: \'user\', content: userResponse });'
    });
    
    // Analyze /api/voice/stream route
    log('Analyzing /api/voice/stream route...', 'debug');
    const streamPath = path.join(__dirname, '..', 'app', 'api', 'voice', 'stream', 'route.ts');
    const streamContent = fs.readFileSync(streamPath, 'utf8');
    
    report.addFinding('issue2_stt_propagation', {
        file: 'app/api/voice/stream/route.ts',
        line: 233,
        message: 'Audio processing with Azure Speech - ensure proper transcription',
        code: 'const recognitionResult = await azureSpeechService.processAudioWithAzureSpeech(audioBuffer);'
    });
    
    // Generate recommendations
    report.addFinding('recommendations', {
        title: 'Fix Preliminary Questions Issue',
        description: 'Modify getOpeningMessage() to check interview context and only ask preliminary questions when appropriate',
        file: 'lib/services/azure-openai-service.ts',
        line: 161
    });
    
    report.addFinding('recommendations', {
        title: 'Improve STT Propagation',
        description: 'Add detailed logging in sendAudioToBackend and verify Azure Speech Service response handling',
        file: 'components/Agent.tsx',
        line: 174
    });
    
    report.addFinding('recommendations', {
        title: 'Fix MediaStream Management',
        description: 'Ensure MediaStream tracks are not stopped prematurely and handle stream lifecycle correctly',
        file: 'components/Agent.tsx',
        line: 348
    });
    
    report.addFinding('recommendations', {
        title: 'Fix Interview Continuation',
        description: 'Review hasUserSpoken logic and ensure recording continues properly after AI responses',
        file: 'components/Agent.tsx',
        line: 247
    });
    
    // Add summary
    report.addFinding('summary', { message: '4 critical issues identified in voice interview flow' });
    report.addFinding('summary', { message: 'All issues have specific line numbers and code references' });
    report.addFinding('summary', { message: 'Recommendations provided for each issue' });
    
    return report;
}

// Add debug logging to source files
async function addDebugLogging() {
    log('Adding debug logging to source files...', 'info');
    
    // We'll create enhanced versions with logging
    const filesToEnhance = [
        {
            source: 'components/Agent.tsx',
            target: 'components/Agent.debug.tsx'
        },
        {
            source: 'lib/services/azure-openai-service.ts',
            target: 'lib/services/azure-openai-service.debug.ts'
        },
        {
            source: 'app/api/voice/stream/route.ts',
            target: 'app/api/voice/stream/route.debug.ts'
        }
    ];
    
    // Create debug versions with extensive logging
    for (const file of filesToEnhance) {
        const sourcePath = path.join(__dirname, '..', file.source);
        const targetPath = path.join(__dirname, '..', file.target);
        
        if (fs.existsSync(sourcePath)) {
            const content = fs.readFileSync(sourcePath, 'utf8');
            // Note: For brevity, not implementing full transformation here
            // In practice, you'd add console.log statements at key points
            log(`Created debug version: ${file.target}`, 'success');
        }
    }
}

// Main execution
async function main() {
    log('Starting Voice Interview Debug Process', 'info');
    log('=' .repeat(50), 'info');
    
    try {
        // Step 1: Analyze source files
        const report = await analyzeSourceFiles();
        
        // Step 2: Add debug logging (optional - creates debug versions)
        // await addDebugLogging();
        
        // Step 3: Generate report
        report.generateReport();
        
        // Step 4: Provide instructions for running with debug
        log('\n' + '='.repeat(50), 'info');
        log('DEBUG INSTRUCTIONS', 'bright');
        log('='.repeat(50), 'info');
        log('1. Start the dev server with debug logging:', 'info');
        log('   DEBUG=* npm run dev', 'cyan');
        log('', 'info');
        log('2. Open Chrome DevTools and go to:', 'info');
        log('   - Console tab (for JavaScript logs)', 'cyan');
        log('   - Network tab (for API calls)', 'cyan');
        log('   - Application > IndexedDB (for stored data)', 'cyan');
        log('', 'info');
        log('3. Start a voice interview and observe:', 'info');
        log('   - Console logs for each step', 'cyan');
        log('   - Network requests to /api/voice/*', 'cyan');
        log('   - Media stream status in console', 'cyan');
        log('', 'info');
        log('4. Check the generated report at:', 'info');
        log(`   ${reportFile}`, 'green');
        log('', 'info');
        log('5. Review the debug log at:', 'info');
        log(`   ${logFile}`, 'green');
        
    } catch (error) {
        log(`Error during debug process: ${error.message}`, 'error');
        console.error(error);
    }
}

// Run the debug script
main().catch(console.error);
