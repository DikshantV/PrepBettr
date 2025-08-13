import { CosmosClient, Database, Container } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

// Data interfaces
export interface UserDocument {
  id: string;
  userId: string;
  email: string;
  displayName?: string;
  profilePictureUrl?: string;
  profilePictureBlobName?: string;
  plan: 'free' | 'premium';
  createdAt: Date;
  updatedAt: Date;
  _partitionKey?: string;
}

export interface InterviewDocument {
  id: string;
  userId: string;
  jobTitle: string;
  company: string;
  jobDescription?: string;
  questions: Array<{
    question: string;
    answer?: string;
    category: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  createdAt: Date;
  updatedAt: Date;
  finalized: boolean;
  feedbackGenerated?: boolean;
  _partitionKey?: string;
}

export interface FeedbackDocument {
  id: string;
  userId: string;
  interviewId: string;
  overallScore: number;
  strengths: string[];
  improvements: string[];
  detailedFeedback: string;
  createdAt: Date;
  _partitionKey?: string;
}

export interface ResumeDocument {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  filePath?: string;
  blobName?: string;
  sasUrl?: string;
  extractedData: {
    personalInfo?: any;
    summary?: string;
    skills: string[];
    experience: any[];
    education: any[];
    projects?: any[];
    certifications?: any[];
    languages?: string[];
  };
  interviewQuestions: string[];
  metadata: {
    fileSize: number;
    uploadDate: Date;
    lastModified: Date;
    mimeType: string;
    storageProvider: 'azure' | 'firebase';
  };
  _partitionKey?: string;
}

export interface UsageDocument {
  id: string;
  userId: string;
  interviews: {
    count: number;
    limit: number;
    lastReset?: Date;
  };
  resumes: {
    count: number;
    limit: number;
    lastReset?: Date;
  };
  updatedAt: Date;
  _partitionKey?: string;
}

export interface JobListingDocument {
  id: string;
  company: string;
  position: string;
  location?: string;
  requirements?: string[];
  isActive: boolean;
  discoveredBy: string[];
  postedDate: Date;
  _partitionKey?: string;
}

export interface ApplicationDocument {
  id: string;
  userId: string;
  jobId: string;
  status: string;
  appliedAt: Date;
  coverLetter?: string;
  _partitionKey?: string;
}

export interface AutoApplySettingsDocument {
  id: string;
  userId: string;
  preferences: any;
  isActive: boolean;
  updatedAt: Date;
  _partitionKey?: string;
}

export interface AutomationLogDocument {
  id: string;
  userId: string;
  action: string;
  status: string;
  timestamp: Date;
  details?: any;
  _partitionKey?: string;
}

export interface SubscriptionEventDocument {
  id: string;
  userId?: string;
  eventType: string;
  data: any;
  processed: boolean;
  timestamp: Date;
  _partitionKey?: string;
}

export interface DataDeletionRequestDocument {
  id: string;
  userId: string;
  requestedBy: string;
  requestDate: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  reason?: string;
  deletedData?: string[];
  _partitionKey?: string;
}

export interface DataProtectionAuditLogDocument {
  id: string;
  userId: string;
  action: string;
  timestamp: Date;
  details?: any;
  _partitionKey?: string;
}

export interface NotificationEventDocument {
  id: string;
  userId: string;
  type: string;
  channel: string;
  recipient: string;
  subject: string;
  content: string;
  templateUsed?: string;
  metadata?: any;
  status: string;
  createdAt: Date;
  sentAt?: Date;
  updatedAt?: Date;
  error?: string;
  messageId?: string;
  jobId?: string;
  applicationId?: string;
  _partitionKey?: string;
}

export interface ErrorEventDocument {
  id: string;
  featureName: string;
  errorType: string;
  errorMessage: string;
  userId?: string;
  userAgent?: string;
  timestamp: Date;
  severity: string;
  metadata?: any;
  _partitionKey?: string;
}

export interface ErrorBudgetDocument {
  id: string;
  featureName: string;
  breachedAt: Date;
  errorCount: number;
  threshold: number;
  timeWindow: number;
  action: string;
  _partitionKey?: string;
}

export interface EmailVerificationDocument {
  id: string;
  userId: string;
  email: string;
  code: string;
  type: string;
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  createdAt: Date;
  verifiedAt?: Date;
  _partitionKey?: string;
}

export interface ProfileDocument {
  id: string;
  userId: string;
  name?: string;
  email?: string;
  about?: string;
  phone?: string;
  workplace?: string;
  skills?: string[];
  experience?: string;
  dateOfBirth?: string;
  image?: string;
  createdAt?: Date;
  updatedAt: Date;
  _partitionKey?: string;
}

class AzureCosmosService {
  private client: CosmosClient;
  private database: Database | null = null;
  private containers: Map<string, Container> = new Map();
  private initialized = false;

  constructor() {
    // Initialize with connection string or key
    const connectionString = process.env.AZURE_COSMOS_CONNECTION_STRING;
    const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
    const key = process.env.AZURE_COSMOS_KEY;
    
    if (connectionString) {
      this.client = new CosmosClient(connectionString);
    } else if (endpoint && key) {
      this.client = new CosmosClient({
        endpoint: endpoint,
        key: key
      });
    } else {
      throw new Error('Azure Cosmos DB configuration missing. Set AZURE_COSMOS_CONNECTION_STRING or both AZURE_COSMOS_ENDPOINT and AZURE_COSMOS_KEY');
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const databaseId = process.env.AZURE_COSMOS_DATABASE_NAME || 'PrepBettrDB';
      
      // Create or get database
      const { database } = await this.client.databases.createIfNotExists({
        id: databaseId
      });
      
      this.database = database;

      // Define containers with their partition keys
      const containerDefinitions = [
        { id: 'users', partitionKey: '/userId' },
        { id: 'interviews', partitionKey: '/userId' },
        { id: 'feedback', partitionKey: '/userId' },
        { id: 'resumes', partitionKey: '/userId' },
        { id: 'usage', partitionKey: '/userId' },
        { id: 'jobListings', partitionKey: '/id' },
        { id: 'applications', partitionKey: '/userId' },
        { id: 'autoApplySettings', partitionKey: '/userId' },
        { id: 'automationLogs', partitionKey: '/userId' },
        { id: 'subscriptionEvents', partitionKey: '/id' },
        { id: 'dataDeletionRequests', partitionKey: '/userId' },
        { id: 'dataProtectionAuditLog', partitionKey: '/userId' },
        { id: 'notificationEvents', partitionKey: '/userId' },
        { id: 'featureErrors', partitionKey: '/featureName' },
        { id: 'errorBudgets', partitionKey: '/featureName' },
        { id: 'emailVerifications', partitionKey: '/userId' },
        { id: 'profiles', partitionKey: '/userId' }
      ];

      // Create containers
      if (!this.database) {
        throw new Error('Database initialization failed');
      }
      
      for (const containerDef of containerDefinitions) {
        const { container } = await this.database.containers.createIfNotExists({
          id: containerDef.id,
          partitionKey: containerDef.partitionKey
        });
        this.containers.set(containerDef.id, container);
      }

      this.initialized = true;
      console.log('✅ Azure Cosmos DB service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Azure Cosmos DB:', error);
      throw error;
    }
  }

  private getContainer(containerName: string): Container {
    const container = this.containers.get(containerName);
    if (!container) {
      throw new Error(`Container ${containerName} not found. Make sure initialize() was called.`);
    }
    return container;
  }

  // Users operations
  async createUser(userData: Omit<UserDocument, 'id' | '_partitionKey'>): Promise<string> {
    await this.initialize();
    const container = this.getContainer('users');
    
    const document: UserDocument = {
      id: userData.userId,
      ...userData,
      _partitionKey: userData.userId
    };
    
    const { resource } = await container.items.create(document);
    return resource!.id;
  }

  async getUser(userId: string): Promise<UserDocument | null> {
    await this.initialize();
    const container = this.getContainer('users');
    
    try {
      const { resource } = await container.item(userId, userId).read<UserDocument>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async updateUser(userId: string, updates: Partial<UserDocument>): Promise<void> {
    await this.initialize();
    const container = this.getContainer('users');
    
    const { resource: existing } = await container.item(userId, userId).read<UserDocument>();
    if (!existing) throw new Error('User not found');
    
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
      _partitionKey: userId
    };
    
    await container.item(userId, userId).replace(updated);
  }

  // Interviews operations
  async createInterview(interviewData: Omit<InterviewDocument, 'id' | '_partitionKey'>): Promise<string> {
    await this.initialize();
    const container = this.getContainer('interviews');
    
    const id = `interview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const document: InterviewDocument = {
      id,
      ...interviewData,
      _partitionKey: interviewData.userId
    };
    
    const { resource } = await container.items.create(document);
    return resource!.id;
  }

  async getInterview(interviewId: string, userId: string): Promise<InterviewDocument | null> {
    await this.initialize();
    const container = this.getContainer('interviews');
    
    try {
      const { resource } = await container.item(interviewId, userId).read<InterviewDocument>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async getUserInterviews(userId: string): Promise<InterviewDocument[]> {
    await this.initialize();
    const container = this.getContainer('interviews');
    
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC',
      parameters: [{ name: '@userId', value: userId }]
    };
    
    const { resources } = await container.items.query<InterviewDocument>(querySpec).fetchAll();
    return resources;
  }

  async getPublicInterviews(userId: string, limit: number = 20): Promise<InterviewDocument[]> {
    await this.initialize();
    const container = this.getContainer('interviews');
    
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.userId = @userId AND c.finalized = true ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit',
      parameters: [
        { name: '@userId', value: userId },
        { name: '@limit', value: limit }
      ]
    };
    
    const { resources } = await container.items.query<InterviewDocument>(querySpec).fetchAll();
    return resources;
  }

  async getPublicInterviewsExcludingUser(excludeUserId: string, limit: number = 20): Promise<InterviewDocument[]> {
    await this.initialize();
    const container = this.getContainer('interviews');
    
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.finalized = true AND c.userId != @excludeUserId ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit',
      parameters: [
        { name: '@excludeUserId', value: excludeUserId },
        { name: '@limit', value: limit }
      ]
    };
    
    const { resources } = await container.items.query<InterviewDocument>(querySpec).fetchAll();
    return resources;
  }

  async updateInterview(interviewId: string, userId: string, updates: Partial<InterviewDocument>): Promise<void> {
    await this.initialize();
    const container = this.getContainer('interviews');
    
    const { resource: existing } = await container.item(interviewId, userId).read<InterviewDocument>();
    if (!existing) throw new Error('Interview not found');
    
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
      _partitionKey: userId
    };
    
    await container.item(interviewId, userId).replace(updated);
  }

  async deleteInterview(interviewId: string, userId: string): Promise<void> {
    await this.initialize();
    const container = this.getContainer('interviews');
    await container.item(interviewId, userId).delete();
  }

  // Feedback operations
  async createFeedback(feedbackData: Omit<FeedbackDocument, 'id' | '_partitionKey'>): Promise<string> {
    await this.initialize();
    const container = this.getContainer('feedback');
    
    const id = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const document: FeedbackDocument = {
      id,
      ...feedbackData,
      _partitionKey: feedbackData.userId
    };
    
    const { resource } = await container.items.create(document);
    return resource!.id;
  }

  async getFeedbackByInterview(interviewId: string, userId: string): Promise<FeedbackDocument | null> {
    await this.initialize();
    const container = this.getContainer('feedback');
    
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.interviewId = @interviewId AND c.userId = @userId',
      parameters: [
        { name: '@interviewId', value: interviewId },
        { name: '@userId', value: userId }
      ]
    };
    
    const { resources } = await container.items.query<FeedbackDocument>(querySpec).fetchAll();
    return resources[0] || null;
  }

  // Resume operations
  async saveResume(resumeData: Omit<ResumeDocument, '_partitionKey'>): Promise<string> {
    await this.initialize();
    const container = this.getContainer('resumes');
    
    const document: ResumeDocument = {
      ...resumeData,
      _partitionKey: resumeData.userId
    };
    
    const { resource } = await container.items.upsert(document);
    return resource!.id;
  }

  async getUserResume(userId: string): Promise<ResumeDocument | null> {
    await this.initialize();
    const container = this.getContainer('resumes');
    
    try {
      const { resource } = await container.item(userId, userId).read<ResumeDocument>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async deleteUserResume(userId: string): Promise<void> {
    await this.initialize();
    const container = this.getContainer('resumes');
    
    try {
      await container.item(userId, userId).delete();
    } catch (error: any) {
      if (error.code === 404) return; // Already deleted
      throw error;
    }
  }

  // Usage operations
  async getUserUsage(userId: string): Promise<UsageDocument | null> {
    await this.initialize();
    const container = this.getContainer('usage');
    
    try {
      const { resource } = await container.item(userId, userId).read<UsageDocument>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async initializeUserUsage(userId: string): Promise<void> {
    await this.initialize();
    const container = this.getContainer('usage');
    
    const usageData: UsageDocument = {
      id: userId,
      userId,
      interviews: { count: 0, limit: 3 },
      resumes: { count: 0, limit: 2 },
      updatedAt: new Date(),
      _partitionKey: userId
    };
    
    await container.items.upsert(usageData);
  }

  async incrementUsage(userId: string, type: 'interviews' | 'resumes'): Promise<void> {
    await this.initialize();
    const container = this.getContainer('usage');
    
    const { resource: existing } = await container.item(userId, userId).read<UsageDocument>();
    if (!existing) {
      await this.initializeUserUsage(userId);
      return this.incrementUsage(userId, type);
    }
    
    const updated = {
      ...existing,
      [type]: {
        ...existing[type],
        count: existing[type].count + 1
      },
      updatedAt: new Date(),
      _partitionKey: userId
    };
    
    await container.item(userId, userId).replace(updated);
  }

  async checkUsageLimit(userId: string, type: 'interviews' | 'resumes'): Promise<boolean> {
    const usage = await this.getUserUsage(userId);
    
    if (!usage) {
      await this.initializeUserUsage(userId);
      return true;
    }
    
    return usage[type].count < usage[type].limit;
  }

  // Job-related operations
  async createJobListing(jobData: Omit<JobListingDocument, 'id' | '_partitionKey'>): Promise<string> {
    await this.initialize();
    const container = this.getContainer('jobListings');
    
    const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const document: JobListingDocument = {
      id,
      ...jobData,
      _partitionKey: id
    };
    
    const { resource } = await container.items.create(document);
    return resource!.id;
  }

  async getActiveJobListings(userId: string): Promise<JobListingDocument[]> {
    await this.initialize();
    const container = this.getContainer('jobListings');
    
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.isActive = true AND (ARRAY_CONTAINS(c.discoveredBy, @userId) OR ARRAY_LENGTH(c.discoveredBy) = 0) ORDER BY c.postedDate DESC',
      parameters: [{ name: '@userId', value: userId }]
    };
    
    const { resources } = await container.items.query<JobListingDocument>(querySpec).fetchAll();
    return resources;
  }

  // Applications operations
  async createApplication(applicationData: Omit<ApplicationDocument, 'id' | '_partitionKey'>): Promise<string> {
    await this.initialize();
    const container = this.getContainer('applications');
    
    const id = `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const document: ApplicationDocument = {
      id,
      ...applicationData,
      _partitionKey: applicationData.userId
    };
    
    const { resource } = await container.items.create(document);
    return resource!.id;
  }

  async getUserApplications(userId: string): Promise<ApplicationDocument[]> {
    await this.initialize();
    const container = this.getContainer('applications');
    
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.appliedAt DESC',
      parameters: [{ name: '@userId', value: userId }]
    };
    
    const { resources } = await container.items.query<ApplicationDocument>(querySpec).fetchAll();
    return resources;
  }

  // GDPR operations
  async createDataDeletionRequest(requestData: Omit<DataDeletionRequestDocument, 'id' | '_partitionKey'>): Promise<string> {
    await this.initialize();
    const container = this.getContainer('dataDeletionRequests');
    
    const id = `del_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const document: DataDeletionRequestDocument = {
      id,
      ...requestData,
      _partitionKey: requestData.userId
    };
    
    const { resource } = await container.items.create(document);
    return resource!.id;
  }

  async deleteAllUserData(userId: string): Promise<string[]> {
    await this.initialize();
    const deletedCollections: string[] = [];
    
    const collections = [
      'users', 'interviews', 'feedback', 'resumes', 'usage', 
      'applications', 'autoApplySettings', 'automationLogs', 'dataDeletionRequests'
    ];
    
    for (const collectionName of collections) {
      try {
        const container = this.getContainer(collectionName);
        
        if (collectionName === 'users' || collectionName === 'resumes' || collectionName === 'usage') {
          // These use userId as document ID
          try {
            await container.item(userId, userId).delete();
            deletedCollections.push(collectionName);
          } catch (error: any) {
            if (error.code !== 404) throw error;
          }
        } else {
          // Query and delete all documents for this user
          const querySpec = {
            query: 'SELECT c.id FROM c WHERE c.userId = @userId',
            parameters: [{ name: '@userId', value: userId }]
          };
          
          const { resources } = await container.items.query(querySpec).fetchAll();
          
          if (resources.length > 0) {
            for (const item of resources) {
              await container.item(item.id, userId).delete();
            }
            deletedCollections.push(collectionName);
          }
        }
      } catch (error) {
        console.error(`Error deleting from ${collectionName}:`, error);
      }
    }
    
    return deletedCollections;
  }

  // Notification Events operations
  async createNotificationEvent(eventData: Omit<NotificationEventDocument, 'id' | '_partitionKey'>): Promise<string> {
    await this.initialize();
    const container = this.getContainer('notificationEvents');
    
    const id = `notify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const document: NotificationEventDocument = {
      id,
      ...eventData,
      _partitionKey: eventData.userId
    };
    
    const { resource } = await container.items.create(document);
    return resource!.id;
  }

  async updateNotificationEvent(eventId: string, userId: string, updates: Partial<NotificationEventDocument>): Promise<void> {
    await this.initialize();
    const container = this.getContainer('notificationEvents');
    
    const { resource: existing } = await container.item(eventId, userId).read<NotificationEventDocument>();
    if (!existing) throw new Error('Notification event not found');
    
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
      _partitionKey: userId
    };
    
    await container.item(eventId, userId).replace(updated);
  }

  async getUserNotificationEvents(userId: string, limit: number = 50): Promise<NotificationEventDocument[]> {
    await this.initialize();
    const container = this.getContainer('notificationEvents');
    
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit',
      parameters: [
        { name: '@userId', value: userId },
        { name: '@limit', value: limit }
      ]
    };
    
    const { resources } = await container.items.query<NotificationEventDocument>(querySpec).fetchAll();
    return resources;
  }

  // Error Events operations for monitoring
  async createErrorEvent(errorData: Omit<ErrorEventDocument, 'id' | '_partitionKey'>): Promise<string> {
    await this.initialize();
    const container = this.getContainer('featureErrors');
    
    const id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const document: ErrorEventDocument = {
      id,
      ...errorData,
      _partitionKey: errorData.featureName
    };
    
    const { resource } = await container.items.create(document);
    return resource!.id;
  }

  async getErrorEvents(featureName: string, timeWindowMinutes: number, limit: number = 100): Promise<ErrorEventDocument[]> {
    await this.initialize();
    const container = this.getContainer('featureErrors');
    
    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.featureName = @featureName AND c.timestamp >= @cutoffTime ORDER BY c.timestamp DESC OFFSET 0 LIMIT @limit',
      parameters: [
        { name: '@featureName', value: featureName },
        { name: '@cutoffTime', value: cutoffTime },
        { name: '@limit', value: limit }
      ]
    };
    
    const { resources } = await container.items.query<ErrorEventDocument>(querySpec).fetchAll();
    return resources;
  }

  async getErrorEventCount(featureName: string, timeWindowMinutes: number): Promise<number> {
    await this.initialize();
    const container = this.getContainer('featureErrors');
    
    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    
    const querySpec = {
      query: 'SELECT VALUE COUNT(1) FROM c WHERE c.featureName = @featureName AND c.timestamp >= @cutoffTime',
      parameters: [
        { name: '@featureName', value: featureName },
        { name: '@cutoffTime', value: cutoffTime }
      ]
    };
    
    const { resources } = await container.items.query<number>(querySpec).fetchAll();
    return resources[0] || 0;
  }

  // Error Budget operations
  async createErrorBudget(budgetData: Omit<ErrorBudgetDocument, 'id' | '_partitionKey'>): Promise<string> {
    await this.initialize();
    const container = this.getContainer('errorBudgets');
    
    const id = `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const document: ErrorBudgetDocument = {
      id,
      ...budgetData,
      _partitionKey: budgetData.featureName
    };
    
    const { resource } = await container.items.create(document);
    return resource!.id;
  }

  // Email Verification operations
  async createEmailVerification(verificationData: Omit<EmailVerificationDocument, 'id' | '_partitionKey'>): Promise<string> {
    await this.initialize();
    const container = this.getContainer('emailVerifications');
    
    const id = `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const document: EmailVerificationDocument = {
      id,
      ...verificationData,
      _partitionKey: verificationData.userId
    };
    
    const { resource } = await container.items.create(document);
    return resource!.id;
  }

  async getEmailVerification(userId: string, email: string, type: string): Promise<EmailVerificationDocument | null> {
    await this.initialize();
    const container = this.getContainer('emailVerifications');
    
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.userId = @userId AND c.email = @email AND c.type = @type AND c.verified = false ORDER BY c.createdAt DESC',
      parameters: [
        { name: '@userId', value: userId },
        { name: '@email', value: email },
        { name: '@type', value: type }
      ]
    };
    
    const { resources } = await container.items.query<EmailVerificationDocument>(querySpec).fetchAll();
    return resources[0] || null;
  }

  async updateEmailVerification(verificationId: string, userId: string, updates: Partial<EmailVerificationDocument>): Promise<void> {
    await this.initialize();
    const container = this.getContainer('emailVerifications');
    
    const { resource: existing } = await container.item(verificationId, userId).read<EmailVerificationDocument>();
    if (!existing) throw new Error('Email verification not found');
    
    const updated = {
      ...existing,
      ...updates,
      _partitionKey: userId
    };
    
    await container.item(verificationId, userId).replace(updated);
  }

  // Profile operations (for Firestore profiles collection)
  async saveProfile(profileData: Omit<ProfileDocument, '_partitionKey'>): Promise<string> {
    await this.initialize();
    const container = this.getContainer('profiles');
    
    const document: ProfileDocument = {
      ...profileData,
      _partitionKey: profileData.userId
    };
    
    const { resource } = await container.items.upsert(document);
    return resource!.id;
  }

  async getProfile(userId: string): Promise<ProfileDocument | null> {
    await this.initialize();
    const container = this.getContainer('profiles');
    
    try {
      const { resource } = await container.item(userId, userId).read<ProfileDocument>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async updateProfile(userId: string, updates: Partial<ProfileDocument>): Promise<void> {
    await this.initialize();
    const container = this.getContainer('profiles');
    
    const { resource: existing } = await container.item(userId, userId).read<ProfileDocument>();
    if (!existing) {
      // Create new profile if doesn't exist
      const newProfile: ProfileDocument = {
        id: userId,
        userId,
        ...updates,
        updatedAt: new Date(),
        _partitionKey: userId
      };
      await container.items.create(newProfile);
    } else {
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
        _partitionKey: userId
      };
      await container.item(userId, userId).replace(updated);
    }
  }

  // Generic query operations for complex Firestore-like queries
  async queryDocuments<T>(
    containerName: string,
    query: string,
    parameters: Array<{ name: string; value: any }>,
    partitionKey?: string
  ): Promise<T[]> {
    await this.initialize();
    const container = this.getContainer(containerName);
    
    const querySpec = { query, parameters };
    const queryOptions = partitionKey ? { partitionKey } : {};
    
    const { resources } = await container.items
      .query<T>(querySpec, queryOptions)
      .fetchAll();
    
    return resources;
  }

  // Generic document operations
  async createDocument<T extends { _partitionKey?: string }>(containerName: string, document: T): Promise<string> {
    await this.initialize();
    const container = this.getContainer(containerName);
    
    const { resource } = await container.items.create(document);
    return resource!.id;
  }

  async getDocument<T = any>(containerName: string, documentId: string, partitionKey: string): Promise<T | null> {
    await this.initialize();
    const container = this.getContainer(containerName);
    
    try {
      const { resource } = await container.item(documentId, partitionKey).read();
      return (resource as T) || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async updateDocument<T = any>(containerName: string, documentId: string, partitionKey: string, updates: Partial<T>): Promise<void> {
    await this.initialize();
    const container = this.getContainer(containerName);
    
    const { resource: existing } = await container.item(documentId, partitionKey).read();
    if (!existing) throw new Error('Document not found');
    
    const updated = {
      ...existing,
      ...updates
    };
    
    await container.item(documentId, partitionKey).replace(updated);
  }

  async deleteDocument(containerName: string, documentId: string, partitionKey: string): Promise<void> {
    await this.initialize();
    const container = this.getContainer(containerName);
    
    try {
      await container.item(documentId, partitionKey).delete();
    } catch (error: any) {
      if (error.code !== 404) throw error;
      // Document already deleted, ignore 404
    }
  }

  // Batch operations for efficiency
  async batchCreate<T extends { id: string; _partitionKey?: string }>(
    containerName: string, 
    documents: T[]
  ): Promise<void> {
    await this.initialize();
    const container = this.getContainer(containerName);
    
    // Process in smaller batches to avoid limits
    const batchSize = 25;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await Promise.all(batch.map(doc => container.items.create(doc)));
    }
  }

  async batchDelete(containerName: string, documentIds: Array<{ id: string; partitionKey: string }>): Promise<void> {
    await this.initialize();
    const container = this.getContainer(containerName);
    
    // Process in smaller batches
    const batchSize = 25;
    for (let i = 0; i < documentIds.length; i += batchSize) {
      const batch = documentIds.slice(i, i + batchSize);
      await Promise.all(batch.map(({ id, partitionKey }) => 
        container.item(id, partitionKey).delete().catch(err => {
          if (err.code !== 404) throw err;
          // Ignore 404s for already deleted documents
        })
      ));
    }
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; timestamp: Date }> {
    try {
      await this.initialize();
      const container = this.getContainer('users');
      
      // Simple read operation to test connectivity
      const querySpec = { query: 'SELECT VALUE COUNT(1) FROM c', parameters: [] };
      await container.items.query(querySpec).fetchAll();
      
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      console.error('Azure Cosmos DB health check failed:', error);
      return { status: 'unhealthy', timestamp: new Date() };
    }
  }
}

// Export singleton instance
export const azureCosmosService = new AzureCosmosService();
export default azureCosmosService;
