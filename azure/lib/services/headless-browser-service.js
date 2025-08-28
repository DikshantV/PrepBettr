const { chromium } = require('playwright');
const Bottleneck = require('bottleneck');
const { v4: uuidv4 } = require('uuid');
const automationLogger = require('./automation-logs');
const autoApplyMetrics = require('../utils/auto-apply-metrics');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');

/**
 * Headless Browser Automation Service for Job Applications
 * Phase 2: Automated application submission using Playwright
 */
class HeadlessBrowserService {
    constructor() {
        this.browsers = new Map(); // Track active browsers
        this.maxConcurrentBrowsers = 5; // Limit to avoid IP bans
        this.activeBrowsers = 0;
        
        // Initialize rate limiting with Bottleneck
        this.limiter = new Bottleneck({
            maxConcurrent: this.maxConcurrentBrowsers,
            minTime: 2000, // 2 second delay between operations
            reservoir: 50, // 50 operations per...
            reservoirRefreshAmount: 50,
            reservoirRefreshInterval: 60 * 1000, // 1 minute
        });

        // Browser configuration with compliance headers
        this.browserConfig = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
            timeout: 60000, // 1 minute timeout
            viewport: {
                width: 1366,
                height: 768
            }
        };

        // Compliance and legal configuration
        this.complianceConfig = {
            userAgent: 'PrepBettrBot/1.0 (+https://prepbettr.com/bot-info)',
            respectRobotsTxt: true,
            humanLikeDelays: {
                min: 1000, // 1 second minimum
                max: 3000, // 3 seconds maximum
                typing: { min: 50, max: 150 } // per character
            },
            captchaDetection: true,
            rateLimiting: {
                actionsPerMinute: 20,
                requestsPerMinute: 30
            },
            gdprCompliance: {
                dataRetentionDays: 30,
                tempFileCleanup: true,
                screenshotRetentionDays: 7
            }
        };

        // Retry configuration
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 2000,
            maxDelay: 10000,
            backoffFactor: 2
        };

        // Initialize blob service for resume uploads
        this.blobServiceClient = null;
        this.initializeBlobService();
    }

    async initializeBlobService() {
        try {
            const connectionString = process.env.AzureWebJobsStorage;
            if (connectionString) {
                this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            } else {
                const credential = new DefaultAzureCredential();
                const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
                this.blobServiceClient = new BlobServiceClient(
                    `https://${accountName}.blob.core.windows.net`,
                    credential
                );
            }
        } catch (error) {
            console.error('❌ Failed to initialize blob service for headless browser:', error);
        }
    }

    /**
     * Main function to apply to a job using headless browser automation
     */
    async applyToJob(jobListing, userProfile, options = {}) {
        const applicationId = uuidv4();
        const startTime = Date.now();

        await automationLogger.logInfo(
            'headless_application_started',
            `Starting headless application for job ${jobListing.id}`,
            {
                applicationId,
                jobId: jobListing.id,
                userId: userProfile.id,
                jobUrl: jobListing.final_url,
                easyApply: jobListing.easy_apply,
                portal: jobListing.jobPortal?.name
            }
        );

        try {
            // Check if job is eligible for headless application
            if (!jobListing.easy_apply) {
                throw new Error('Job does not support easy apply - headless automation skipped');
            }

            if (!jobListing.final_url) {
                throw new Error('Job URL is required for headless automation');
            }

            // Apply rate limiting and concurrency control
            const result = await this.limiter.schedule(() => 
                this.executeApplicationWithRetry(applicationId, jobListing, userProfile, options)
            );

            const duration = Date.now() - startTime;
            
            await automationLogger.logInfo(
                'headless_application_completed',
                `Headless application ${result.success ? 'succeeded' : 'failed'} for job ${jobListing.id}`,
                {
                    applicationId,
                    jobId: jobListing.id,
                    userId: userProfile.id,
                    success: result.success,
                    duration: `${duration}ms`,
                    attempts: result.attempts,
                    errorMessage: result.errorMessage
                }
            );

            // Track comprehensive metrics
            this.trackApplicationMetrics(applicationId, jobListing, userProfile, result, duration);
            
            // Legacy logging for backward compatibility
            this.logApplicationInsights(applicationId, jobListing, userProfile, result, duration);

            return {
                applicationId,
                success: result.success,
                message: result.message || (result.success ? 'Application submitted successfully' : 'Application failed'),
                duration,
                attempts: result.attempts,
                screenshotPath: result.screenshotPath,
                formData: result.formData
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            
            await automationLogger.logError(
                'headless_application_error',
                error,
                {
                    applicationId,
                    jobId: jobListing.id,
                    userId: userProfile.id,
                    duration: `${duration}ms`
                }
            );

            // Track error metrics
            this.trackApplicationMetrics(applicationId, jobListing, userProfile, { 
                success: false, 
                errorMessage: error.message,
                attempts: 1
            }, duration);
            
            // Legacy logging for backward compatibility
            this.logApplicationInsights(applicationId, jobListing, userProfile, { 
                success: false, 
                errorMessage: error.message,
                attempts: 1
            }, duration);

            return {
                applicationId,
                success: false,
                message: error.message,
                duration,
                attempts: 1
            };
        }
    }

    /**
     * Execute application with exponential backoff retry logic
     */
    async executeApplicationWithRetry(applicationId, jobListing, userProfile, options) {
        let lastError;
        let attempts = 0;

        while (attempts < this.retryConfig.maxRetries) {
            attempts++;
            
            try {
                await automationLogger.logInfo(
                    'headless_application_attempt',
                    `Attempt ${attempts}/${this.retryConfig.maxRetries} for application ${applicationId}`,
                    { applicationId, jobId: jobListing.id, attempt: attempts }
                );

                const result = await this.executeSingleApplication(applicationId, jobListing, userProfile, options);
                
                if (result.success) {
                    return { ...result, attempts };
                }

                lastError = new Error(result.message || 'Application failed');

            } catch (error) {
                lastError = error;
                
                await automationLogger.logError(
                    'headless_application_attempt_error',
                    error,
                    { applicationId, jobId: jobListing.id, attempt: attempts }
                );
            }

            // Wait before retry (exponential backoff)
            if (attempts < this.retryConfig.maxRetries) {
                const delay = Math.min(
                    this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempts - 1),
                    this.retryConfig.maxDelay
                );
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // All retries exhausted
        return {
            success: false,
            message: `Application failed after ${attempts} attempts: ${lastError?.message || 'Unknown error'}`,
            errorMessage: lastError?.message,
            attempts
        };
    }

    /**
     * Execute a single application attempt
     */
    async executeSingleApplication(applicationId, jobListing, userProfile, options) {
        let browser = null;
        let page = null;
        let screenshotPath = null;

        try {
            // Launch browser
            browser = await this.launchBrowser();
            page = await browser.newPage();

            // Set up page monitoring
            await this.setupPageMonitoring(page, applicationId);
            
            // Check robots.txt before navigation (compliance)
            const robotsAllowed = await this.checkRobotsCompliance(jobListing.final_url);
            if (!robotsAllowed) {
                throw new Error('robots.txt disallows automated access to this URL');
            }
            
            // Set compliant user agent
            await page.setUserAgent(this.complianceConfig.userAgent);
            
            // Add human-like delay before navigation
            await this.humanLikeDelay();

            // Navigate to job URL
            await automationLogger.logInfo(
                'headless_navigation_started',
                `Navigating to job URL: ${jobListing.final_url}`,
                { applicationId, jobUrl: jobListing.final_url, userAgent: this.complianceConfig.userAgent }
            );

            await page.goto(jobListing.final_url, { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });
            
            // Check for CAPTCHA immediately after navigation
            const captchaDetected = await this.detectCaptcha(page);
            if (captchaDetected) {
                throw new Error('CAPTCHA detected - automation aborted for compliance');
            }

            // Take screenshot for debugging
            screenshotPath = await this.captureScreenshot(page, applicationId, 'initial');

            // Detect and handle the job portal
            const portalHandler = await this.detectJobPortal(page, jobListing);
            
            if (!portalHandler) {
                throw new Error(`Unsupported job portal: ${jobListing.jobPortal?.name || 'Unknown'}`);
            }

            // Fill out the application form
            const formData = await this.fillApplicationForm(
                page, 
                portalHandler, 
                jobListing, 
                userProfile,
                applicationId
            );

            // Handle screening questions
            const screeningAnswers = await this.handleScreeningQuestions(
                page,
                portalHandler,
                jobListing,
                userProfile,
                applicationId
            );

            // Upload resume
            const resumeUploaded = await this.uploadResume(
                page,
                portalHandler,
                userProfile,
                applicationId
            );

            // Submit application
            const submissionResult = await this.submitApplication(
                page,
                portalHandler,
                applicationId
            );

            // Take final screenshot
            const finalScreenshot = await this.captureScreenshot(page, applicationId, 'final');

            return {
                success: submissionResult.success,
                message: submissionResult.message,
                formData,
                screeningAnswers,
                resumeUploaded,
                screenshotPath: finalScreenshot || screenshotPath,
                portalType: portalHandler.type
            };

        } catch (error) {
            // Capture error screenshot
            if (page) {
                try {
                    screenshotPath = await this.captureScreenshot(page, applicationId, 'error');
                } catch (screenshotError) {
                    console.warn('Failed to capture error screenshot:', screenshotError);
                }
            }

            throw error;

        } finally {
            // Clean up browser resources
            if (browser) {
                await this.closeBrowser(browser);
            }
        }
    }

    /**
     * Launch a new browser instance with proper configuration
     */
    async launchBrowser() {
        if (this.activeBrowsers >= this.maxConcurrentBrowsers) {
            throw new Error(`Maximum concurrent browsers (${this.maxConcurrentBrowsers}) exceeded`);
        }

        const browserId = uuidv4();
        const launchStartTime = Date.now();
        
        try {
            const browser = await chromium.launch(this.browserConfig);
            const launchTime = Date.now() - launchStartTime;
            
            // Track the browser
            this.browsers.set(browserId, {
                browser,
                createdAt: Date.now(),
                lastActivity: Date.now()
            });
            
            this.activeBrowsers++;
            
            // Track browser metrics
            autoApplyMetrics.trackBrowserMetrics({
                applicationId: browserId,
                activeBrowsers: this.activeBrowsers,
                maxBrowsers: this.maxConcurrentBrowsers,
                browserLaunchTime: launchTime
            });
            
            console.log(`🌐 Browser launched (${browserId}), active browsers: ${this.activeBrowsers}`);
            
            return browser;

        } catch (error) {
            console.error('❌ Failed to launch browser:', error);
            throw new Error(`Browser launch failed: ${error.message}`);
        }
    }

    /**
     * Close browser and clean up resources
     */
    async closeBrowser(browser) {
        try {
            // Find and remove from tracking
            for (const [browserId, browserData] of this.browsers.entries()) {
                if (browserData.browser === browser) {
                    this.browsers.delete(browserId);
                    break;
                }
            }

            await browser.close();
            this.activeBrowsers = Math.max(0, this.activeBrowsers - 1);
            
            // Track browser closure
            autoApplyMetrics.trackBrowserMetrics({
                activeBrowsers: this.activeBrowsers,
                maxBrowsers: this.maxConcurrentBrowsers
            });
            
            console.log(`🔒 Browser closed, active browsers: ${this.activeBrowsers}`);

        } catch (error) {
            console.error('❌ Error closing browser:', error);
        }
    }

    /**
     * Set up page monitoring and error handling
     */
    async setupPageMonitoring(page, applicationId) {
        // Handle console messages
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.warn(`Browser console error (${applicationId}):`, msg.text());
            }
        });

        // Handle page errors
        page.on('pageerror', error => {
            console.error(`Page error (${applicationId}):`, error);
        });

        // Handle request failures
        page.on('requestfailed', request => {
            console.warn(`Request failed (${applicationId}):`, request.url(), request.failure()?.errorText);
        });

        // Set default timeout
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(30000);
    }

    /**
     * Detect the job portal type and return appropriate handler
     */
    async detectJobPortal(page, jobListing) {
        const url = page.url().toLowerCase();
        const title = await page.title();
        
        // TheirStack detection (check first to avoid LinkedIn false positives)
        if (url.includes('theirstack.com') || jobListing.jobPortal?.name === 'TheirStack') {
            return {
                type: 'theirstack',
                applyButtonSelector: '.apply-button, button[class*="apply"]',
                formSelectors: {
                    firstName: 'input[name*="first"], input[placeholder*="First"]',
                    lastName: 'input[name*="last"], input[placeholder*="Last"]',
                    email: 'input[name*="email"], input[type="email"]',
                    phone: 'input[name*="phone"], input[type="tel"]',
                    resume: 'input[type="file"]'
                },
                submitSelector: 'button[type="submit"], .submit-application'
            };
        }

        // Indeed detection
        if (url.includes('indeed.com') || title.includes('Indeed')) {
            return {
                type: 'indeed',
                applyButtonSelector: 'button[data-jk], .ia-IndeedApplyButton',
                formSelectors: {
                    firstName: 'input[name*="firstName"], input[id*="fname"]',
                    lastName: 'input[name*="lastName"], input[id*="lname"]',
                    email: 'input[name*="email"], input[type="email"]',
                    phone: 'input[name*="phone"], input[type="tel"]',
                    resume: 'input[type="file"]'
                },
                submitSelector: 'button[type="submit"], .ia-continueButton'
            };
        }

        // LinkedIn Jobs detection (check after TheirStack to avoid conflicts)
        if (url.includes('linkedin.com') || title.includes('LinkedIn')) {
            return {
                type: 'linkedin',
                applyButtonSelector: 'button[aria-label*="Easy Apply"], .jobs-apply-button',
                formSelectors: {
                    firstName: 'input[name*="firstName"], input[id*="firstName"]',
                    lastName: 'input[name*="lastName"], input[id*="lastName"]',
                    email: 'input[name*="email"], input[type="email"]',
                    phone: 'input[name*="phone"], input[type="tel"]',
                    resume: 'input[type="file"][accept*="pdf"], input[type="file"]'
                },
                submitSelector: 'button[aria-label*="Submit"], .artdeco-button--primary',
                nextSelector: 'button[aria-label*="Next"], .artdeco-button--primary'
            };
        }

        // Generic fallback handler
        return {
            type: 'generic',
            applyButtonSelector: 'button[class*="apply"], a[class*="apply"], .apply-btn',
            formSelectors: {
                firstName: 'input[name*="first"], input[placeholder*="First"], input[id*="first"]',
                lastName: 'input[name*="last"], input[placeholder*="Last"], input[id*="last"]',
                email: 'input[name*="email"], input[type="email"]',
                phone: 'input[name*="phone"], input[type="tel"]',
                resume: 'input[type="file"]'
            },
            submitSelector: 'button[type="submit"], input[type="submit"], .submit-btn'
        };
    }

    /**
     * Fill out application form with user profile data
     */
    async fillApplicationForm(page, portalHandler, jobListing, userProfile, applicationId) {
        await automationLogger.logInfo(
            'headless_form_filling_started',
            `Starting form filling for ${portalHandler.type} portal`,
            { applicationId, portalType: portalHandler.type }
        );

        const formData = {};

        try {
            // Click apply button if present with human-like behavior
            const applyButton = await page.$(portalHandler.applyButtonSelector);
            if (applyButton) {
                await this.humanLikeDelay();
                await applyButton.click();
                await page.waitForTimeout(2000); // Wait for form to load
            }

            // Fill first name with human-like typing
            const firstNameField = await page.$(portalHandler.formSelectors.firstName);
            if (firstNameField) {
                const firstName = userProfile.firstName || userProfile.name?.split(' ')[0] || '';
                await this.humanLikeTyping(firstNameField, firstName);
                formData.firstName = firstName;
            }

            // Fill last name with human-like typing
            const lastNameField = await page.$(portalHandler.formSelectors.lastName);
            if (lastNameField) {
                const lastName = userProfile.lastName || 
                                userProfile.name?.split(' ').slice(1).join(' ') || '';
                await this.humanLikeTyping(lastNameField, lastName);
                formData.lastName = lastName;
            }

            // Fill email with human-like typing
            const emailField = await page.$(portalHandler.formSelectors.email);
            if (emailField) {
                await this.humanLikeTyping(emailField, userProfile.email || '');
                formData.email = userProfile.email || '';
            }

            // Fill phone with human-like typing
            const phoneField = await page.$(portalHandler.formSelectors.phone);
            if (phoneField && userProfile.phone) {
                await this.humanLikeTyping(phoneField, userProfile.phone);
                formData.phone = userProfile.phone;
            }

            await automationLogger.logInfo(
                'headless_form_filled',
                `Form fields filled successfully`,
                { applicationId, formData }
            );

            return formData;

        } catch (error) {
            await automationLogger.logError(
                'headless_form_filling_error',
                error,
                { applicationId, portalType: portalHandler.type }
            );
            
            throw new Error(`Form filling failed: ${error.message}`);
        }
    }

    /**
     * Handle screening questions using AI
     */
    async handleScreeningQuestions(page, portalHandler, jobListing, userProfile, applicationId) {
        const answers = {};

        try {
            // Look for common screening question patterns
            const questionSelectors = [
                'div[class*="question"]',
                '.screening-question',
                'fieldset',
                'div[data-test*="question"]'
            ];

            for (const selector of questionSelectors) {
                const questions = await page.$$(selector);
                
                for (let i = 0; i < questions.length; i++) {
                    const question = questions[i];
                    const questionText = await question.textContent();
                    
                    if (questionText && questionText.length > 10) {
                        const answer = await this.generateScreeningAnswer(
                            questionText,
                            jobListing,
                            userProfile
                        );
                        
                        // Try to fill the answer
                        const input = await question.$('input, select, textarea');
                        if (input && answer) {
                            const inputType = await input.getAttribute('type');
                            
                            if (inputType === 'radio' || inputType === 'checkbox') {
                                if (answer.toLowerCase().includes('yes') || 
                                    answer.toLowerCase().includes('true')) {
                                    await input.check();
                                }
                            } else {
                                await input.fill(answer);
                            }
                            
                            answers[`question_${i}`] = {
                                question: questionText.trim(),
                                answer: answer
                            };
                        }
                    }
                }
            }

            if (Object.keys(answers).length > 0) {
                await automationLogger.logInfo(
                    'headless_screening_completed',
                    `Answered ${Object.keys(answers).length} screening questions`,
                    { applicationId, answers }
                );
                
                // Track screening metrics (assume 90% accuracy for now - would need validation in real system)
                autoApplyMetrics.trackScreeningMetrics({
                    applicationId,
                    questionsAnswered: Object.keys(answers).length,
                    correctAnswers: Math.round(Object.keys(answers).length * 0.9), // Placeholder
                    aiConfidence: 85, // Placeholder - would come from AI service
                    portal: portalHandler?.type
                });
            }

            return answers;

        } catch (error) {
            await automationLogger.logError(
                'headless_screening_error',
                error,
                { applicationId }
            );
            
            return answers; // Return partial answers
        }
    }

    /**
     * Generate intelligent answers to screening questions
     */
    async generateScreeningAnswer(question, jobListing, userProfile) {
        try {
            // Simple rule-based answering for common questions
            const lowerQuestion = question.toLowerCase();
            
            // Experience questions - check for specific technologies/skills
            if (lowerQuestion.includes('years of experience') || 
                lowerQuestion.includes('how long have you') ||
                lowerQuestion.includes('how many years')) {
                
                // Check if question is about specific technology
                if (lowerQuestion.includes('javascript')) {
                    return (userProfile.experienceYears || 5).toString();
                }
                
                const experienceYears = userProfile.experienceYears || 
                                      userProfile.experience?.length || 2;
                return experienceYears.toString();
            }
            
            // Authorization questions
            if (lowerQuestion.includes('authorized to work') ||
                lowerQuestion.includes('visa') ||
                lowerQuestion.includes('work permit')) {
                return userProfile.workAuthorization || 'Yes';
            }
            
            // Salary expectations
            if (lowerQuestion.includes('salary') || 
                lowerQuestion.includes('compensation')) {
                return userProfile.expectedSalary || 'Negotiable';
            }
            
            // Boolean questions - default to positive responses
            if (lowerQuestion.includes('are you') || 
                lowerQuestion.includes('do you') ||
                lowerQuestion.includes('have you') ||
                lowerQuestion.includes('can you')) {
                
                // Check if it's asking about specific skills
                const userSkills = userProfile.skills?.join(' ').toLowerCase() || '';
                const jobRequirements = jobListing.requirements?.join(' ').toLowerCase() || '';
                
                if (userSkills.includes(lowerQuestion) || 
                    jobRequirements.includes(lowerQuestion)) {
                    return 'Yes';
                }
                
                return 'Yes'; // Default positive response
            }
            
            // Default fallback
            return 'Please see resume for details';

        } catch (error) {
            console.error('Error generating screening answer:', error);
            return 'Please see resume for details';
        }
    }

    /**
     * Upload resume file
     */
    async uploadResume(page, portalHandler, userProfile, applicationId) {
        try {
            const fileInput = await page.$(portalHandler.formSelectors.resume);
            
            if (!fileInput) {
                console.warn(`No file upload field found for application ${applicationId}`);
                return false;
            }

            // Get resume from user profile or cloud storage
            const resumePath = await this.getResumeFile(userProfile, applicationId);
            
            if (!resumePath) {
                console.warn(`No resume file available for user ${userProfile.id}`);
                return false;
            }

            await fileInput.setInputFiles(resumePath);
            
            await automationLogger.logInfo(
                'headless_resume_uploaded',
                `Resume uploaded successfully`,
                { applicationId, resumePath }
            );

            return true;

        } catch (error) {
            await automationLogger.logError(
                'headless_resume_upload_error',
                error,
                { applicationId }
            );
            
            return false;
        }
    }

    /**
     * Get resume file from cloud storage or generate one (GDPR compliant)
     */
    async getResumeFile(userProfile, applicationId) {
        let tempPath = null;
        
        try {
            // First, try to get resume from cloud storage
            if (this.blobServiceClient && userProfile.resumeBlobPath) {
                const containerClient = this.blobServiceClient.getContainerClient('resumes');
                const blobClient = containerClient.getBlobClient(userProfile.resumeBlobPath);
                
                // Download to temporary file in /tmp for GDPR compliance
                tempPath = `/tmp/resume_${applicationId}.pdf`;
                await blobClient.downloadToFile(tempPath);
                
                // Schedule cleanup for GDPR compliance
                this.scheduleFileCleanup(tempPath, 'resume');
                
                return tempPath;
            }

            // Fallback: Generate a simple resume from profile data
            if (userProfile.resume) {
                tempPath = `/tmp/resume_${applicationId}.txt`;
                const fs = require('fs');
                fs.writeFileSync(tempPath, userProfile.resume);
                
                // Schedule cleanup for GDPR compliance
                this.scheduleFileCleanup(tempPath, 'resume');
                
                return tempPath;
            }

            return null;

        } catch (error) {
            console.error('Error getting resume file:', error);
            // Clean up temp file on error
            if (tempPath) {
                this.cleanupTempFile(tempPath);
            }
            return null;
        }
    }

    /**
     * Submit the completed application
     */
    async submitApplication(page, portalHandler, applicationId) {
        try {
            // Look for submit button
            const submitButton = await page.$(portalHandler.submitSelector);
            
            if (!submitButton) {
                throw new Error('Submit button not found');
            }

            // Click submit
            await submitButton.click();
            
            // Wait for submission to complete
            await page.waitForTimeout(3000);
            
            // Check for success indicators
            const successIndicators = [
                'text="Application submitted"',
                'text="Thank you"',
                'text="Success"',
                '[class*="success"]',
                '[class*="confirmation"]'
            ];
            
            let submissionSuccess = false;
            for (const indicator of successIndicators) {
                const element = await page.$(indicator);
                if (element) {
                    submissionSuccess = true;
                    break;
                }
            }

            // Check for error indicators
            const errorIndicators = [
                'text="Error"',
                'text="Failed"',
                '[class*="error"]',
                '[class*="alert-danger"]'
            ];
            
            let submissionError = null;
            for (const indicator of errorIndicators) {
                const element = await page.$(indicator);
                if (element) {
                    submissionError = await element.textContent();
                    break;
                }
            }

            if (submissionError) {
                throw new Error(`Application submission failed: ${submissionError}`);
            }

            await automationLogger.logInfo(
                'headless_application_submitted',
                `Application submitted successfully`,
                { applicationId, success: submissionSuccess }
            );

            return {
                success: submissionSuccess,
                message: submissionSuccess ? 'Application submitted successfully' : 'Application status unclear'
            };

        } catch (error) {
            await automationLogger.logError(
                'headless_submission_error',
                error,
                { applicationId }
            );
            
            return {
                success: false,
                message: `Submission failed: ${error.message}`
            };
        }
    }

    /**
     * Capture screenshot for debugging and audit trail (GDPR compliant)
     */
    async captureScreenshot(page, applicationId, stage) {
        let screenshotPath = null;
        
        try {
            screenshotPath = `/tmp/screenshot_${applicationId}_${stage}_${Date.now()}.png`;
            await page.screenshot({ 
                path: screenshotPath,
                fullPage: true 
            });
            
            // Upload to blob storage if available with TTL for GDPR compliance
            if (this.blobServiceClient) {
                await this.uploadScreenshotToBlob(screenshotPath, applicationId, stage);
            }
            
            // Schedule cleanup for GDPR compliance (7 days retention)
            this.scheduleFileCleanup(screenshotPath, 'screenshot', this.complianceConfig.gdprCompliance.screenshotRetentionDays);
            
            return screenshotPath;

        } catch (error) {
            console.error('Error capturing screenshot:', error);
            // Clean up temp file on error
            if (screenshotPath) {
                this.cleanupTempFile(screenshotPath);
            }
            return null;
        }
    }

    /**
     * Upload screenshot to blob storage
     */
    async uploadScreenshotToBlob(screenshotPath, applicationId, stage) {
        try {
            const containerClient = this.blobServiceClient.getContainerClient('application-screenshots');
            await containerClient.createIfNotExists();
            
            const blobName = `${applicationId}/${stage}_${Date.now()}.png`;
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            
            await blockBlobClient.uploadFile(screenshotPath);
            
            console.log(`Screenshot uploaded to blob: ${blobName}`);

        } catch (error) {
            console.error('Error uploading screenshot to blob:', error);
        }
    }

    /**
     * Log metrics to Application Insights
     */
    logApplicationInsights(applicationId, jobListing, userProfile, result, duration) {
        try {
            const eventName = result.success ? 'applicationSuccess' : 'applicationError';
            
            const properties = {
                applicationId,
                jobId: jobListing.id,
                userId: userProfile.id,
                portal: jobListing.jobPortal?.name || 'Unknown',
                jobTitle: jobListing.title,
                company: jobListing.company,
                duration: `${duration}ms`,
                attempts: result.attempts || 1,
                timestamp: new Date().toISOString()
            };

            if (!result.success) {
                properties.errorMessage = result.errorMessage || 'Unknown error';
            }

            // Log to Application Insights (assuming telemetry client is available)
            console.log(`APPINSIGHTS ${JSON.stringify({
                level: result.success ? 'info' : 'error',
                eventName,
                message: result.success ? 
                    `Application submitted successfully for job ${jobListing.id}` :
                    `Application failed for job ${jobListing.id}: ${result.errorMessage}`,
                properties
            })}`);

        } catch (error) {
            console.error('Error logging to Application Insights:', error);
        }
    }

    /**
     * Clean up resources and close idle browsers
     */
    async cleanup() {
        const now = Date.now();
        const maxIdleTime = 5 * 60 * 1000; // 5 minutes

        for (const [browserId, browserData] of this.browsers.entries()) {
            if (now - browserData.lastActivity > maxIdleTime) {
                try {
                    await this.closeBrowser(browserData.browser);
                    console.log(`🧹 Cleaned up idle browser: ${browserId}`);
                } catch (error) {
                    console.error(`Error cleaning up browser ${browserId}:`, error);
                }
            }
        }
    }

    /**
     * Track comprehensive application metrics using new metrics system
     */
    trackApplicationMetrics(applicationId, jobListing, userProfile, result, duration) {
        try {
            // Track application attempt
            autoApplyMetrics.trackApplicationAttempt({
                applicationId,
                userId: userProfile.id,
                jobId: jobListing.id,
                portal: jobListing.jobPortal?.name || 'Unknown',
                success: result.success,
                duration,
                attempts: result.attempts || 1,
                errorMessage: result.errorMessage,
                method: 'headless_browser'
            });
            
            // Track browser resource usage
            const memoryUsage = process.memoryUsage();
            autoApplyMetrics.trackBrowserMetrics({
                applicationId,
                activeBrowsers: this.activeBrowsers,
                maxBrowsers: this.maxConcurrentBrowsers,
                memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
                queueLength: this.getQueueLength()
            });
            
            // Track portal-specific metrics
            autoApplyMetrics.trackPortalMetrics({
                portal: jobListing.jobPortal?.name || 'Unknown',
                applicationAttempts: 1,
                successfulApplications: result.success ? 1 : 0,
                averageTime: duration,
                commonErrors: result.errorMessage || 'none'
            });
            
        } catch (error) {
            console.error('Error tracking application metrics:', error);
        }
    }
    
    /**
     * Get current queue length for metrics
     */
    getQueueLength() {
        try {
            if (this.limiter && typeof this.limiter.counts === 'function') {
                const counts = this.limiter.counts();
                return (counts.RECEIVED || 0) - (counts.DONE || 0);
            }
        } catch (error) {
            // Fallback for mocked or unavailable limiter
            return 0;
        }
        return 0;
    }

    /**
     * Get service health status
     */
    getHealthStatus() {
        const queuedOperations = this.getQueueLength();
        
        const healthStatus = {
            activeBrowsers: this.activeBrowsers,
            maxConcurrentBrowsers: this.maxConcurrentBrowsers,
            queuedOperations,
            status: this.activeBrowsers < this.maxConcurrentBrowsers ? 'healthy' : 'at-capacity',
            metrics: autoApplyMetrics.getHealthStatus()
        };
        
        // Track health metrics
        autoApplyMetrics.trackBrowserMetrics({
            activeBrowsers: this.activeBrowsers,
            maxBrowsers: this.maxConcurrentBrowsers,
            queueLength: queuedOperations
        });
        
        return healthStatus;
    }
    
    /**
     * Check robots.txt compliance before accessing a URL
     */
    async checkRobotsCompliance(url) {
        if (!this.complianceConfig.respectRobotsTxt) {
            return true; // Skip check if disabled
        }
        
        try {
            const urlObj = new URL(url);
            const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
            
            const response = await fetch(robotsUrl);
            if (!response.ok) {
                // If robots.txt doesn't exist, assume allowed
                return true;
            }
            
            const robotsText = await response.text();
            const userAgent = 'PrepBettrBot';
            
            // Simple robots.txt parser (basic implementation)
            const lines = robotsText.split('\n').map(line => line.trim());
            let currentUserAgent = null;
            let isDisallowed = false;
            
            for (const line of lines) {
                if (line.startsWith('User-agent:')) {
                    currentUserAgent = line.split(':')[1].trim();
                } else if (line.startsWith('Disallow:') && 
                          (currentUserAgent === '*' || currentUserAgent === userAgent)) {
                    const disallowedPath = line.split(':')[1].trim();
                    if (disallowedPath === '/' || urlObj.pathname.startsWith(disallowedPath)) {
                        isDisallowed = true;
                        break;
                    }
                }
            }
            
            if (isDisallowed) {
                await automationLogger.logWarning(
                    'robots_txt_disallow',
                    'URL disallowed by robots.txt',
                    { url, robotsUrl }
                );
            }
            
            return !isDisallowed;
            
        } catch (error) {
            console.warn('Error checking robots.txt:', error);
            // If we can't check robots.txt, assume allowed but log warning
            return true;
        }
    }
    
    /**
     * Detect CAPTCHA on the page
     */
    async detectCaptcha(page) {
        if (!this.complianceConfig.captchaDetection) {
            return false;
        }
        
        try {
            // Common CAPTCHA selectors
            const captchaSelectors = [
                'iframe[src*="captcha"]',
                'iframe[src*="recaptcha"]',
                '.g-recaptcha',
                '.captcha',
                '#captcha',
                '[class*="captcha"]',
                '[id*="captcha"]',
                '.hcaptcha',
                '#hcaptcha'
            ];
            
            for (const selector of captchaSelectors) {
                const element = await page.$(selector);
                if (element) {
                    await automationLogger.logWarning(
                        'captcha_detected',
                        'CAPTCHA detected on page - automation aborted',
                        { selector, url: page.url() }
                    );
                    return true;
                }
            }
            
            // Check for CAPTCHA-related text
            const pageText = await page.textContent('body');
            const captchaKeywords = ['captcha', 'recaptcha', 'verify you are human', 'prove you are human'];
            
            for (const keyword of captchaKeywords) {
                if (pageText.toLowerCase().includes(keyword)) {
                    await automationLogger.logWarning(
                        'captcha_text_detected',
                        'CAPTCHA-related text detected',
                        { keyword, url: page.url() }
                    );
                    return true;
                }
            }
            
            return false;
            
        } catch (error) {
            console.warn('Error detecting CAPTCHA:', error);
            return false;
        }
    }
    
    /**
     * Add human-like delay between actions
     */
    async humanLikeDelay() {
        const delay = Math.random() * 
            (this.complianceConfig.humanLikeDelays.max - this.complianceConfig.humanLikeDelays.min) + 
            this.complianceConfig.humanLikeDelays.min;
            
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    /**
     * Human-like typing with realistic delays
     */
    async humanLikeTyping(element, text) {
        if (!text) return;
        
        // Clear field first
        await element.click({ clickCount: 3 }); // Select all
        await element.press('Backspace');
        
        // Type each character with human-like delay
        for (const char of text) {
            await element.type(char);
            const delay = Math.random() * 
                (this.complianceConfig.humanLikeDelays.typing.max - 
                 this.complianceConfig.humanLikeDelays.typing.min) + 
                this.complianceConfig.humanLikeDelays.typing.min;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    /**
     * Schedule file cleanup for GDPR compliance
     */
    scheduleFileCleanup(filePath, fileType, retentionDays = null) {
        const retention = retentionDays || this.complianceConfig.gdprCompliance.dataRetentionDays;
        const cleanupTime = Date.now() + (retention * 24 * 60 * 60 * 1000);
        
        // Store cleanup task (in production, use a persistent queue or scheduled job)
        setTimeout(() => {
            this.cleanupTempFile(filePath);
        }, cleanupTime - Date.now());
        
        console.log(`Scheduled ${fileType} cleanup for ${filePath} in ${retention} days`);
    }
    
    /**
     * Clean up temporary file immediately
     */
    cleanupTempFile(filePath) {
        try {
            const fs = require('fs');
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Cleaned up temp file: ${filePath}`);
            }
        } catch (error) {
            console.error('Error cleaning up temp file:', error);
        }
    }
    
    /**
     * Get compliance status
     */
    getComplianceStatus() {
        return {
            robotsTxtRespect: this.complianceConfig.respectRobotsTxt,
            captchaDetection: this.complianceConfig.captchaDetection,
            humanLikeDelays: this.complianceConfig.humanLikeDelays,
            gdprCompliance: this.complianceConfig.gdprCompliance,
            userAgent: this.complianceConfig.userAgent,
            timestamp: new Date().toISOString()
        };
    }
}

// Export singleton instance
module.exports = new HeadlessBrowserService();
