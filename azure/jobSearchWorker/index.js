const { app } = require('@azure/functions');
const queueService = require('../lib/services/queue-service');
const automationLogger = require('../lib/services/automation-logs');
const OpenAI = require('openai');
const { fetchAzureSecrets } = require('../lib/azure-config');
const { v4: uuidv4 } = require('uuid');

// Import TheirStack portal
let getTheirStackPortal;
try {
    ({ getTheirStackPortal } = require('../../portals/theirstack'));
} catch (error) {
    console.warn('⚠️ TheirStack portal not available:', error.message);
    getTheirStackPortal = null;
}

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

        console.log('✅ Azure OpenAI client initialized for job search worker');
        return azureOpenAIClient;
    } catch (error) {
        console.error('❌ Failed to initialize Azure OpenAI client:', error);
        return null;
    }
}

// Queue trigger function for processing job searches
app.storageQueue('jobSearchWorker', {
    queueName: 'search-jobs',
    connection: 'AzureWebJobsStorage',
    handler: async (queueItem, context) => {
        context.log('Job Search Worker processing queue item:', queueItem);

        try {
            const searchData = typeof queueItem === 'string' ? JSON.parse(queueItem) : queueItem;
            const { userId, filters, requestId, autoApply, autoApplyThreshold, dailyLimit, priority } = searchData;

            await automationLogger.logInfo(
                'job_search_processing_started',
                `Starting job search processing for user ${userId}`,
                { userId, requestId, autoApply, priority }
            );

            // Validate user and search parameters
            if (!userId || !filters) {
                throw new Error('Invalid search parameters: userId and filters are required');
            }

            // Get user profile for relevancy calculation
            const userProfile = await getUserProfile(userId);
            if (!userProfile) {
                throw new Error(`User profile not found for user ${userId}`);
            }

            // Perform job search across configured portals
            const searchResults = await searchJobsAcrossPortals(userId, filters);
            
            if (searchResults.jobs.length === 0) {
                await automationLogger.logInfo(
                    'job_search_no_results',
                    'No jobs found for search criteria',
                    { userId, requestId, filters }
                );
                return;
            }

            // Calculate relevancy scores for found jobs
            const jobsWithRelevancy = await calculateRelevancyScores(searchResults.jobs, userProfile);

            // Filter jobs based on relevancy threshold
            const relevantJobs = jobsWithRelevancy.filter(job => 
                job.relevancyScore >= filters.minimumRelevancyScore
            );

            // Log search results
            await automationLogger.logJobSearch(userId, filters, {
                jobs: relevantJobs,
                totalFound: searchResults.jobs.length,
                relevantCount: relevantJobs.length
            });

            // Process auto-apply if enabled
            if (autoApply && relevantJobs.length > 0) {
                await processAutoApply(userId, relevantJobs, autoApplyThreshold, dailyLimit, userProfile);
            }

            // Store discovered jobs for user (TODO: implement proper storage)
            await storeDiscoveredJobs(userId, relevantJobs);

            // Send job discovered notifications
            await sendJobDiscoveredNotifications(userId, relevantJobs);

            context.log(`Successfully processed job search for user ${userId}: found ${relevantJobs.length} relevant jobs`);

        } catch (error) {
            context.log('Error processing job search:', error);
            await automationLogger.logError(
                'job_search_processing_error',
                error,
                { queueItem }
            );
            
            // Re-throw to trigger Azure Functions retry logic
            throw error;
        }
    }
});

/**
 * Search for jobs across multiple portals
 */
async function searchJobsAcrossPortals(userId, filters) {
    const allJobs = [];
    const searchedPortals = [];
    const mockJobs = await getMockJobListings(); // Fallback to mock data

    try {
        // Try TheirStack portal first
        if (getTheirStackPortal) {
            try {
                console.log('🔍 Searching TheirStack for jobs...');
                const theirStackPortal = getTheirStackPortal();
                
                if (theirStackPortal.isConfigured()) {
                    const theirStackJobs = await theirStackPortal.searchJobs(userId, filters);
                    allJobs.push(...theirStackJobs);
                    searchedPortals.push('TheirStack');
                    console.log(`✅ Found ${theirStackJobs.length} jobs from TheirStack`);
                } else {
                    console.warn('⚠️ TheirStack not configured, skipping');
                }
            } catch (error) {
                console.error('❌ TheirStack search failed:', error.message);
                // Continue to fallback options
            }
        }

        // If TheirStack didn't return enough jobs or failed, use mock data as fallback
        if (allJobs.length === 0) {
            console.log('🔄 Falling back to mock job data');
            const filteredJobs = filterJobsBySearchCriteria(mockJobs, filters);
            allJobs.push(...filteredJobs);
            searchedPortals.push('Mock');
        }

        console.log(`Found ${allJobs.length} total jobs across portals for user ${userId}`);

        return {
            jobs: allJobs,
            totalCount: allJobs.length,
            searchedPortals,
            searchedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error searching across portals:', error);
        
        // Final fallback to mock data
        console.log('🔄 Using mock data as final fallback');
        const fallbackJobs = filterJobsBySearchCriteria(mockJobs, filters);
        return {
            jobs: fallbackJobs,
            totalCount: fallbackJobs.length,
            searchedPortals: ['Mock (Fallback)'],
            searchedAt: new Date().toISOString()
        };
    }
}

/**
 * Filter jobs based on search criteria
 */
function filterJobsBySearchCriteria(jobs, filters) {
    return jobs.filter(job => {
        // Keywords filtering
        if (filters.keywords && filters.keywords.length > 0) {
            const jobText = `${job.title} ${job.description} ${job.requirements?.join(' ')}`.toLowerCase();
            const hasKeyword = filters.keywords.some(keyword => 
                jobText.includes(keyword.toLowerCase())
            );
            if (!hasKeyword) return false;
        }

        // Location filtering
        if (filters.locations && filters.locations.length > 0) {
            const hasLocation = filters.locations.some(location =>
                job.location.toLowerCase().includes(location.toLowerCase()) ||
                (location.toLowerCase() === 'remote' && job.workArrangement === 'remote')
            );
            if (!hasLocation) return false;
        }

        // Job type filtering
        if (filters.jobTypes && filters.jobTypes.length > 0) {
            if (!filters.jobTypes.includes(job.jobType)) {
                return false;
            }
        }

        // Work arrangement filtering
        if (filters.workArrangements && filters.workArrangements.length > 0) {
            if (!filters.workArrangements.includes(job.workArrangement)) {
                return false;
            }
        }

        // Date filtering
        const daysDiff = Math.ceil((new Date().getTime() - new Date(job.postedDate).getTime()) / (1000 * 60 * 60 * 24));
        if (filters.datePosted) {
            switch (filters.datePosted) {
                case 'past-24-hours':
                    if (daysDiff > 1) return false;
                    break;
                case 'past-week':
                    if (daysDiff > 7) return false;
                    break;
                case 'past-month':
                    if (daysDiff > 30) return false;
                    break;
            }
        }

        return true;
    });
}

/**
 * Calculate relevancy scores for jobs using AI
 */
async function calculateRelevancyScores(jobs, userProfile) {
    const jobsWithRelevancy = [];

    for (const job of jobs) {
        try {
            const relevancyScore = await calculateJobRelevancy(job, userProfile);
            jobsWithRelevancy.push({
                ...job,
                relevancyScore,
                matchedSkills: getMatchedSkills(job, userProfile.skills),
                missingSkills: getMissingSkills(job, userProfile.skills)
            });
        } catch (error) {
            console.error(`Error calculating relevancy for job ${job.id}:`, error);
            // Add job with default relevancy
            jobsWithRelevancy.push({
                ...job,
                relevancyScore: 50,
                matchedSkills: [],
                missingSkills: []
            });
        }
    }

    return jobsWithRelevancy.sort((a, b) => (b.relevancyScore || 0) - (a.relevancyScore || 0));
}

/**
 * Calculate job relevancy using AI
 */
async function calculateJobRelevancy(jobListing, userProfile) {
    try {
        const client = await initializeAzureOpenAI();
        
        if (!client) {
            console.warn('Azure OpenAI client not available, using fallback relevancy calculation');
            return calculateFallbackRelevancy(jobListing, userProfile);
        }
        
        const prompt = `
            Analyze the relevancy between this job posting and the candidate's profile:
            
            JOB TITLE: ${jobListing.title}
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
            model: 'gpt-35-turbo', // Using gpt-35-turbo for quick relevancy scoring
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
 * Get matched skills between job and user profile
 */
function getMatchedSkills(job, userSkills) {
    if (!userSkills || !job.requirements) return [];
    
    const jobText = `${job.title} ${job.description} ${job.requirements.join(' ')}`.toLowerCase();
    return userSkills.filter(skill => 
        jobText.includes(skill.toLowerCase())
    );
}

/**
 * Get missing skills from job requirements
 */
function getMissingSkills(job, userSkills) {
    if (!userSkills || !job.requirements) return [];
    
    const userSkillsLower = userSkills.map(s => s.toLowerCase());
    return job.requirements.filter(req => 
        !userSkillsLower.some(skill => req.toLowerCase().includes(skill))
    );
}

/**
 * Process auto-apply for relevant jobs
 */
async function processAutoApply(userId, relevantJobs, autoApplyThreshold, dailyLimit, userProfile) {
    try {
        // Check current application count for today
        const todayApplications = await getTodayApplicationCount(userId);
        let remainingApplications = dailyLimit - todayApplications;

        if (remainingApplications <= 0) {
            await automationLogger.logWarning(
                'auto_apply_daily_limit_reached',
                `Daily application limit reached (${dailyLimit})`,
                { userId, todayApplications, dailyLimit }
            );
            return;
        }

        // Filter jobs that meet auto-apply threshold
        const autoApplyJobs = relevantJobs.filter(job => 
            job.relevancyScore >= autoApplyThreshold
        ).slice(0, remainingApplications); // Limit to remaining daily applications

        console.log(`Processing ${autoApplyJobs.length} jobs for auto-apply (threshold: ${autoApplyThreshold})`);

        // Queue applications for processing
        for (const job of autoApplyJobs) {
            try {
                const applicationMessage = {
                    userId,
                    jobId: job.id,
                    jobListing: job,
                    requestId: uuidv4(),
                    autoApply: true,
                    queuedAt: new Date().toISOString()
                };

                await queueService.addMessage(
                    queueService.queues.PROCESS_APPLICATIONS,
                    applicationMessage,
                    {
                        visibilityTimeout: Math.floor(Math.random() * 120) + 30 // Random delay 30-150 seconds
                    }
                );

                await automationLogger.logJobDiscovered(userId, job.id, job);
                
                console.log(`Queued auto-apply for job: ${job.title} at ${job.company}`);
            } catch (error) {
                console.error(`Error queuing auto-apply for job ${job.id}:`, error);
            }
        }

        await automationLogger.logInfo(
            'auto_apply_jobs_queued',
            `${autoApplyJobs.length} jobs queued for auto-apply`,
            { userId, queuedJobs: autoApplyJobs.length, threshold: autoApplyThreshold }
        );

    } catch (error) {
        console.error('Error processing auto-apply:', error);
        await automationLogger.logError('auto_apply_processing_error', error, { userId });
    }
}

/**
 * Get mock job listings for demonstration
 */
async function getMockJobListings() {
    return [
        {
            id: uuidv4(),
            title: 'Senior React Developer',
            company: 'TechFlow Solutions',
            location: 'San Francisco, CA',
            salary: { min: 130000, max: 170000, currency: 'USD', period: 'yearly' },
            jobType: 'full-time',
            workArrangement: 'hybrid',
            description: 'Join our growing team to build next-generation web applications using React, TypeScript, and modern development practices.',
            requirements: ['React', 'TypeScript', 'JavaScript', 'Redux', 'Jest'],
            responsibilities: ['Lead frontend architecture', 'Mentor developers', 'Code review'],
            postedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
            jobPortal: { name: 'LinkedIn', logo: '/icons/linkedin.svg', website: 'https://linkedin.com', supportsAutoApply: true },
            originalUrl: 'https://linkedin.com/jobs/react-dev-123',
            applicationStatus: 'discovered',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: uuidv4(),
            title: 'Full Stack Engineer',
            company: 'InnovateCorp',
            location: 'Remote',
            salary: { min: 110000, max: 150000, currency: 'USD', period: 'yearly' },
            jobType: 'full-time',
            workArrangement: 'remote',
            description: 'We are looking for a versatile Full Stack Engineer to work on our SaaS platform using React and Node.js.',
            requirements: ['React', 'Node.js', 'PostgreSQL', 'AWS', 'Docker'],
            responsibilities: ['Develop full-stack features', 'Design APIs', 'Database optimization'],
            postedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
            jobPortal: { name: 'Indeed', logo: '/icons/indeed.svg', website: 'https://indeed.com', supportsAutoApply: true },
            originalUrl: 'https://indeed.com/jobs/fullstack-456',
            applicationStatus: 'discovered',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: uuidv4(),
            title: 'Frontend Developer',
            company: 'StartupXYZ',
            location: 'New York, NY',
            salary: { min: 90000, max: 120000, currency: 'USD', period: 'yearly' },
            jobType: 'full-time',
            workArrangement: 'onsite',
            description: 'Join our early-stage startup to build innovative web applications with React and modern tools.',
            requirements: ['React', 'JavaScript', 'CSS', 'Git'],
            responsibilities: ['Build responsive web apps', 'Collaborate with designers', 'Optimize performance'],
            postedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
            jobPortal: { name: 'AngelList', logo: '/icons/angellist.svg', website: 'https://angel.co', supportsAutoApply: true },
            originalUrl: 'https://angel.co/jobs/frontend-789',
            applicationStatus: 'discovered',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ];
}

// Utility functions (TODO: Implement with proper data storage)

async function getUserProfile(userId) {
    return {
        id: userId,
        name: 'John Doe',
        email: 'john.doe@example.com',
        skills: ['JavaScript', 'React', 'TypeScript', 'Node.js', 'Python'],
        experience: [
            { position: 'Frontend Developer', company: 'Tech Corp', technologies: ['React', 'TypeScript'] }
        ],
        targetRoles: ['Frontend Developer', 'Full Stack Developer'],
        summary: 'Experienced frontend developer with expertise in React applications'
    };
}

async function getTodayApplicationCount(userId) {
    // TODO: Query database for today's applications
    return Math.floor(Math.random() * 2); // Mock count (0-1)
}

async function storeDiscoveredJobs(userId, jobs) {
    // TODO: Store discovered jobs in database (Firestore, etc.)
    console.log(`Storing ${jobs.length} discovered jobs for user ${userId}:`);
    jobs.forEach(job => {
        console.log(`- ${job.title} at ${job.company} (Score: ${job.relevancyScore})`);
    });
}

/**
 * Send job discovered notifications
 */
async function sendJobDiscoveredNotifications(userId, jobs) {
    try {
        // Import notification integration service
        const { jobNotificationIntegration } = require('../../lib/services/job-notification-integration');
        
        // Send job discovered notifications
        await jobNotificationIntegration.notifyJobsDiscovered(userId, jobs);
        
        console.log(`Job discovered notifications processed for user ${userId}: ${jobs.length} jobs`);
    } catch (error) {
        console.error('Error sending job discovered notifications:', error);
        // Don't throw error here to avoid breaking the job search workflow
    }
}
