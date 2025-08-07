const { app } = require('@azure/functions');
const queueService = require('../lib/services/queue-service');
const automationLogger = require('../lib/services/automation-logs');
const { v4: uuidv4 } = require('uuid');
const { initializeAzureOpenAI, getAzureOpenAIClient } = require('../lib/azure-openai-client');

// Queue trigger function for processing follow-up reminders
app.storageQueue('followUpWorker', {
    queueName: 'follow-up-reminders',
    connection: 'AzureWebJobsStorage',
    handler: async (queueItem, context) => {
        context.log('Follow Up Worker processing queue item:', queueItem);

        try {
            const reminderData = typeof queueItem === 'string' ? JSON.parse(queueItem) : queueItem;
            const { userId, applicationId, type, scheduledDate } = reminderData;

            await automationLogger.logInfo(
                'follow_up_processing_started',
                `Processing follow-up reminder for application ${applicationId}`,
                { userId, applicationId, type, scheduledDate }
            );

            // Check if the follow-up is due
            const now = new Date();
            const scheduledTime = new Date(scheduledDate);
            
            if (now < scheduledTime) {
                // Follow-up is not due yet, re-queue with appropriate delay
                const delaySeconds = Math.ceil((scheduledTime - now) / 1000);
                context.log(`Follow-up not due yet, re-queueing with ${delaySeconds} seconds delay`);
                
                await queueService.addMessage(
                    queueService.queues.FOLLOW_UP_REMINDERS,
                    reminderData,
                    { visibilityTimeout: delaySeconds }
                );
                return;
            }

            // Get application details
            const application = await getJobApplication(applicationId);
            if (!application) {
                await automationLogger.logWarning(
                    'follow_up_application_not_found',
                    `Application ${applicationId} not found, skipping follow-up`,
                    { applicationId, type }
                );
                return;
            }

            // Check if follow-up has already been sent
            if (await isFollowUpAlreadySent(applicationId, type)) {
                context.log(`Follow-up of type ${type} already sent for application ${applicationId}`);
                return;
            }

            // Get user preferences
            const userProfile = await getUserProfile(userId);
            const autoApplySettings = await getUserAutoApplySettings(userId);

            // Check if user still wants follow-ups
            if (!autoApplySettings.followUpEnabled) {
                context.log(`User ${userId} has disabled follow-ups`);
                return;
            }

            // Generate and send follow-up message
            const followUpResult = await processFollowUp({
                userId,
                applicationId,
                application,
                userProfile,
                type,
                autoApplySettings
            });

            if (followUpResult.success) {
                // Mark follow-up as sent
                await markFollowUpAsSent(applicationId, type);

                // Send follow-up reminder notification
                await sendFollowUpReminderNotification(userId, application, type, followUpResult.followUpMessage);

                // Schedule next follow-up if applicable
                await scheduleNextFollowUp(userId, applicationId, type, autoApplySettings.followUpSchedule);

                await automationLogger.logFollowUpSent(userId, applicationId, type);
                
                context.log(`Successfully processed ${type} follow-up for application ${applicationId}`);
            } else {
                await automationLogger.logError(
                    'follow_up_processing_failed',
                    new Error(followUpResult.message),
                    { userId, applicationId, type, followUpResult }
                );
            }

        } catch (error) {
            context.log('Error processing follow-up reminder:', error);
            await automationLogger.logError(
                'follow_up_processing_error',
                error,
                { queueItem }
            );
            
            // Re-throw to trigger Azure Functions retry logic
            throw error;
        }
    }
});

/**
 * Process follow-up based on type
 */
async function processFollowUp({ userId, applicationId, application, userProfile, type, autoApplySettings }) {
    try {
        switch (type) {
            case 'initial_follow_up':
                return await sendInitialFollowUp(userId, application, userProfile);
            
            case 'second_follow_up':
                return await sendSecondFollowUp(userId, application, userProfile);
            
            case 'thank_you':
                return await sendThankYouNote(userId, application, userProfile);
            
            case 'status_check':
                return await sendStatusCheck(userId, application, userProfile);
            
            default:
                throw new Error(`Unknown follow-up type: ${type}`);
        }
    } catch (error) {
        console.error(`Error processing ${type} follow-up:`, error);
        return {
            success: false,
            message: error.message || 'Failed to process follow-up'
        };
    }
}

/**
 * Send initial follow-up message
 */
async function sendInitialFollowUp(userId, application, userProfile) {
    try {
        const followUpMessage = await generateFollowUpMessage({
            type: 'initial_follow_up',
            application,
            userProfile,
            context: 'Express continued interest and highlight relevant qualifications'
        });

        // TODO: Send via appropriate channel (email, LinkedIn, etc.)
        const sent = await sendMessage(userId, application, followUpMessage, 'initial_follow_up');
        
        return {
            success: sent,
            message: sent ? 'Initial follow-up sent successfully' : 'Failed to send initial follow-up',
            followUpMessage
        };
    } catch (error) {
        console.error('Error sending initial follow-up:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Send second follow-up message
 */
async function sendSecondFollowUp(userId, application, userProfile) {
    try {
        const followUpMessage = await generateFollowUpMessage({
            type: 'second_follow_up',
            application,
            userProfile,
            context: 'Final polite follow-up with additional value proposition'
        });

        const sent = await sendMessage(userId, application, followUpMessage, 'second_follow_up');
        
        return {
            success: sent,
            message: sent ? 'Second follow-up sent successfully' : 'Failed to send second follow-up',
            followUpMessage
        };
    } catch (error) {
        console.error('Error sending second follow-up:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Send thank you note
 */
async function sendThankYouNote(userId, application, userProfile) {
    try {
        const followUpMessage = await generateFollowUpMessage({
            type: 'thank_you',
            application,
            userProfile,
            context: 'Professional thank you note after interview or interaction'
        });

        const sent = await sendMessage(userId, application, followUpMessage, 'thank_you');
        
        return {
            success: sent,
            message: sent ? 'Thank you note sent successfully' : 'Failed to send thank you note',
            followUpMessage
        };
    } catch (error) {
        console.error('Error sending thank you note:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Send status check message
 */
async function sendStatusCheck(userId, application, userProfile) {
    try {
        const followUpMessage = await generateFollowUpMessage({
            type: 'status_check',
            application,
            userProfile,
            context: 'Polite inquiry about application status and timeline'
        });

        const sent = await sendMessage(userId, application, followUpMessage, 'status_check');
        
        return {
            success: sent,
            message: sent ? 'Status check sent successfully' : 'Failed to send status check',
            followUpMessage
        };
    } catch (error) {
        console.error('Error sending status check:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Generate AI-powered follow-up message
 */
async function generateFollowUpMessage({ type, application, userProfile, context }) {
    try {
        // Initialize Azure OpenAI client
        await initializeAzureOpenAI();
        const client = await getAzureOpenAIClient();
        
        const daysSinceApplication = Math.floor((new Date() - new Date(application.appliedAt)) / (1000 * 60 * 60 * 24));
        
        const prompt = `
            Generate a professional follow-up message for a job application:
            
            FOLLOW-UP TYPE: ${type}
            CONTEXT: ${context}
            
            APPLICATION DETAILS:
            Position: ${application.jobTitle}
            Company: ${application.company}
            Applied: ${daysSinceApplication} days ago
            Portal: ${application.portal}
            
            CANDIDATE INFO:
            Name: ${userProfile.name}
            Skills: ${userProfile.skills?.join(', ')}
            Experience: ${userProfile.experience?.map(exp => `${exp.position} at ${exp.company}`).join(', ')}
            
            Requirements:
            1. Professional and respectful tone
            2. Concise and to the point
            3. Show genuine interest in the role
            4. Add value without being pushy
            5. Include appropriate subject line
            6. Keep it under 150 words
            
            Format:
            Subject: [Subject Line]
            
            [Message Body]
            
            Best regards,
            ${userProfile.name}
        `;

        const result = await client.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 800,
            temperature: 0.7
        });
        
        return result.choices[0]?.message?.content?.trim() || '';

    } catch (error) {
        console.error('Error generating follow-up message:', error);
        
        // Fallback message based on type
        return generateFallbackMessage(type, application, userProfile);
    }
}

/**
 * Generate fallback follow-up message
 */
function generateFallbackMessage(type, application, userProfile) {
    const daysSinceApplication = Math.floor((new Date() - new Date(application.appliedAt)) / (1000 * 60 * 60 * 24));
    
    switch (type) {
        case 'initial_follow_up':
            return `Subject: Following up on ${application.jobTitle} application

Dear Hiring Manager,

I hope this email finds you well. I wanted to follow up on my application for the ${application.jobTitle} position at ${application.company}, which I submitted ${daysSinceApplication} days ago.

I remain very interested in this opportunity and believe my experience in ${userProfile.skills?.slice(0, 2).join(' and ')} would be valuable to your team. I would welcome the opportunity to discuss how I can contribute to ${application.company}'s success.

Thank you for your time and consideration.

Best regards,
${userProfile.name}`;

        case 'second_follow_up':
            return `Subject: Final follow-up - ${application.jobTitle} position

Dear Hiring Manager,

I wanted to reach out one final time regarding my application for the ${application.jobTitle} role at ${application.company}. I understand you likely receive many applications, but I wanted to reiterate my strong interest in this position.

If you need any additional information or have questions about my background, I would be happy to provide them.

Thank you for your consideration.

Best regards,
${userProfile.name}`;

        case 'thank_you':
            return `Subject: Thank you for your time

Dear Hiring Manager,

Thank you for taking the time to review my application for the ${application.jobTitle} position at ${application.company}. I appreciate the opportunity to be considered for this role.

If you need any additional information, please don't hesitate to reach out.

Best regards,
${userProfile.name}`;

        case 'status_check':
            return `Subject: Application status inquiry - ${application.jobTitle}

Dear Hiring Manager,

I hope this message finds you well. I wanted to inquire about the status of my application for the ${application.jobTitle} position at ${application.company}, which I submitted ${daysSinceApplication} days ago.

I understand the selection process takes time, and I wanted to confirm that my application was received. I remain very interested in this opportunity.

Thank you for your time.

Best regards,
${userProfile.name}`;

        default:
            return `Subject: Following up on my application

Dear Hiring Manager,

I wanted to follow up on my application for the ${application.jobTitle} position at ${application.company}. I remain interested in this opportunity and would welcome the chance to discuss my qualifications further.

Best regards,
${userProfile.name}`;
    }
}

/**
 * Send message via appropriate channel
 */
async function sendMessage(userId, application, message, followUpType) {
    try {
        // TODO: Implement actual message sending via:
        // 1. Email service (SendGrid, AWS SES, etc.)
        // 2. LinkedIn API (if connected)
        // 3. Other messaging platforms
        
        console.log(`Sending ${followUpType} message for application ${application.id}:`);
        console.log(message);
        
        // For demonstration, simulate sending
        const success = Math.random() > 0.05; // 95% success rate
        
        if (success) {
            // Store follow-up record (TODO: implement proper storage)
            await storeFollowUpRecord({
                id: uuidv4(),
                userId,
                applicationId: application.id,
                type: followUpType,
                message,
                sentAt: new Date().toISOString(),
                channel: 'email', // or 'linkedin', etc.
                status: 'sent'
            });
        }
        
        return success;
    } catch (error) {
        console.error('Error sending message:', error);
        return false;
    }
}

/**
 * Schedule next follow-up in the sequence
 */
async function scheduleNextFollowUp(userId, applicationId, currentType, followUpSchedule) {
    try {
        let nextType = null;
        let delayDays = 0;

        switch (currentType) {
            case 'initial_follow_up':
                nextType = 'second_follow_up';
                delayDays = followUpSchedule.secondDays;
                break;
            case 'second_follow_up':
                // No more follow-ups after second follow-up
                console.log(`No more follow-ups scheduled after ${currentType}`);
                return;
            default:
                return;
        }

        if (nextType && delayDays > 0) {
            const scheduledDate = new Date(Date.now() + (delayDays * 24 * 60 * 60 * 1000));
            
            const nextFollowUpMessage = {
                userId,
                applicationId,
                type: nextType,
                scheduledDate: scheduledDate.toISOString(),
                createdAt: new Date().toISOString()
            };

            await queueService.addMessage(
                queueService.queues.FOLLOW_UP_REMINDERS,
                nextFollowUpMessage,
                {
                    visibilityTimeout: delayDays * 24 * 60 * 60 // Delay until follow-up date
                }
            );

            console.log(`Scheduled ${nextType} follow-up for application ${applicationId} in ${delayDays} days`);
        }
    } catch (error) {
        console.error('Error scheduling next follow-up:', error);
    }
}

// Utility functions (TODO: Implement with proper data storage)

async function getJobApplication(applicationId) {
    // Mock application data
    return {
        id: applicationId,
        jobTitle: 'Senior React Developer',
        company: 'TechFlow Solutions',
        portal: 'LinkedIn',
        appliedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        status: 'applied'
    };
}

async function getUserProfile(userId) {
    return {
        id: userId,
        name: 'John Doe',
        email: 'john.doe@example.com',
        skills: ['JavaScript', 'React', 'TypeScript', 'Node.js'],
        experience: [
            { position: 'Frontend Developer', company: 'Tech Corp', technologies: ['React', 'TypeScript'] }
        ]
    };
}

async function getUserAutoApplySettings(userId) {
    return {
        followUpEnabled: true,
        followUpSchedule: {
            initialDays: 3,
            secondDays: 7
        }
    };
}

async function isFollowUpAlreadySent(applicationId, type) {
    // TODO: Check database for existing follow-up records
    return false; // For demonstration, assume no duplicates
}

async function markFollowUpAsSent(applicationId, type) {
    // TODO: Update database to mark follow-up as sent
    console.log(`Marked ${type} follow-up as sent for application ${applicationId}`);
}

async function storeFollowUpRecord(followUpData) {
    // TODO: Store in database (Firestore, etc.)
    console.log('Storing follow-up record:', followUpData);
}

/**
 * Send follow-up reminder notification
 */
async function sendFollowUpReminderNotification(userId, application, followUpType, suggestedMessage) {
    try {
        // Import notification integration service
        const { jobNotificationIntegration } = require('../../lib/services/job-notification-integration');
        
        // Send follow-up reminder notification
        await jobNotificationIntegration.notifyFollowUpReminder(
            userId,
            {
                id: application.id,
                jobTitle: application.jobTitle,
                company: application.company,
                appliedAt: new Date(application.appliedAt)
            },
            followUpType,
            suggestedMessage
        );
        
        console.log(`Follow-up reminder notification sent for user ${userId}, application ${application.id}, type ${followUpType}`);
    } catch (error) {
        console.error('Error sending follow-up reminder notification:', error);
        // Don't throw error here to avoid breaking the follow-up workflow
    }
}
