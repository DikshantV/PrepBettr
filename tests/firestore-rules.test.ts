import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Firestore Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    // Read the security rules from the file
    const rulesPath = resolve(__dirname, '../firestore.rules');
    const rules = readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: 'test-project',
      firestore: {
        rules,
        host: 'localhost',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe('User Documents', () => {
    it('should allow users to read their own user document', async () => {
      const userId = 'test-user-id';
      const context = testEnv.authenticatedContext(userId);
      const userDoc = context.firestore().doc(`users/${userId}`);
      
      await userDoc.set({
        email: 'test@example.com',
        displayName: 'Test User',
        createdAt: new Date(),
      });

      await expect(userDoc.get()).resolves.not.toThrow();
    });

    it('should deny users from reading other users documents', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';
      
      const context1 = testEnv.authenticatedContext(userId1);
      const context2 = testEnv.authenticatedContext(userId2);
      
      // User 1 creates their document
      const user1Doc = context1.firestore().doc(`users/${userId1}`);
      await user1Doc.set({
        email: 'user1@example.com',
        displayName: 'User 1',
      });

      // User 2 tries to read User 1's document
      const user1DocAsUser2 = context2.firestore().doc(`users/${userId1}`);
      await expect(user1DocAsUser2.get()).rejects.toThrow();
    });

    it('should deny unauthenticated access to user documents', async () => {
      const context = testEnv.unauthenticatedContext();
      const userDoc = context.firestore().doc('users/test-user');
      
      await expect(userDoc.get()).rejects.toThrow();
    });
  });

  describe('Interview Documents', () => {
    it('should allow users to create interviews with their own userId', async () => {
      const userId = 'test-user-id';
      const context = testEnv.authenticatedContext(userId);
      const interviewDoc = context.firestore().doc('interviews/interview-1');
      
      await expect(interviewDoc.set({
        userId,
        jobTitle: 'Software Engineer',
        company: 'Tech Corp',
        questions: [],
        createdAt: new Date(),
        finalized: false,
      })).resolves.not.toThrow();
    });

    it('should deny users from creating interviews for other users', async () => {
      const userId = 'test-user-id';
      const otherUserId = 'other-user-id';
      const context = testEnv.authenticatedContext(userId);
      const interviewDoc = context.firestore().doc('interviews/interview-1');
      
      await expect(interviewDoc.set({
        userId: otherUserId, // Wrong user ID
        jobTitle: 'Software Engineer',
        company: 'Tech Corp',
        questions: [],
        createdAt: new Date(),
        finalized: false,
      })).rejects.toThrow();
    });

    it('should allow users to read their own interviews', async () => {
      const userId = 'test-user-id';
      const context = testEnv.authenticatedContext(userId);
      const interviewDoc = context.firestore().doc('interviews/interview-1');
      
      await interviewDoc.set({
        userId,
        jobTitle: 'Software Engineer',
        company: 'Tech Corp',
        questions: [],
        createdAt: new Date(),
        finalized: false,
      });

      await expect(interviewDoc.get()).resolves.not.toThrow();
    });

    it('should allow authenticated users to read finalized interviews', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';
      
      const context1 = testEnv.authenticatedContext(userId1);
      const context2 = testEnv.authenticatedContext(userId2);
      
      // User 1 creates a finalized interview
      const interviewDoc = context1.firestore().doc('interviews/interview-1');
      await interviewDoc.set({
        userId: userId1,
        jobTitle: 'Software Engineer',
        company: 'Tech Corp',
        questions: [],
        createdAt: new Date(),
        finalized: true, // Finalized interview
      });

      // User 2 should be able to read the finalized interview
      const interviewDocAsUser2 = context2.firestore().doc('interviews/interview-1');
      await expect(interviewDocAsUser2.get()).resolves.not.toThrow();
    });

    it('should deny users from reading non-finalized interviews of other users', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';
      
      const context1 = testEnv.authenticatedContext(userId1);
      const context2 = testEnv.authenticatedContext(userId2);
      
      // User 1 creates a non-finalized interview
      const interviewDoc = context1.firestore().doc('interviews/interview-1');
      await interviewDoc.set({
        userId: userId1,
        jobTitle: 'Software Engineer',
        company: 'Tech Corp',
        questions: [],
        createdAt: new Date(),
        finalized: false, // Not finalized
      });

      // User 2 should not be able to read the non-finalized interview
      const interviewDocAsUser2 = context2.firestore().doc('interviews/interview-1');
      await expect(interviewDocAsUser2.get()).rejects.toThrow();
    });
  });

  describe('Usage Documents', () => {
    it('should allow users to read their own usage data', async () => {
      const userId = 'test-user-id';
      const context = testEnv.authenticatedContext(userId);
      const usageDoc = context.firestore().doc(`usage/${userId}`);
      
      await usageDoc.set({
        interviews: { count: 2, limit: 5 },
        resumes: { count: 1, limit: 3 },
        updatedAt: new Date(),
      });

      await expect(usageDoc.get()).resolves.not.toThrow();
    });

    it('should deny users from reading other users usage data', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';
      
      const context1 = testEnv.authenticatedContext(userId1);
      const context2 = testEnv.authenticatedContext(userId2);
      
      // User 1 creates their usage document
      const usage1Doc = context1.firestore().doc(`usage/${userId1}`);
      await usage1Doc.set({
        interviews: { count: 2, limit: 5 },
        resumes: { count: 1, limit: 3 },
        updatedAt: new Date(),
      });

      // User 2 tries to read User 1's usage document
      const usage1DocAsUser2 = context2.firestore().doc(`usage/${userId1}`);
      await expect(usage1DocAsUser2.get()).rejects.toThrow();
    });
  });

  describe('Applications', () => {
    it('should allow users to create applications with their own userId', async () => {
      const userId = 'test-user-id';
      const context = testEnv.authenticatedContext(userId);
      const applicationDoc = context.firestore().doc('applications/app-1');
      
      await expect(applicationDoc.set({
        userId,
        jobId: 'job-123',
        status: 'applied',
        appliedAt: new Date(),
      })).resolves.not.toThrow();
    });

    it('should deny users from creating applications for other users', async () => {
      const userId = 'test-user-id';
      const otherUserId = 'other-user-id';
      const context = testEnv.authenticatedContext(userId);
      const applicationDoc = context.firestore().doc('applications/app-1');
      
      await expect(applicationDoc.set({
        userId: otherUserId, // Wrong user ID
        jobId: 'job-123',
        status: 'applied',
        appliedAt: new Date(),
      })).rejects.toThrow();
    });
  });

  describe('Subscription Events', () => {
    it('should deny all direct access to subscription events', async () => {
      const userId = 'test-user-id';
      const context = testEnv.authenticatedContext(userId);
      const eventDoc = context.firestore().doc('subscription_events/event-1');
      
      // Should deny read
      await expect(eventDoc.get()).rejects.toThrow();
      
      // Should deny write
      await expect(eventDoc.set({
        userId,
        event: 'subscription_created',
        timestamp: new Date(),
      })).rejects.toThrow();
    });

    it('should deny unauthenticated access to subscription events', async () => {
      const context = testEnv.unauthenticatedContext();
      const eventDoc = context.firestore().doc('subscription_events/event-1');
      
      await expect(eventDoc.get()).rejects.toThrow();
    });
  });
});
