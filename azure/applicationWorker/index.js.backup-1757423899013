const { app } = require('@azure/functions');
const queueService = require('../lib/services/queue-service');
const automationLogger = require('../lib/services/automation-logs');
const OpenAI = require('openai');
const { fetchAzureSecrets } = require('../lib/azure-config');
const { v4: uuidv4 } = require('uuid');

// Azure OpenAI client - will be initialized from Key Vault secrets
let azureOpenAIClient = null;

/**
 * Initialize Azure OpenAI client
 */
async function initializeAzureOpenAI() {
    if (azureOpenAIClient) {
        return azureOpenAIClient;
    }

    try {
        const secrets = await fetchAzureSecrets();
        
        if (!secrets.azureOpenAIKey || !secrets.azureOpenAIEndpoint) {
            console.warn('⚠️ Azure OpenAI credentials not available, using fallback');
            return null;
        }

        azureOpenAIClient = new OpenAI({
            apiKey: secrets.azureOpenAIKey,
            baseURL: `${secrets.azureOpenAIEndpoint}/openai/deployments/${secrets.azureOpenAIDeployment}`,
            defaultQuery: { 'api-version': '2024-08-01-preview' },
            defaultHeaders: {
                'api-key': secrets.azureOpenAIKey,
            },
        });

        console.log('✅ Azure OpenAI client initialized for application worker');
        return azureOpenAIClient;
    } catch (error) {
        console.error('❌ Failed to initialize Azure OpenAI client:', error);
        return null;
    }
}

// Queue trigger function for processing job applications
app.storageQueue('applicationWorker', {
    queueName: 'process-applications',
    connection: 'AzureWebJobsStorage',
    handler: async (queueItem, context) => {
        context.log('Application Worker processing queue item:', queueItem);

        try {
            const applicationData = typeof queueItem === 'string' ? JSON.parse(queueItem) : queueItem;
            const { userId, jobId, jobListing, requestId, autoApply } = applicationData;

            await automationLogger.logInfo(
                'application_processing_started',
                `Starting application processing for job ${jobId}`,
                { userId, jobId, requestId, autoApply }
            );

            // Get user profile and preferences
            const userProfile = await getUserProfile(userId);
            if (!userProfile) {
                throw new Error(`User profile not found for user ${userId}`);
            }

            // Check if user has already applied to this job
            const existingApplication = await checkExistingApplication(userId, jobId);
            if (existingApplication) {
                context.log(`User ${userId} has already applied to job ${jobId}`);
                await automationLogger.logWarning(
                    'application_duplicate_skipped',
                    'Skipping duplicate application',
                    { userId, jobId }
                );
                return;
            }

            // Calculate job relevancy if not already done
            let relevancyScore = jobListing.relevancyScore;
            if (!relevancyScore) {
                relevancyScore = await calculateJobRelevancy(jobListing, userProfile);
                jobListing.relevancyScore = relevancyScore;
            }

            // Check if job meets auto-apply threshold
            if (autoApply) {
                const autoApplySettings = await getUserAutoApplySettings(userId);
                if (relevancyScore < autoApplySettings.autoApplyThreshold) {
                    context.log(`Job relevancy score ${relevancyScore} below threshold ${autoApplySettings.autoApplyThreshold}`);
                    await automationLogger.logInfo(
                        'application_skipped_threshold',
                        `Job skipped due to low relevancy score: ${relevancyScore}`,
                        { userId, jobId, relevancyScore, threshold: autoApplySettings.autoApplyThreshold }
                    );
                    return;
                }

                // Check daily application limit
                const todayApplications = await getTodayApplicationCount(userId);
                if (todayApplications >= autoApplySettings.dailyApplicationLimit) {
                    context.log(`User ${userId} has reached daily application limit`);
                    await automationLogger.logWarning(
                        'application_daily_limit_reached',
                        'Daily application limit reached',
                        { userId, todayApplications, dailyLimit: autoApplySettings.dailyApplicationLimit }
                    );
                    return;
                }
            }

            // Generate cover letter
            const coverLetter = await generateCoverLetter(jobListing, userProfile);
            
            // Tailor resume for the job
            const tailoredResume = await tailorResume(userProfile.resume, jobListing);

            // Submit application
            const applicationResult = await submitJobApplication({
                userId,
                jobId,
                jobListing,
                userProfile,
                coverLetter,
                resume: tailoredResume,
                relevancyScore
            });

            if (applicationResult.success) {
                // Log successful application
                await automationLogger.logApplicationSubmitted(userId, jobId, applicationResult);

                // Send application submitted notification
                await sendApplicationSubmittedNotification(userId, {
                    id: applicationResult.applicationId,
                    userId,
                    jobId,
                    jobTitle: jobListing.title,
                    company: jobListing.company,
                    appliedAt: new Date(),
                    autoApplied: autoApply,
                    coverLetterUsed: !!coverLetter,
                    resumeTailored: !!tailoredResume,
                    relevancyScore
                });

                // Schedule follow-up reminder if enabled
                const autoApplySettings = await getUserAutoApplySettings(userId);
                if (autoApplySettings.followUpEnabled) {
                    await scheduleFollowUp(userId, applicationResult.applicationId, autoApplySettings.followUpSchedule);
                }

                context.log(`Successfully processed application for job ${jobId}`);
            } else {
                await automationLogger.logError(
                    'application_submission_failed',
                    new Error(applicationResult.message),
                    { userId, jobId, applicationResult }
                );
            }

        } catch (error) {
            context.log('Error processing application:', error);
            await automationLogger.logError(
                'application_processing_error',
                error,
                { queueItem }
            );
            
            // Re-throw to trigger Azure Functions retry logic
            throw error;
        }
    }
});

/**
 * Calculate job relevancy score using AI
 */
async function calculateJobRelevancy(jobListing, userProfile) {
    try {
        const client = await initializeAzureOpenAI();
        
        if (!client) {
            console.warn('Azure OpenAI client not available, using fallback scoring');
            return calculateFallbackRelevancy(jobListing, userProfile);
        }
        
        const prompt = `
            Analyze the relevancy between this job posting and the candidate's profile:
            
            JOB TITLE: ${jobListing.title}
            COMPANY: ${jobListing.company}
            JOB DESCRIPTION: ${jobListing.description}
            REQUIREMENTS: ${jobListing.requirements?.join(', ')}
            
            CANDIDATE PROFILE:
            Skills: ${userProfile.skills?.join(', ')}
            Experience: ${userProfile.experience?.map(exp => `${exp.position} at ${exp.company}`).join(', ')}
            Target Roles: ${userProfile.targetRoles?.join(', ')}
            
            Calculate a relevancy score from 0-100 based on:
            1. Skills match (40% weight)
            2. Role alignment (30% weight) 
            3. Experience level match (20% weight)
            4. Job requirements match (10% weight)
            
            Return only a number between 0-100.
        `;

        const completion = await client.chat.completions.create({
            model: 'gpt-35-turbo', // Using the deployment name
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 50
        });
        
        const scoreText = completion.choices[0]?.message?.content?.trim() || '';
        const score = parseInt(scoreText);
        
        return isNaN(score) ? 50 : Math.max(0, Math.min(100, score));
    } catch (error) {
        console.error('Error calculating job relevancy with Azure OpenAI:', error);
        return calculateFallbackRelevancy(jobListing, userProfile);
    }
}

/**
 * Fallback relevancy calculation using keyword matching
 */
function calculateFallbackRelevancy(jobListing, userProfile) {
    const jobText = `${jobListing.title} ${jobListing.description} ${jobListing.requirements?.join(' ')}`.toLowerCase();
    const matchedSkills = userProfile.skills?.filter(skill => jobText.includes(skill.toLowerCase())) || [];
    return Math.min(90, (matchedSkills.length / (userProfile.skills?.length || 1)) * 100);
}

/**
 * Generate AI-powered cover letter
 */
async function generateCoverLetter(jobListing, userProfile) {
    try {
        const client = await initializeAzureOpenAI();
        
        if (!client) {
            console.warn('Azure OpenAI client not available, using fallback cover letter');
            return generateFallbackCoverLetter(jobListing, userProfile);
        }
        
        const prompt = `
            Generate a professional cover letter for this job application:
            
            JOB DETAILS:
            Position: ${jobListing.title}
            Company: ${jobListing.company}
            Description: ${jobListing.description}
            Requirements: ${jobListing.requirements?.join(', ')}
            
            CANDIDATE PROFILE:
            Name: ${userProfile.name}
            Skills: ${userProfile.skills?.join(', ')}
            Experience: ${userProfile.experience?.map(exp => `${exp.position} at ${exp.company}`).join(', ')}
            Summary: ${userProfile.summary}
            
            Requirements:
            1. Professional tone and format
            2. Highlight relevant skills and experience
            3. Show enthusiasm for the role and company
            4. Keep it concise (3-4 paragraphs)
            5. Include specific examples when possible
            6. Address any skill gaps positively
            
            Return only the cover letter text, no additional formatting or explanations.
        `;

        const completion = await client.chat.completions.create({
            model: 'gpt-4o', // Using gpt-4o for better content generation
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 1000
        });
        
        return completion.choices[0]?.message?.content?.trim() || generateFallbackCoverLetter(jobListing, userProfile);

    } catch (error) {
        console.error('Error generating cover letter with Azure OpenAI:', error);
        return generateFallbackCoverLetter(jobListing, userProfile);
    }
}

/**
 * Generate fallback cover letter
 */
function generateFallbackCoverLetter(jobListing, userProfile) {
    return `Dear Hiring Manager,

I am writing to express my strong interest in the ${jobListing.title} position at ${jobListing.company}. With my background in ${userProfile.skills?.slice(0, 3).join(', ')}, I am confident that I would be a valuable addition to your team.

In my previous roles, I have gained extensive experience in ${userProfile.skills?.slice(0, 2).join(' and ')}, which directly aligns with the requirements outlined in your job posting. I am particularly excited about the opportunity to contribute to ${jobListing.company}'s innovative work in this space.

I would welcome the opportunity to discuss how my skills and enthusiasm can contribute to your team's success. Thank you for considering my application.

Best regards,
${userProfile.name}`;
}

/**
 * Tailor resume for specific job
 */
async function tailorResume(originalResume, jobListing) {
    try {
        const client = await initializeAzureOpenAI();
        
        if (!client) {
            console.warn('Azure OpenAI client not available, returning original resume');
            return originalResume;
        }
        
        const prompt = `
            Tailor this resume for the specific job posting to maximize ATS compatibility and relevance:
            
            JOB DESCRIPTION:
            ${jobListing.description}
            REQUIREMENTS: ${jobListing.requirements?.join(', ')}
            
            ORIGINAL RESUME:
            ${originalResume}
            
            Instructions:
            1. Optimize keywords for ATS systems
            2. Highlight most relevant experience first
            3. Include specific skills mentioned in job description
            4. Quantify achievements where possible
            5. Maintain professional formatting
            6. Keep same overall structure and length
            
            Return only the tailored resume content.
        `;

        const completion = await client.chat.completions.create({
            model: 'gpt-4o', // Using gpt-4o for better content generation
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 2000
        });
        
        return completion.choices[0]?.message?.content?.trim() || originalResume;

    } catch (error) {
        console.error('Error tailoring resume with Azure OpenAI:', error);
        return originalResume; // Return original if tailoring fails
    }
}

/**
 * Submit job application to the appropriate portal
 */
async function submitJobApplication(applicationData) {
    try {
        const { userId, jobId, jobListing, userProfile, coverLetter, resume, relevancyScore } = applicationData;
        
        // TODO: Implement portal-specific application submission
        // This would involve:
        // 1. Portal-specific API calls (LinkedIn, Indeed, etc.)
        // 2. Form filling automation (for portals without APIs)
        // 3. File uploads (resume, cover letter)
        // 4. Application tracking

        const applicationId = uuidv4();
        
        // Simulate application processing
        const success = Math.random() > 0.1; // 90% success rate
        
        if (success) {
            // Store application in database (TODO: implement proper storage)
            await storeJobApplication({
                id: applicationId,
                userId,
                jobId,
                status: 'applied',
                appliedAt: new Date().toISOString(),
                coverLetter,
                tailoredResume: resume,
                relevancyScore,
                portal: jobListing.jobPortal?.name,
                jobTitle: jobListing.title,
                company: jobListing.company
            });

            return {
                success: true,
                message: 'Application submitted successfully',
                applicationId
            };
        } else {
            return {
                success: false,
                message: 'Failed to submit application to job portal'
            };
        }

    } catch (error) {
        console.error('Error submitting job application:', error);
        return {
            success: false,
            message: error.message || 'Internal error during application submission'
        };
    }
}

/**
 * Schedule follow-up reminder
 */
async function scheduleFollowUp(userId, applicationId, followUpSchedule) {
    try {
        const followUpMessage = {
            userId,
            applicationId,
            type: 'initial_follow_up',
            scheduledDate: new Date(Date.now() + (followUpSchedule.initialDays * 24 * 60 * 60 * 1000)).toISOString(),
            createdAt: new Date().toISOString()
        };

        await queueService.addMessage(
            queueService.queues.FOLLOW_UP_REMINDERS,
            followUpMessage,
            {
                visibilityTimeout: followUpSchedule.initialDays * 24 * 60 * 60 // Delay until follow-up date
            }
        );

        console.log(`Follow-up scheduled for application ${applicationId}`);
    } catch (error) {
        console.error('Error scheduling follow-up:', error);
    }
}

// Utility functions (TODO: Implement with proper data storage)

async function getUserProfile(userId) {
    // Mock user profile
    return {
        id: userId,
        name: 'John Doe',
        email: 'john.doe@example.com',
        skills: ['JavaScript', 'React', 'TypeScript', 'Node.js', 'Python'],
        experience: [
            { position: 'Frontend Developer', company: 'Tech Corp', technologies: ['React', 'TypeScript'] }
        ],
        targetRoles: ['Frontend Developer', 'Full Stack Developer'],
        summary: 'Experienced frontend developer with expertise in React applications',
        resume: 'Detailed resume content would be stored here...'
    };
}

async function getUserAutoApplySettings(userId) {
    return {
        autoApplyThreshold: 75,
        dailyApplicationLimit: 5,
        followUpEnabled: true,
        followUpSchedule: {
            initialDays: 3,
            secondDays: 7
        }
    };
}

async function checkExistingApplication(userId, jobId) {
    // TODO: Check database for existing applications
    return null; // No existing application found
}

async function getTodayApplicationCount(userId) {
    // TODO: Query database for today's applications
    return Math.floor(Math.random() * 3); // Mock count
}

async function storeJobApplication(applicationData) {
    // TODO: Store in database (Firestore, etc.)
    console.log('Storing job application:', applicationData);
}

/**
 * Send application submitted notification
 */
async function sendApplicationSubmittedNotification(userId, applicationData) {
    try {
        // Import notification integration service
        const { jobNotificationIntegration } = require('../../lib/services/job-notification-integration');
        
        // Send application submitted notification
        await jobNotificationIntegration.notifyApplicationSubmitted(userId, applicationData);
        
        console.log(`Application submitted notification sent for user ${userId}, application ${applicationData.id}`);
    } catch (error) {
        console.error('Error sending application submitted notification:', error);
        // Don't throw error here to avoid breaking the application workflow
    }
}
