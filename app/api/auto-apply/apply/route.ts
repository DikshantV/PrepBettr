import { NextRequest, NextResponse } from 'next/server';
import { ApplyToJobRequest, ApiResponse, JobApplication, AutomationLogEntry } from '@/types/auto-apply';
import { v4 as uuidv4 } from 'uuid';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { featureFlagsService } from '@/lib/services/feature-flags';
import { errorBudgetMonitor } from '@/lib/services/error-budget-monitor';
import { userTargetingService } from '@/lib/services/user-targeting';
import { generateCoverLetter as generateCL, tailorResume as tailorRS } from '@/lib/ai';

async function generateCoverLetter(
  jobTitle: string, 
  companyName: string, 
  jobDescription: string, 
  userProfile: any,
  template?: string
): Promise<string> {
  try {
    // Create resume text from user profile
    const resumeText = `
Name: ${userProfile.name}
Skills: ${userProfile.skills?.join(', ')}
Experience: ${userProfile.experience?.map((exp: any) => `${exp.position} at ${exp.company}`).join(', ')}
Summary: ${userProfile.summary}
`;
    
    // Create job description with company info
    const fullJobDescription = `
Position: ${jobTitle}
Company: ${companyName}
Description: ${jobDescription}
`;
    
    // Use the AI service layer
    const response = await generateCL(resumeText, fullJobDescription);
    
    if (response.success) {
      return response.data || '';
    }
    
    throw new Error(response.error || 'Failed to generate cover letter');

  } catch (error) {
    console.error('Error generating cover letter:', error);
    
    // Fallback generic cover letter
    return `Dear Hiring Manager,

I am writing to express my strong interest in the ${jobTitle} position at ${companyName}. With my background in ${userProfile.skills?.slice(0, 3).join(', ')}, I am confident that I would be a valuable addition to your team.

In my previous roles, I have gained extensive experience in ${userProfile.skills?.slice(0, 2).join(' and ')}, which directly aligns with the requirements outlined in your job posting. I am particularly excited about the opportunity to contribute to ${companyName}'s innovative work in this space.

I would welcome the opportunity to discuss how my skills and enthusiasm can contribute to your team's success. Thank you for considering my application.

Best regards,
${userProfile.name}`;
  }
}

async function tailorResume(originalResume: string, jobDescription: string): Promise<string> {
  try {
    // Use the AI service layer
    const response = await tailorRS(originalResume, jobDescription);
    
    if (response.success) {
      return response.data || originalResume;
    }
    
    throw new Error(response.error || 'Failed to tailor resume');

  } catch (error) {
    console.error('Error tailoring resume:', error);
    return originalResume; // Return original if tailoring fails
  }
}

async function submitJobApplication(
  jobId: string,
  userId: string,
  jobListing: any,
  userProfile: any,
  coverLetter: string,
  resume: string,
  customData: Record<string, any>
): Promise<{ success: boolean; message: string; applicationId?: string }> {
  
  // TODO: Implement actual job application submission based on portal
  // This would involve:
  // 1. Portal-specific API calls (LinkedIn, Indeed, etc.)
  // 2. Form filling automation (for portals without APIs)
  // 3. File uploads (resume, cover letter)
  // 4. Application tracking
  
  // For demonstration, simulate the application process
  const applicationId = uuidv4();
  
  // Remove artificial delay - let actual processing determine timing
  
  // Mock success/failure based on job portal support
  const supportsAutoApply = jobListing.jobPortal?.supportsAutoApply;
  
  if (supportsAutoApply) {
    // Log successful application
    console.log(`Successfully applied to ${jobListing.title} at ${jobListing.company}`);
    return {
      success: true,
      message: 'Application submitted successfully',
      applicationId
    };
  } else {
    // Portal doesn't support auto-apply, prepare application files
    return {
      success: true,
      message: 'Application prepared for manual submission',
      applicationId
    };
  }
}

function createAutomationLog(
  action: AutomationLogEntry['action'],
  status: AutomationLogEntry['status'],
  message: string,
  details?: Record<string, any>
): AutomationLogEntry {
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    action,
    status,
    message,
    details
  };
}

async function handleJobApplication(request: NextRequest) {
  try {
    const body: ApplyToJobRequest = await request.json();
    const { jobId, customCoverLetter, customResume, applicationData } = body;
    
    // Extract session cookie and verify user authentication
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', timestamp: new Date().toISOString() } as ApiResponse<null>,
        { status: 401 }
      );
    }
    
    // Verify the session token
    const verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);
    
    if (!verificationResult.success || !verificationResult.decodedToken) {
      return NextResponse.json(
        { success: false, error: 'Invalid session', timestamp: new Date().toISOString() } as ApiResponse<null>,
        { status: 401 }
      );
    }
    
    const userId = verificationResult.decodedToken.uid;
    
    // Check if Auto Apply Azure feature is enabled for this user
    try {
      const isAutoApplyEnabled = await featureFlagsService.isAutoApplyAzureEnabled();
      
      if (!isAutoApplyEnabled) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Auto-apply feature is not available for your account', 
            timestamp: new Date().toISOString() 
          } as ApiResponse<null>,
          { status: 403 }
        );
      }
      
      // Log successful feature access for monitoring
      console.log(`Auto-apply feature accessed by user ${userId}`);
      
    } catch (featureFlagError) {
      // Log error for monitoring but don't block the feature if flags fail to load
      await errorBudgetMonitor.logAutoApplyAzureError(
        'Feature flag check failed',
        'medium',
        { userId, error: featureFlagError instanceof Error ? featureFlagError.message : 'Unknown error' }
      );
      
      console.warn('Feature flag check failed, proceeding with caution:', featureFlagError);
    }

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required', timestamp: new Date().toISOString() } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // TODO: In production, fetch these from database
    // Mock data for demonstration
    const jobListing = {
      id: jobId,
      title: 'Senior React Developer',
      company: 'TechFlow Solutions',
      description: 'Join our team to build next-generation web applications using React and TypeScript.',
      requirements: ['React', 'TypeScript', 'JavaScript'],
      jobPortal: {
        name: 'LinkedIn',
        supportsAutoApply: true
      }
    };

    const userProfile = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      skills: ['JavaScript', 'React', 'TypeScript', 'Node.js'],
      experience: [
        { position: 'Frontend Developer', company: 'Tech Corp', technologies: ['React', 'TypeScript'] }
      ],
      summary: 'Experienced frontend developer with expertise in React applications'
    };

    const automationLog: AutomationLogEntry[] = [];

    try {
      // Generate cover letter if not provided
      let coverLetter = customCoverLetter;
      if (!coverLetter) {
        automationLog.push(createAutomationLog(
          'application_submitted',
          'info',
          'Generating AI-powered cover letter'
        ));
        
        coverLetter = await generateCoverLetter(
          jobListing.title,
          jobListing.company,
          jobListing.description,
          userProfile
        );
      }

      // Tailor resume if not provided
      let resume = customResume;
      if (!resume) {
        automationLog.push(createAutomationLog(
          'application_submitted',
          'info',
          'Tailoring resume for job requirements'
        ));
        
        // TODO: Get user's base resume from profile
        const baseResume = 'Base resume content would be fetched from user profile';
        resume = await tailorResume(baseResume, jobListing.description);
      }

      // Submit the application
      automationLog.push(createAutomationLog(
        'application_submitted',
        'info',
        'Submitting application to job portal'
      ));

      const applicationResult = await submitJobApplication(
        jobId,
        userId,
        jobListing,
        userProfile,
        coverLetter,
        resume,
        applicationData || {}
      );

      if (applicationResult.success) {
        automationLog.push(createAutomationLog(
          'application_submitted',
          'success',
          applicationResult.message,
          { applicationId: applicationResult.applicationId }
        ));

        // Create job application record
        const jobApplication: JobApplication = {
          id: applicationResult.applicationId!,
          userId,
          jobId,
          status: 'applied',
          appliedAt: new Date().toISOString(),
          coverLetter,
          customResume: resume,
          applicationData: applicationData || {},
          automationLog,
          followUpReminders: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // TODO: Save to database in production
        console.log('Job application created:', jobApplication);

        const response: ApiResponse<JobApplication> = {
          success: true,
          data: jobApplication,
          message: 'Application submitted successfully',
          timestamp: new Date().toISOString()
        };

        return NextResponse.json(response);

      } else {
        automationLog.push(createAutomationLog(
          'error',
          'error',
          'Application submission failed',
          { error: applicationResult.message }
        ));

        return NextResponse.json(
          { 
            success: false, 
            error: applicationResult.message,
            data: { automationLog },
            timestamp: new Date().toISOString() 
          } as ApiResponse<any>,
          { status: 422 }
        );
      }

    } catch (processingError) {
      automationLog.push(createAutomationLog(
        'error',
        'error',
        'Error during application processing',
        { error: processingError instanceof Error ? processingError.message : 'Unknown error' }
      ));

      throw processingError;
    }

  } catch (error) {
    console.error('Job application error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error during application processing', 
        timestamp: new Date().toISOString() 
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

// POST handler without quota restrictions
export const POST = handleJobApplication;

// GET endpoint for retrieving application status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get('applicationId');
  const userId = searchParams.get('userId');

  if (!applicationId || !userId) {
    return NextResponse.json(
      { success: false, error: 'Application ID and User ID required', timestamp: new Date().toISOString() } as ApiResponse<null>,
      { status: 400 }
    );
  }

  // TODO: In production, retrieve application status from database
  // Mock response for demonstration
  const mockApplication: JobApplication = {
    id: applicationId,
    userId,
    jobId: 'mock-job-id',
    status: 'applied',
    appliedAt: new Date().toISOString(),
    applicationData: {},
    automationLog: [
      createAutomationLog('application_submitted', 'success', 'Application submitted successfully')
    ],
    followUpReminders: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return NextResponse.json({
    success: true,
    data: mockApplication,
    timestamp: new Date().toISOString()
  } as ApiResponse<JobApplication>);
}
