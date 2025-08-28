import nock from 'nock';
import { TheirStackPortal } from '../portals/theirstack';
import { JobSearchFilters } from '../types/auto-apply';

// Mock Firestore admin
jest.mock('../lib/firebase/admin', () => ({
  getAdminFirestore: jest.fn(() => Promise.resolve({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            set: jest.fn(),
            get: jest.fn(() => Promise.resolve({
              exists: false,
              data: () => null
            }))
          }))
        }))
      }))
    })),
    FieldValue: {
      increment: jest.fn((value) => ({ _increment: value }))
    }
  }))
}));

describe('TheirStack Portal Integration', () => {
  let theirStackPortal: TheirStackPortal;
  const mockApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
  
  beforeAll(() => {
    // Set up environment
    process.env.THEIRSTACK_API_KEY = mockApiKey;
  });

  beforeEach(() => {
    theirStackPortal = new TheirStackPortal();
    nock.cleanAll();
  });

  afterAll(() => {
    delete process.env.THEIRSTACK_API_KEY;
    nock.cleanAll();
  });

  describe('Configuration', () => {
    it('should detect when TheirStack is properly configured', () => {
      expect(theirStackPortal.isConfigured()).toBe(true);
    });

    it('should detect when TheirStack is not configured', () => {
      delete process.env.THEIRSTACK_API_KEY;
      const portal = new TheirStackPortal();
      expect(portal.isConfigured()).toBe(false);
      process.env.THEIRSTACK_API_KEY = mockApiKey; // Restore
    });
  });

  describe('Job Search', () => {
    const mockUserId = 'test-user-123';
    const mockFilters: JobSearchFilters = {
      keywords: ['React', 'TypeScript'],
      locations: ['Remote', 'San Francisco'],
      jobTypes: ['full-time'],
      workArrangements: ['remote'],
      experienceLevel: ['mid-senior'],
      companySize: ['medium', 'large'],
      datePosted: 'past-week',
      portals: ['TheirStack'],
      minimumRelevancyScore: 70
    };

    const mockTheirStackResponse = {
      jobs: [
        {
          id: 'theirstack-job-1',
          title: 'Senior React Developer',
          company: {
            name: 'TechCorp',
            logo: 'https://example.com/logo.png',
            size: 'medium',
            location: 'San Francisco, CA'
          },
          location: 'San Francisco, CA (Remote OK)',
          salary: {
            min: 120000,
            max: 160000,
            currency: 'USD',
            period: 'yearly'
          },
          jobType: 'full-time',
          workArrangement: 'remote',
          description: 'We are looking for a skilled React developer to join our team.',
          requirements: ['React', 'TypeScript', 'JavaScript', 'Git'],
          responsibilities: ['Build UI components', 'Collaborate with designers'],
          benefits: ['Health insurance', 'Remote work', '401k'],
          postedDate: '2025-01-20T10:00:00Z',
          originalUrl: 'https://theirstack.com/jobs/theirstack-job-1'
        },
        {
          id: 'theirstack-job-2',
          title: 'Full Stack Engineer',
          company: {
            name: 'StartupXYZ',
            size: 'small',
            location: 'Remote'
          },
          location: 'Remote',
          jobType: 'full-time',
          workArrangement: 'remote',
          description: 'Join our growing team to build web applications.',
          requirements: ['React', 'Node.js', 'MongoDB'],
          responsibilities: ['Develop features', 'Code reviews'],
          postedDate: '2025-01-19T15:30:00Z',
          originalUrl: 'https://theirstack.com/jobs/theirstack-job-2'
        }
      ],
      totalCount: 2,
      page: 1,
      limit: 50,
      hasMore: false
    };

    it('should successfully search for jobs and transform them to JobListing format', async () => {
      // Mock the TheirStack API
      nock('https://api.theirstack.com')
        .post('/v1/jobs/search', {
          filters: {
            keywords: mockFilters.keywords,
            locations: mockFilters.locations,
            jobTypes: mockFilters.jobTypes,
            workArrangements: mockFilters.workArrangements,
            experienceLevel: mockFilters.experienceLevel,
            companySize: mockFilters.companySize,
            datePosted: mockFilters.datePosted
          },
          page: 1,
          limit: 50
        })
        .reply(200, mockTheirStackResponse);

      const result = await theirStackPortal.searchJobs(mockUserId, mockFilters);

      expect(result).toHaveLength(2);
      
      // Check first job transformation
      expect(result[0]).toMatchObject({
        id: 'theirstack-job-1',
        title: 'Senior React Developer',
        company: 'TechCorp',
        location: 'San Francisco, CA (Remote OK)',
        salary: {
          min: 120000,
          max: 160000,
          currency: 'USD',
          period: 'yearly'
        },
        jobType: 'full-time',
        workArrangement: 'remote',
        description: 'We are looking for a skilled React developer to join our team.',
        requirements: ['React', 'TypeScript', 'JavaScript', 'Git'],
        jobPortal: {
          name: 'TheirStack',
          logo: '/icons/theirstack.svg',
          website: 'https://theirstack.com',
          supportsAutoApply: true
        },
        applicationStatus: 'discovered'
      });

      // Check second job transformation
      expect(result[1]).toMatchObject({
        id: 'theirstack-job-2',
        title: 'Full Stack Engineer',
        company: 'StartupXYZ',
        location: 'Remote',
        jobType: 'full-time',
        workArrangement: 'remote'
      });
    });

    it('should handle API errors gracefully', async () => {
      nock('https://api.theirstack.com')
        .post('/v1/jobs/search')
        .reply(500, { error: 'Internal server error' });

      await expect(
        theirStackPortal.searchJobs(mockUserId, mockFilters)
      ).rejects.toThrow('TheirStack API error: 500 Internal Server Error');
    });

    it('should handle rate limiting errors', async () => {
      nock('https://api.theirstack.com')
        .post('/v1/jobs/search')
        .reply(429, { error: 'Too many requests' });

      await expect(
        theirStackPortal.searchJobs(mockUserId, mockFilters)
      ).rejects.toThrow('TheirStack API error: 429 Too Many Requests');
    });

    it('should throw error when API key is not configured', async () => {
      delete process.env.THEIRSTACK_API_KEY;
      const portal = new TheirStackPortal();

      await expect(
        portal.searchJobs(mockUserId, mockFilters)
      ).rejects.toThrow('TheirStack API key not configured');

      process.env.THEIRSTACK_API_KEY = mockApiKey; // Restore
    });
  });

  describe('Job Type Mapping', () => {
    it('should correctly map TheirStack job types to our format', () => {
      const portal = new TheirStackPortal();
      
      // Access private method through any cast for testing
      const mapJobType = (portal as any).mapJobTypeToOur.bind(portal);
      
      expect(mapJobType('full-time')).toBe('full-time');
      expect(mapJobType('fulltime')).toBe('full-time');
      expect(mapJobType('part-time')).toBe('part-time');
      expect(mapJobType('contract')).toBe('contract');
      expect(mapJobType('internship')).toBe('internship');
      expect(mapJobType('unknown')).toBe('full-time'); // default
    });
  });

  describe('Work Arrangement Mapping', () => {
    it('should correctly map TheirStack work arrangements to our format', () => {
      const portal = new TheirStackPortal();
      
      // Access private method through any cast for testing
      const mapWorkArrangement = (portal as any).mapWorkArrangementToOur.bind(portal);
      
      expect(mapWorkArrangement('remote')).toBe('remote');
      expect(mapWorkArrangement('hybrid')).toBe('hybrid');
      expect(mapWorkArrangement('onsite')).toBe('onsite');
      expect(mapWorkArrangement('on-site')).toBe('onsite');
      expect(mapWorkArrangement('office')).toBe('onsite');
      expect(mapWorkArrangement('unknown')).toBe('onsite'); // default
    });
  });

  describe('Credit Tracking', () => {
    it('should track credits when jobs are returned', async () => {
      const mockResponse = {
        jobs: [
          {
            id: 'test-1',
            title: 'Test Job 1',
            company: { name: 'Test Company' },
            location: 'Test Location',
            jobType: 'full-time',
            workArrangement: 'remote',
            description: 'Test description',
            requirements: [],
            responsibilities: [],
            postedDate: '2025-01-20T10:00:00Z',
            originalUrl: 'https://theirstack.com/jobs/test-1'
          },
          {
            id: 'test-2',
            title: 'Test Job 2',
            company: { name: 'Test Company' },
            location: 'Test Location',
            jobType: 'full-time',
            workArrangement: 'remote',
            description: 'Test description',
            requirements: [],
            responsibilities: [],
            postedDate: '2025-01-20T10:00:00Z',
            originalUrl: 'https://theirstack.com/jobs/test-2'
          },
          {
            id: 'test-3',
            title: 'Test Job 3',
            company: { name: 'Test Company' },
            location: 'Test Location',
            jobType: 'full-time',
            workArrangement: 'remote',
            description: 'Test description',
            requirements: [],
            responsibilities: [],
            postedDate: '2025-01-20T10:00:00Z',
            originalUrl: 'https://theirstack.com/jobs/test-3'
          }
        ],
        totalCount: 3,
        page: 1,
        limit: 50,
        hasMore: false
      };

      nock('https://api.theirstack.com')
        .post('/v1/jobs/search')
        .reply(200, mockResponse);

      // Create new mocks for this test
      const mockSet = jest.fn().mockResolvedValue(undefined);
      const mockGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ creditsUsed: 5 }) // Mock existing credits
      });
      
      // Setup Firestore mock properly
      const mockFirestore = {
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({
              doc: jest.fn(() => ({
                set: mockSet,
                get: mockGet
              }))
            }))
          }))
        })),
        FieldValue: {
          increment: jest.fn((value) => ({ _increment: value }))
        }
      };
      
      // Override the module mock for this test and ensure it's available immediately
      const { getAdminFirestore } = require('../lib/firebase/admin');
      (getAdminFirestore as jest.Mock).mockResolvedValue(mockFirestore);
      
      // Create a new portal instance to ensure fresh Firestore initialization
      const testPortal = new TheirStackPortal();
      
      // Wait a bit for async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Force the firestore property to be set (simulate successful initialization)
      (testPortal as any).firestore = mockFirestore;

      const result = await testPortal.searchJobs('test-user', {
        keywords: ['test'],
        locations: [],
        jobTypes: [],
        workArrangements: [],
        experienceLevel: [],
        companySize: [],
        datePosted: 'any',
        portals: [],
        minimumRelevancyScore: 0
      });

      expect(result).toHaveLength(3);
      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when API is accessible', async () => {
      nock('https://api.theirstack.com')
        .get('/v1/health')
        .reply(200, { status: 'ok' });

      const health = await theirStackPortal.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.message).toBe('TheirStack API accessible');
    });

    it('should return unhealthy status when API is not accessible', async () => {
      nock('https://api.theirstack.com')
        .get('/v1/health')
        .reply(500);

      const health = await theirStackPortal.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.message).toContain('HTTP 500');
    });

    it('should return unhealthy status when API key is not configured', async () => {
      delete process.env.THEIRSTACK_API_KEY;
      const portal = new TheirStackPortal();
      
      const health = await portal.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.message).toBe('TheirStack API key not configured');
      
      process.env.THEIRSTACK_API_KEY = mockApiKey; // Restore
    });
  });
});

describe('TheirStack Credits Service Integration', () => {
  beforeAll(() => {
    process.env.THEIRSTACK_API_KEY = 'test-key';
  });

  afterAll(() => {
    delete process.env.THEIRSTACK_API_KEY;
  });

  it('should be importable', () => {
    const { getCurrentTheirStackCredits, getTheirStackCreditsSummary } = require('../lib/services/theirstack-credits');
    
    expect(typeof getCurrentTheirStackCredits).toBe('function');
    expect(typeof getTheirStackCreditsSummary).toBe('function');
  });
});
