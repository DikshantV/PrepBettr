import { FirebaseService, InterviewData, ResumeData } from '../firebase.service';

// Mock Firebase Admin SDK for testing
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  cert: jest.fn(),
}));

jest.mock('firebase-admin/firestore', () => {
  const mockDoc = {
    id: 'mock-doc-id',
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockCollection = {
    doc: jest.fn(() => mockDoc),
    where: jest.fn(() => ({
      orderBy: jest.fn(() => ({
        get: jest.fn(),
      })),
    })),
  };

  const mockFirestore = {
    collection: jest.fn(() => mockCollection),
    runTransaction: jest.fn(),
    batch: jest.fn(() => ({
      delete: jest.fn(),
      commit: jest.fn(),
    })),
  };

  return {
    getFirestore: jest.fn(() => mockFirestore),
  };
});

jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn(() => ({})),
}));

describe('FirebaseService', () => {
  let firebaseService: FirebaseService;
  let mockFirestore: any;
  let mockDoc: any;
  let mockCollection: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set test environment
    process.env.NODE_ENV = 'test';
    
    // Get mocked instances
    const { getFirestore } = require('firebase-admin/firestore');
    mockFirestore = getFirestore();
    mockCollection = mockFirestore.collection();
    mockDoc = mockCollection.doc();
    
    // Initialize service
    firebaseService = new FirebaseService();
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  describe('Interview Operations', () => {
    const mockInterviewData = {
      userId: 'user-123',
      jobTitle: 'Software Engineer',
      company: 'Tech Corp',
      questions: [
        {
          question: 'What is React?',
          category: 'technical',
          difficulty: 'medium' as const,
        },
      ],
      finalized: false,
    };

    describe('createInterview', () => {
      it('should create a new interview document', async () => {
        mockDoc.set.mockResolvedValue(undefined);

        const result = await firebaseService.createInterview(mockInterviewData);

        expect(mockFirestore.collection).toHaveBeenCalledWith('interviews');
        expect(mockCollection.doc).toHaveBeenCalled();
        expect(mockDoc.set).toHaveBeenCalledWith(expect.objectContaining({
          ...mockInterviewData,
          id: 'mock-doc-id',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }));
        expect(result).toBe('mock-doc-id');
      });

      it('should throw error if database write fails', async () => {
        const error = new Error('Database write failed');
        mockDoc.set.mockRejectedValue(error);

        await expect(firebaseService.createInterview(mockInterviewData))
          .rejects.toThrow('Database write failed');
      });
    });

    describe('getInterview', () => {
      it('should return interview data for the owner', async () => {
        const interviewData = {
          ...mockInterviewData,
          id: 'interview-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          data: () => interviewData,
        });

        const result = await firebaseService.getInterview('interview-123', 'user-123');

        expect(mockFirestore.collection).toHaveBeenCalledWith('interviews');
        expect(mockCollection.doc).toHaveBeenCalledWith('interview-123');
        expect(result).toEqual(interviewData);
      });

      it('should return interview data if finalized (for non-owners)', async () => {
        const interviewData = {
          ...mockInterviewData,
          id: 'interview-123',
          userId: 'other-user',
          finalized: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          data: () => interviewData,
        });

        const result = await firebaseService.getInterview('interview-123', 'user-123');

        expect(result).toEqual(interviewData);
      });

      it('should throw error for private interview access by non-owner', async () => {
        const interviewData = {
          ...mockInterviewData,
          id: 'interview-123',
          userId: 'other-user',
          finalized: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          data: () => interviewData,
        });

        await expect(firebaseService.getInterview('interview-123', 'user-123'))
          .rejects.toThrow('Access denied: Interview is private');
      });

      it('should return null for non-existent interview', async () => {
        mockDoc.get.mockResolvedValue({
          exists: false,
        });

        const result = await firebaseService.getInterview('non-existent', 'user-123');

        expect(result).toBeNull();
      });
    });

    describe('updateInterview', () => {
      it('should update interview for owner', async () => {
        const existingData = {
          ...mockInterviewData,
          id: 'interview-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          data: () => existingData,
        });
        mockDoc.update.mockResolvedValue(undefined);

        const updates = { finalized: true };
        await firebaseService.updateInterview('interview-123', 'user-123', updates);

        expect(mockDoc.update).toHaveBeenCalledWith({
          ...updates,
          updatedAt: expect.any(Date),
        });
      });

      it('should throw error for non-existent interview', async () => {
        mockDoc.get.mockResolvedValue({
          exists: false,
        });

        await expect(firebaseService.updateInterview('non-existent', 'user-123', {}))
          .rejects.toThrow('Interview not found');
      });

      it('should throw error for non-owner access', async () => {
        const existingData = {
          ...mockInterviewData,
          id: 'interview-123',
          userId: 'other-user',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          data: () => existingData,
        });

        await expect(firebaseService.updateInterview('interview-123', 'user-123', {}))
          .rejects.toThrow('Access denied: Not interview owner');
      });
    });

    describe('getUserInterviews', () => {
      it('should return user interviews ordered by creation date', async () => {
        const interviews = [
          { ...mockInterviewData, id: 'int-1', createdAt: new Date() },
          { ...mockInterviewData, id: 'int-2', createdAt: new Date() },
        ];

        const mockSnapshot = {
          docs: interviews.map(interview => ({
            data: () => interview,
          })),
        };

        const mockQuery = {
          get: jest.fn().mockResolvedValue(mockSnapshot),
        };

        const mockOrderBy = {
          orderBy: jest.fn(() => mockQuery),
        };

        const mockWhere = {
          where: jest.fn(() => mockOrderBy),
        };

        mockCollection.where.mockReturnValue(mockWhere);

        const result = await firebaseService.getUserInterviews('user-123');

        expect(mockCollection.where).toHaveBeenCalledWith('userId', '==', 'user-123');
        expect(mockWhere.where().orderBy).toHaveBeenCalledWith('createdAt', 'desc');
        expect(result).toEqual(interviews);
      });
    });

    describe('deleteInterview', () => {
      it('should delete interview for owner', async () => {
        const existingData = {
          ...mockInterviewData,
          id: 'interview-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          data: () => existingData,
        });
        mockDoc.delete.mockResolvedValue(undefined);

        await firebaseService.deleteInterview('interview-123', 'user-123');

        expect(mockDoc.delete).toHaveBeenCalled();
      });

      it('should throw error for non-owner deletion attempt', async () => {
        const existingData = {
          ...mockInterviewData,
          id: 'interview-123',
          userId: 'other-user',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          data: () => existingData,
        });

        await expect(firebaseService.deleteInterview('interview-123', 'user-123'))
          .rejects.toThrow('Access denied: Not interview owner');
      });
    });
  });

  describe('Resume Operations', () => {
    const mockResumeData = {
      userId: 'user-123',
      fileName: 'resume.pdf',
      fileUrl: 'https://storage.example.com/resumes/resume.pdf',
      extractedText: 'Software Engineer with 5 years experience...',
      parsedSections: {
        summary: 'Experienced developer',
        skills: ['JavaScript', 'React', 'Node.js'],
      },
    };

    describe('createResume', () => {
      it('should create a new resume document', async () => {
        mockDoc.set.mockResolvedValue(undefined);

        const result = await firebaseService.createResume(mockResumeData);

        expect(mockFirestore.collection).toHaveBeenCalledWith('resumes');
        expect(mockDoc.set).toHaveBeenCalledWith(expect.objectContaining({
          ...mockResumeData,
          id: 'mock-doc-id',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }));
        expect(result).toBe('mock-doc-id');
      });
    });

    describe('getResume', () => {
      it('should return resume data for the owner', async () => {
        const resumeData = {
          ...mockResumeData,
          id: 'resume-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          data: () => resumeData,
        });

        const result = await firebaseService.getResume('resume-123', 'user-123');

        expect(result).toEqual(resumeData);
      });

      it('should throw error for non-owner access', async () => {
        const resumeData = {
          ...mockResumeData,
          id: 'resume-123',
          userId: 'other-user',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          data: () => resumeData,
        });

        await expect(firebaseService.getResume('resume-123', 'user-123'))
          .rejects.toThrow('Access denied: Not resume owner');
      });
    });
  });

  describe('Usage Tracking', () => {
    const mockUsageData = {
      userId: 'user-123',
      interviews: { count: 2, limit: 5 },
      resumes: { count: 1, limit: 3 },
      updatedAt: new Date(),
    };

    describe('getUserUsage', () => {
      it('should return user usage data', async () => {
        mockDoc.get.mockResolvedValue({
          exists: true,
          data: () => mockUsageData,
        });

        const result = await firebaseService.getUserUsage('user-123');

        expect(mockFirestore.collection).toHaveBeenCalledWith('usage');
        expect(mockCollection.doc).toHaveBeenCalledWith('user-123');
        expect(result).toEqual(mockUsageData);
      });

      it('should return null for non-existent usage data', async () => {
        mockDoc.get.mockResolvedValue({
          exists: false,
        });

        const result = await firebaseService.getUserUsage('user-123');

        expect(result).toBeNull();
      });
    });

    describe('initializeUserUsage', () => {
      it('should create initial usage document for user', async () => {
        mockDoc.set.mockResolvedValue(undefined);

        await firebaseService.initializeUserUsage('user-123');

        expect(mockDoc.set).toHaveBeenCalledWith(expect.objectContaining({
          userId: 'user-123',
          interviews: { count: 0, limit: 5 },
          resumes: { count: 0, limit: 3 },
          updatedAt: expect.any(Date),
        }));
      });
    });

    describe('incrementUsage', () => {
      it('should increment usage count using transaction', async () => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => mockUsageData,
          }),
          update: jest.fn(),
        };

        mockFirestore.runTransaction.mockImplementation(async (callback) => {
          return await callback(mockTransaction);
        });

        await firebaseService.incrementUsage('user-123', 'interviews');

        expect(mockFirestore.runTransaction).toHaveBeenCalled();
        expect(mockTransaction.update).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            interviews: { count: 3, limit: 5 },
            updatedAt: expect.any(Date),
          })
        );
      });

      it('should throw error if usage document not found', async () => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: false,
          }),
          update: jest.fn(),
        };

        mockFirestore.runTransaction.mockImplementation(async (callback) => {
          return await callback(mockTransaction);
        });

        await expect(firebaseService.incrementUsage('user-123', 'interviews'))
          .rejects.toThrow('Usage document not found');
      });
    });

    describe('checkUsageLimit', () => {
      it('should return true when under limit', async () => {
        mockDoc.get.mockResolvedValue({
          exists: true,
          data: () => mockUsageData,
        });

        const result = await firebaseService.checkUsageLimit('user-123', 'interviews');

        expect(result).toBe(true);
      });

      it('should return false when at limit', async () => {
        const atLimitUsage = {
          ...mockUsageData,
          interviews: { count: 5, limit: 5 },
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          data: () => atLimitUsage,
        });

        const result = await firebaseService.checkUsageLimit('user-123', 'interviews');

        expect(result).toBe(false);
      });

      it('should initialize usage and return true if no usage document exists', async () => {
        mockDoc.get.mockResolvedValue({
          exists: false,
        });
        mockDoc.set.mockResolvedValue(undefined);

        const result = await firebaseService.checkUsageLimit('user-123', 'interviews');

        expect(mockDoc.set).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });
  });

  describe('User Operations', () => {
    describe('createUser', () => {
      it('should create user document and initialize usage', async () => {
        mockDoc.set.mockResolvedValue(undefined);

        const userData = {
          email: 'test@example.com',
          displayName: 'Test User',
        };

        await firebaseService.createUser('user-123', userData);

        expect(mockDoc.set).toHaveBeenCalledTimes(2); // User doc + usage doc
        expect(mockDoc.set).toHaveBeenCalledWith(expect.objectContaining({
          ...userData,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }));
      });
    });

    describe('getUser', () => {
      it('should return user data if exists', async () => {
        const userData = {
          email: 'test@example.com',
          displayName: 'Test User',
          createdAt: new Date(),
        };

        mockDoc.get.mockResolvedValue({
          exists: true,
          data: () => userData,
        });

        const result = await firebaseService.getUser('user-123');

        expect(result).toEqual(userData);
      });

      it('should return null if user does not exist', async () => {
        mockDoc.get.mockResolvedValue({
          exists: false,
        });

        const result = await firebaseService.getUser('user-123');

        expect(result).toBeNull();
      });
    });
  });

  describe('Batch Operations', () => {
    describe('batchDelete', () => {
      it('should delete multiple documents in a batch', async () => {
        const mockBatch = {
          delete: jest.fn(),
          commit: jest.fn().mockResolvedValue(undefined),
        };

        mockFirestore.batch.mockReturnValue(mockBatch);

        const docIds = ['doc1', 'doc2', 'doc3'];
        await firebaseService.batchDelete('interviews', docIds);

        expect(mockBatch.delete).toHaveBeenCalledTimes(3);
        expect(mockBatch.commit).toHaveBeenCalled();
      });
    });
  });

  describe('Health Check', () => {
    describe('healthCheck', () => {
      it('should return healthy status on successful operations', async () => {
        mockDoc.set.mockResolvedValue(undefined);
        mockDoc.get.mockResolvedValue({});
        mockDoc.delete.mockResolvedValue(undefined);

        const result = await firebaseService.healthCheck();

        expect(result.status).toBe('healthy');
        expect(result.timestamp).toBeInstanceOf(Date);
      });

      it('should return unhealthy status on operation failure', async () => {
        const error = new Error('Database connection failed');
        mockDoc.set.mockRejectedValue(error);

        const result = await firebaseService.healthCheck();

        expect(result.status).toBe('unhealthy');
        expect(result.timestamp).toBeInstanceOf(Date);
      });
    });
  });
});
