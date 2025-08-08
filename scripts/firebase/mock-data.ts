/**
 * Mock data for seeding Firestore collections
 * This file contains sample data for all auto-apply related collections
 */

import { 
  UserProfile, 
  AutoApplySettings, 
  JobListing, 
  JobApplication, 
  AutomationLogEntry,
  JOB_PORTALS 
} from '@/types/auto-apply';

// Mock Users Data
export const mockUsers: Record<string, UserProfile> = {
  'user_123': {
    id: 'user_123',
    email: 'john.doe@example.com',
    name: 'John Doe',
    phone: '+1-555-0123',
    location: 'San Francisco, CA',
    portfolio: 'https://johndoe.dev',
    linkedinUrl: 'https://linkedin.com/in/johndoe',
    githubUrl: 'https://github.com/johndoe',
    skills: [
      'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python',
      'AWS', 'Docker', 'PostgreSQL', 'MongoDB', 'GraphQL',
      'REST APIs', 'Git', 'Agile', 'TDD', 'System Design'
    ],
    experience: [
      {
        id: 'exp_1',
        company: 'Tech Innovators Inc.',
        position: 'Senior Full Stack Developer',
        startDate: '2022-01-15',
        endDate: undefined,
        isCurrent: true,
        description: 'Leading development of microservices architecture and frontend applications using React and Node.js.',
        achievements: [
          'Reduced API response times by 40% through optimization',
          'Led a team of 4 developers on critical product features',
          'Implemented CI/CD pipeline reducing deployment time by 60%'
        ],
        technologies: ['React', 'Node.js', 'TypeScript', 'AWS', 'Docker'],
        location: 'San Francisco, CA'
      },
      {
        id: 'exp_2',
        company: 'Digital Solutions Ltd.',
        position: 'Frontend Developer',
        startDate: '2019-06-01',
        endDate: '2021-12-31',
        isCurrent: false,
        description: 'Developed responsive web applications and improved user experience across multiple products.',
        achievements: [
          'Increased user engagement by 25% through UI/UX improvements',
          'Built reusable component library used across 5 projects',
          'Mentored 2 junior developers'
        ],
        technologies: ['React', 'JavaScript', 'CSS', 'Redux', 'Jest'],
        location: 'Remote'
      }
    ],
    education: [
      {
        id: 'edu_1',
        institution: 'University of California, Berkeley',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        startDate: '2015-08-15',
        endDate: '2019-05-15',
        gpa: 3.8,
        achievements: ['Dean\'s List', 'CS Honor Society']
      }
    ],
    summary: 'Experienced full-stack developer with 5+ years of experience building scalable web applications. Passionate about clean code, system architecture, and mentoring junior developers.',
    targetRoles: [
      'Senior Full Stack Developer',
      'Lead Frontend Developer',
      'Software Engineer',
      'Principal Developer'
    ],
    salaryRange: {
      min: 130000,
      max: 180000,
      currency: 'USD'
    },
    workPreferences: {
      remote: true,
      hybrid: true,
      onsite: false,
      locations: ['San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Remote']
    },
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z'
  },
  'user_456': {
    id: 'user_456',
    email: 'sarah.johnson@example.com',
    name: 'Sarah Johnson',
    phone: '+1-555-0456',
    location: 'Austin, TX',
    portfolio: 'https://sarah-dev.com',
    linkedinUrl: 'https://linkedin.com/in/sarahjohnson',
    githubUrl: 'https://github.com/sarahj',
    skills: [
      'React', 'Vue.js', 'JavaScript', 'TypeScript', 'CSS',
      'HTML', 'Node.js', 'Express', 'MongoDB', 'Firebase',
      'Figma', 'Adobe XD', 'Responsive Design', 'Accessibility'
    ],
    experience: [
      {
        id: 'exp_1',
        company: 'Creative Tech Studios',
        position: 'Frontend Developer',
        startDate: '2021-03-01',
        endDate: undefined,
        isCurrent: true,
        description: 'Developing user interfaces for web applications with focus on accessibility and performance.',
        achievements: [
          'Improved page load times by 35% through optimization',
          'Implemented comprehensive accessibility features',
          'Created design system used across 3 product lines'
        ],
        technologies: ['Vue.js', 'JavaScript', 'CSS', 'Node.js', 'Firebase'],
        location: 'Austin, TX'
      }
    ],
    education: [
      {
        id: 'edu_1',
        institution: 'University of Texas at Austin',
        degree: 'Bachelor of Arts',
        fieldOfStudy: 'Digital Media',
        startDate: '2017-08-15',
        endDate: '2021-05-15',
        gpa: 3.6
      }
    ],
    summary: 'Frontend developer specializing in modern JavaScript frameworks and accessible web design. Passionate about creating inclusive user experiences.',
    targetRoles: [
      'Frontend Developer',
      'UI/UX Developer',
      'JavaScript Developer',
      'React Developer'
    ],
    salaryRange: {
      min: 85000,
      max: 120000,
      currency: 'USD'
    },
    workPreferences: {
      remote: true,
      hybrid: true,
      onsite: true,
      locations: ['Austin, TX', 'Dallas, TX', 'Remote']
    },
    createdAt: '2024-01-05T09:15:00Z',
    updatedAt: '2024-01-18T14:20:00Z'
  }
};

// Mock Auto Apply Settings
export const mockAutoApplySettings: Record<string, AutoApplySettings> = {
  'user_123': {
    userId: 'user_123',
    isEnabled: true,
    filters: {
      keywords: ['React', 'Full Stack', 'Senior Developer', 'JavaScript', 'TypeScript'],
      locations: ['San Francisco', 'Remote', 'New York'],
      jobTypes: ['full-time'],
      workArrangements: ['remote', 'hybrid'],
      salaryRange: {
        min: 130000,
        max: 180000,
        currency: 'USD'
      },
      experienceLevel: ['mid-senior', 'director'],
      companySize: ['medium', 'large', 'enterprise'],
      datePosted: 'past-week',
      portals: ['LinkedIn', 'Indeed', 'AngelList'],
      minimumRelevancyScore: 75
    },
    autoApplyThreshold: 85,
    dailyApplicationLimit: 5,
    useCustomCoverLetter: true,
    coverLetterTemplate: 'Dear Hiring Manager,\n\nI am excited to apply for the {position} role at {company}. With my {years} years of experience in {primarySkills}, I am confident I can contribute to your team...',
    useCustomResume: false,
    followUpEnabled: true,
    followUpSchedule: {
      initialDays: 7,
      secondDays: 14
    },
    notifications: {
      email: true,
      newJobsFound: true,
      applicationsSubmitted: true,
      followUpReminders: true,
      errorAlerts: true
    },
    blacklistedCompanies: ['BadCorp Inc.', 'Toxic Workplace LLC'],
    preferredCompanies: ['Google', 'Apple', 'Microsoft', 'Netflix'],
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z'
  },
  'user_456': {
    userId: 'user_456',
    isEnabled: false,
    filters: {
      keywords: ['Frontend', 'React', 'Vue.js', 'JavaScript', 'UI/UX'],
      locations: ['Austin', 'Dallas', 'Remote'],
      jobTypes: ['full-time', 'contract'],
      workArrangements: ['remote', 'hybrid', 'onsite'],
      salaryRange: {
        min: 85000,
        max: 120000,
        currency: 'USD'
      },
      experienceLevel: ['associate', 'mid-senior'],
      companySize: ['startup', 'small', 'medium'],
      datePosted: 'past-month',
      portals: ['LinkedIn', 'Indeed', 'AngelList'],
      minimumRelevancyScore: 70
    },
    autoApplyThreshold: 80,
    dailyApplicationLimit: 3,
    useCustomCoverLetter: false,
    useCustomResume: false,
    followUpEnabled: false,
    followUpSchedule: {
      initialDays: 5,
      secondDays: 10
    },
    notifications: {
      email: false,
      newJobsFound: false,
      applicationsSubmitted: false,
      followUpReminders: false,
      errorAlerts: true
    },
    blacklistedCompanies: [],
    preferredCompanies: ['Shopify', 'Airbnb', 'Stripe'],
    createdAt: '2024-01-05T09:15:00Z',
    updatedAt: '2024-01-18T14:20:00Z'
  }
};

// Mock Job Listings
export const mockJobListings: JobListing[] = [
  {
    id: 'job_1',
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
    jobPortal: JOB_PORTALS[0], // LinkedIn
    originalUrl: 'https://linkedin.com/jobs/react-dev-123',
    relevancyScore: 92,
    matchedSkills: ['React', 'TypeScript', 'JavaScript', 'CSS'],
    missingSkills: ['Redux', 'Jest'],
    applicationStatus: 'discovered',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z'
  },
  {
    id: 'job_2',
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
    jobPortal: JOB_PORTALS[1], // Indeed
    originalUrl: 'https://indeed.com/jobs/fullstack-456',
    relevancyScore: 88,
    matchedSkills: ['JavaScript', 'React', 'Node.js', 'AWS'],
    missingSkills: ['PostgreSQL', 'Docker'],
    applicationStatus: 'ready_to_apply',
    createdAt: '2024-01-14T10:30:00Z',
    updatedAt: '2024-01-14T10:30:00Z'
  },
  {
    id: 'job_3',
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
    jobPortal: JOB_PORTALS[3], // AngelList
    originalUrl: 'https://angel.co/jobs/frontend-789',
    relevancyScore: 76,
    matchedSkills: ['JavaScript', 'React', 'CSS'],
    missingSkills: ['Vue.js', 'Sass'],
    applicationStatus: 'discovered',
    createdAt: '2024-01-13T14:15:00Z',
    updatedAt: '2024-01-13T14:15:00Z'
  },
  {
    id: 'job_4',
    title: 'Senior Frontend Engineer',
    company: 'GrowthTech Inc.',
    location: 'Austin, TX',
    salary: {
      min: 105000,
      max: 135000,
      currency: 'USD',
      period: 'yearly'
    },
    jobType: 'full-time',
    workArrangement: 'hybrid',
    description: 'Looking for an experienced frontend engineer to help scale our platform. Work with cutting-edge technologies and collaborate with a talented team.',
    requirements: [
      '4+ years frontend development experience',
      'Proficiency in Vue.js or React',
      'Experience with modern build tools',
      'Understanding of web accessibility',
      'Strong communication skills'
    ],
    responsibilities: [
      'Develop new user-facing features',
      'Ensure technical feasibility of UI/UX designs',
      'Optimize applications for maximum speed and scalability',
      'Collaborate with product managers and designers',
      'Write clean, maintainable code'
    ],
    postedDate: '2024-01-16',
    jobPortal: JOB_PORTALS[1], // Indeed
    originalUrl: 'https://indeed.com/jobs/senior-frontend-890',
    relevancyScore: 84,
    matchedSkills: ['JavaScript', 'Vue.js', 'CSS', 'HTML'],
    missingSkills: ['Webpack', 'TypeScript'],
    applicationStatus: 'analyzing',
    createdAt: '2024-01-16T09:45:00Z',
    updatedAt: '2024-01-16T09:45:00Z'
  }
];

// Mock Applications
export const mockApplications: JobApplication[] = [
  {
    id: 'app_1',
    userId: 'user_123',
    jobId: 'job_2',
    status: 'applied',
    appliedAt: '2024-01-14T15:30:00Z',
    coverLetter: 'Dear InnovateCorp Hiring Team,\n\nI am excited to apply for the Full Stack Engineer position...',
    customResume: undefined,
    applicationData: {
      portal: 'Indeed',
      applicationMethod: 'auto',
      questionsAnswered: true
    },
    automationLog: [
      {
        id: 'log_1',
        timestamp: '2024-01-14T15:25:00Z',
        action: 'relevancy_calculated',
        status: 'success',
        message: 'Job relevancy calculated at 88%',
        details: { score: 88, matchedSkills: ['JavaScript', 'React', 'Node.js', 'AWS'] }
      },
      {
        id: 'log_2',
        timestamp: '2024-01-14T15:28:00Z',
        action: 'application_submitted',
        status: 'success',
        message: 'Application successfully submitted to Indeed',
        details: { applicationId: 'indeed_12345' }
      }
    ],
    followUpReminders: [
      {
        id: 'remind_1',
        scheduledDate: '2024-01-21T15:30:00Z',
        type: 'initial_follow_up',
        sent: false
      }
    ],
    createdAt: '2024-01-14T15:20:00Z',
    updatedAt: '2024-01-14T15:30:00Z'
  },
  {
    id: 'app_2',
    userId: 'user_123',
    jobId: 'job_1',
    status: 'analyzing',
    appliedAt: undefined,
    coverLetter: undefined,
    customResume: undefined,
    applicationData: {},
    automationLog: [
      {
        id: 'log_3',
        timestamp: '2024-01-15T08:05:00Z',
        action: 'job_discovered',
        status: 'success',
        message: 'New job discovered matching user criteria',
        details: { jobTitle: 'Senior React Developer', company: 'TechFlow Solutions' }
      }
    ],
    followUpReminders: [],
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:05:00Z'
  },
  {
    id: 'app_3',
    userId: 'user_456',
    jobId: 'job_4',
    status: 'ready_to_apply',
    appliedAt: undefined,
    coverLetter: undefined,
    customResume: undefined,
    applicationData: {},
    automationLog: [
      {
        id: 'log_4',
        timestamp: '2024-01-16T10:00:00Z',
        action: 'relevancy_calculated',
        status: 'success',
        message: 'Job relevancy calculated at 84%',
        details: { score: 84, matchedSkills: ['JavaScript', 'Vue.js', 'CSS', 'HTML'] }
      }
    ],
    followUpReminders: [],
    createdAt: '2024-01-16T09:50:00Z',
    updatedAt: '2024-01-16T10:00:00Z'
  }
];

// Mock Automation Logs
export const mockAutomationLogs: AutomationLogEntry[] = [
  {
    id: 'log_1',
    timestamp: '2024-01-15T08:00:00Z',
    action: 'job_discovered',
    status: 'success',
    message: 'Job search executed for user_123',
    details: {
      userId: 'user_123',
      searchFilters: { keywords: ['React', 'Full Stack'], locations: ['San Francisco'] },
      jobsFound: 5,
      executionTime: 2340
    }
  },
  {
    id: 'log_2',
    timestamp: '2024-01-15T08:05:00Z',
    action: 'job_discovered',
    status: 'success',
    message: 'New job discovered: Senior React Developer at TechFlow Solutions',
    details: {
      userId: 'user_123',
      jobId: 'job_1',
      jobTitle: 'Senior React Developer',
      company: 'TechFlow Solutions',
      portal: 'LinkedIn'
    }
  },
  {
    id: 'log_3',
    timestamp: '2024-01-14T15:25:00Z',
    action: 'relevancy_calculated',
    status: 'success',
    message: 'Relevancy analysis completed for job_2',
    details: {
      userId: 'user_123',
      jobId: 'job_2',
      relevancyScore: 88,
      matchedSkills: ['JavaScript', 'React', 'Node.js', 'AWS'],
      missingSkills: ['PostgreSQL', 'Docker'],
      executionTime: 1850
    }
  },
  {
    id: 'log_4',
    timestamp: '2024-01-14T15:28:00Z',
    action: 'relevancy_calculated',
    status: 'success',
    message: 'Cover letter generated for Full Stack Engineer position',
    details: {
      userId: 'user_123',
      jobId: 'job_2',
      wordCount: 245,
      executionTime: 890
    }
  },
  {
    id: 'log_5',
    timestamp: '2024-01-14T15:30:00Z',
    action: 'application_submitted',
    status: 'success',
    message: 'Application successfully submitted to Indeed',
    details: {
      userId: 'user_123',
      jobId: 'job_2',
      applicationId: 'app_1',
      portal: 'Indeed',
      submissionMethod: 'auto',
      executionTime: 3200
    }
  },
  {
    id: 'log_6',
    timestamp: '2024-01-13T16:45:00Z',
    action: 'error',
    status: 'error',
    message: 'Failed to submit application due to portal timeout',
    details: {
      userId: 'user_123',
      jobId: 'job_3',
      errorCode: 'TIMEOUT',
      portal: 'AngelList',
      retryAttempt: 3,
      executionTime: 30000
    }
  }
];

// Statistics for dashboard
export const mockDashboardStats = {
  user_123: {
    totalApplications: 12,
    pendingApplications: 5,
    interviewRequests: 2,
    averageRelevancyScore: 82,
    applicationsByStatus: {
      'discovered': 3,
      'analyzing': 1,
      'ready_to_apply': 1,
      'applying': 0,
      'applied': 6,
      'application_viewed': 2,
      'interview_request': 2,
      'rejected': 1,
      'withdrawn': 0,
      'expired': 0
    },
    applicationsByPortal: {
      'LinkedIn': 5,
      'Indeed': 4,
      'AngelList': 2,
      'Glassdoor': 1
    },
    applicationTrends: [
      { date: '2024-01-08', applications: 2, responses: 0 },
      { date: '2024-01-09', applications: 1, responses: 1 },
      { date: '2024-01-10', applications: 3, responses: 0 },
      { date: '2024-01-11', applications: 2, responses: 1 },
      { date: '2024-01-12', applications: 1, responses: 0 },
      { date: '2024-01-13', applications: 2, responses: 2 },
      { date: '2024-01-14', applications: 1, responses: 1 }
    ]
  },
  user_456: {
    totalApplications: 3,
    pendingApplications: 2,
    interviewRequests: 0,
    averageRelevancyScore: 78,
    applicationsByStatus: {
      'discovered': 1,
      'analyzing': 0,
      'ready_to_apply': 1,
      'applying': 0,
      'applied': 1,
      'application_viewed': 0,
      'interview_request': 0,
      'rejected': 0,
      'withdrawn': 0,
      'expired': 0
    },
    applicationsByPortal: {
      'LinkedIn': 1,
      'Indeed': 2,
      'AngelList': 0,
      'Glassdoor': 0
    },
    applicationTrends: [
      { date: '2024-01-14', applications: 1, responses: 0 },
      { date: '2024-01-15', applications: 1, responses: 0 },
      { date: '2024-01-16', applications: 1, responses: 0 }
    ]
  }
};

// Export all mock data
export default {
  users: mockUsers,
  autoApplySettings: mockAutoApplySettings,
  jobListings: mockJobListings,
  applications: mockApplications,
  automationLogs: mockAutomationLogs,
  dashboardStats: mockDashboardStats
};
