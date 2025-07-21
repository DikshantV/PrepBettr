import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { JobSearchRequest, JobListing, ApiResponse, JobSearchFilters } from '@/types/auto-apply';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

// Mock job data for demonstration
const mockJobs: JobListing[] = [
  {
    id: '1',
    title: 'Senior React Developer',
    company: 'TechFlow Solutions',
    location: 'San Francisco, CA',
    salary: {
      min: 130000,
      max: 170000,
      currency: 'USD',
      period: 'yearly'
    },
    jobType: 'full-time',
    workArrangement: 'hybrid',
    description: 'Join our growing team to build next-generation web applications using React, TypeScript, and modern development practices. You will lead frontend architecture decisions and mentor junior developers.',
    requirements: [
      '5+ years of React development experience',
      'Strong TypeScript skills',
      'Experience with Redux or similar state management',
      'Knowledge of modern CSS frameworks',
      'Experience with testing (Jest, React Testing Library)'
    ],
    responsibilities: [
      'Lead frontend architecture and design decisions',
      'Mentor and guide junior developers',
      'Collaborate with design and backend teams',
      'Code review and maintain high code quality standards',
      'Stay updated with latest React ecosystem trends'
    ],
    benefits: [
      'Health, dental, and vision insurance',
      'Flexible PTO policy',
      'Remote work options',
      '$2000 professional development budget'
    ],
    postedDate: '2024-01-15',
    jobPortal: {
      name: 'LinkedIn',
      logo: '/icons/linkedin.svg',
      website: 'https://linkedin.com',
      supportsAutoApply: true
    },
    originalUrl: 'https://linkedin.com/jobs/react-dev-123',
    relevancyScore: 92,
    matchedSkills: ['React', 'TypeScript', 'JavaScript', 'CSS'],
    missingSkills: ['Redux', 'Jest'],
    applicationStatus: 'discovered',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z'
  },
  {
    id: '2',
    title: 'Full Stack Engineer',
    company: 'InnovateCorp',
    location: 'Remote',
    salary: {
      min: 110000,
      max: 150000,
      currency: 'USD',
      period: 'yearly'
    },
    jobType: 'full-time',
    workArrangement: 'remote',
    description: 'We are looking for a versatile Full Stack Engineer to work on our SaaS platform. You will be responsible for both frontend and backend development using modern technologies.',
    requirements: [
      'Experience with React and Node.js',
      'Database design and optimization skills',
      'RESTful API development',
      'Cloud services experience (AWS/GCP)',
      'Agile development experience'
    ],
    responsibilities: [
      'Develop and maintain full-stack features',
      'Design and implement APIs',
      'Database schema design and optimization',
      'Deploy and monitor applications',
      'Participate in code reviews and technical discussions'
    ],
    postedDate: '2024-01-14',
    jobPortal: {
      name: 'Indeed',
      logo: '/icons/indeed.svg',
      website: 'https://indeed.com',
      supportsAutoApply: true
    },
    originalUrl: 'https://indeed.com/jobs/fullstack-456',
    relevancyScore: 88,
    matchedSkills: ['JavaScript', 'React', 'Node.js', 'AWS'],
    missingSkills: ['PostgreSQL', 'Docker'],
    applicationStatus: 'ready_to_apply',
    createdAt: '2024-01-14T10:30:00Z',
    updatedAt: '2024-01-14T10:30:00Z'
  },
  {
    id: '3',
    title: 'Frontend Developer',
    company: 'StartupXYZ',
    location: 'New York, NY',
    salary: {
      min: 90000,
      max: 120000,
      currency: 'USD',
      period: 'yearly'
    },
    jobType: 'full-time',
    workArrangement: 'onsite',
    description: 'Join our early-stage startup to build innovative web applications. Great opportunity to make a significant impact and grow with the company.',
    requirements: [
      '3+ years frontend development',
      'React or Vue.js experience',
      'Responsive web design',
      'Git version control',
      'Startup mentality and adaptability'
    ],
    responsibilities: [
      'Build responsive web applications',
      'Collaborate closely with designers',
      'Optimize application performance',
      'Implement new features and improvements',
      'Participate in product planning discussions'
    ],
    postedDate: '2024-01-13',
    jobPortal: {
      name: 'AngelList',
      logo: '/icons/angellist.svg',
      website: 'https://angel.co',
      supportsAutoApply: true
    },
    originalUrl: 'https://angel.co/jobs/frontend-789',
    relevancyScore: 76,
    matchedSkills: ['JavaScript', 'React', 'CSS'],
    missingSkills: ['Vue.js', 'Sass'],
    applicationStatus: 'discovered',
    createdAt: '2024-01-13T14:15:00Z',
    updatedAt: '2024-01-13T14:15:00Z'
  }
];

async function calculateJobRelevancy(jobListing: JobListing, userSkills: string[], targetRoles: string[]): Promise<number> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    const prompt = `
      Analyze the relevancy between this job posting and the candidate's profile:
      
      JOB TITLE: ${jobListing.title}
      JOB DESCRIPTION: ${jobListing.description}
      REQUIREMENTS: ${jobListing.requirements.join(', ')}
      
      CANDIDATE SKILLS: ${userSkills.join(', ')}
      TARGET ROLES: ${targetRoles.join(', ')}
      
      Calculate a relevancy score from 0-100 based on:
      1. Skills match (40% weight)
      2. Role alignment (30% weight) 
      3. Experience level match (20% weight)
      4. Job requirements match (10% weight)
      
      Return only a number between 0-100.
    `;

    const result = await model.generateContent(prompt);
    const scoreText = result.response.text().trim();
    const score = parseInt(scoreText);
    
    return isNaN(score) ? 50 : Math.max(0, Math.min(100, score));
  } catch (error) {
    console.error('Error calculating job relevancy:', error);
    // Fallback: Simple keyword matching
    const jobText = `${jobListing.title} ${jobListing.description} ${jobListing.requirements.join(' ')}`.toLowerCase();
    const matchedSkills = userSkills.filter(skill => jobText.includes(skill.toLowerCase()));
    return Math.min(90, (matchedSkills.length / userSkills.length) * 100);
  }
}

function filterJobs(jobs: JobListing[], filters: JobSearchFilters): JobListing[] {
  return jobs.filter(job => {
    // Keyword filtering
    if (filters.keywords.length > 0) {
      const jobText = `${job.title} ${job.description} ${job.requirements.join(' ')}`.toLowerCase();
      const hasKeyword = filters.keywords.some(keyword => 
        jobText.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    // Location filtering
    if (filters.locations.length > 0) {
      const hasLocation = filters.locations.some(location =>
        job.location.toLowerCase().includes(location.toLowerCase()) ||
        (location.toLowerCase() === 'remote' && job.workArrangement === 'remote')
      );
      if (!hasLocation) return false;
    }

    // Job type filtering
    if (filters.jobTypes.length > 0 && !filters.jobTypes.includes(job.jobType)) {
      return false;
    }

    // Work arrangement filtering
    if (filters.workArrangements.length > 0 && !filters.workArrangements.includes(job.workArrangement)) {
      return false;
    }

    // Date filtering
    const daysDiff = Math.ceil((new Date().getTime() - new Date(job.postedDate).getTime()) / (1000 * 60 * 60 * 24));
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

    // Relevancy score filtering
    if (job.relevancyScore && job.relevancyScore < filters.minimumRelevancyScore) {
      return false;
    }

    return true;
  });
}

export async function POST(request: NextRequest) {
  try {
    const body: JobSearchRequest = await request.json();
    const { userId, filters, limit = 20, offset = 0 } = body;

    // TODO: Add authentication check
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User authentication required', timestamp: new Date().toISOString() } as ApiResponse<null>,
        { status: 401 }
      );
    }

    // TODO: In production, implement actual job search across multiple portals
    // For now, filter mock data
    let filteredJobs = filterJobs(mockJobs, filters);

    // TODO: Get user profile for relevancy calculation
    const mockUserSkills = ['JavaScript', 'React', 'TypeScript', 'Node.js', 'Python'];
    const mockTargetRoles = ['Frontend Developer', 'Full Stack Developer', 'Software Engineer'];

    // Calculate relevancy scores for jobs that don't have them
    for (let job of filteredJobs) {
      if (!job.relevancyScore) {
        job.relevancyScore = await calculateJobRelevancy(job, mockUserSkills, mockTargetRoles);
      }
    }

    // Sort by relevancy score (highest first)
    filteredJobs.sort((a, b) => (b.relevancyScore || 0) - (a.relevancyScore || 0));

    // Apply pagination
    const paginatedJobs = filteredJobs.slice(offset, offset + limit);

    const response: ApiResponse<any> = {
      success: true,
      data: {
        jobs: paginatedJobs,
        totalCount: filteredJobs.length,
        filters,
        searchedAt: new Date().toISOString(),
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < filteredJobs.length
        }
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Job search error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error', 
        timestamp: new Date().toISOString() 
      } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Handle GET request for simple job retrieval
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'User ID required', timestamp: new Date().toISOString() } as ApiResponse<null>,
      { status: 400 }
    );
  }

  // Return default job listings
  const response: ApiResponse<any> = {
    success: true,
    data: {
      jobs: mockJobs,
      totalCount: mockJobs.length,
      searchedAt: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(response);
}
