// Types for real-time application status tracking

export interface ApplicationStatus {
  id: string;
  userId: string;
  applicationId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  type: 'resume_upload' | 'interview_generation' | 'feedback_generation' | 'resume_tailoring' | 'cover_letter_generation';
  progress: number; // 0-100
  message?: string;
  details?: {
    currentStep?: string;
    totalSteps?: number;
    estimatedTimeRemaining?: number;
    errorDetails?: string;
    warningMessages?: string[];
  };
  result?: any; // The final result data when completed
  createdAt: Date | FirebaseTimestamp;
  updatedAt: Date | FirebaseTimestamp;
  completedAt?: Date | FirebaseTimestamp;
}

export interface UserProfile extends User {
  preferences?: {
    notifications: {
      realTimeUpdates: boolean;
      emailNotifications: boolean;
      pushNotifications: boolean;
    };
    dashboard: {
      defaultView: 'recent' | 'all' | 'favorites';
      itemsPerPage: number;
    };
  };
  subscription?: {
    plan: 'free' | 'premium' | 'enterprise';
    status: 'active' | 'cancelled' | 'expired';
    expiresAt?: Date | FirebaseTimestamp;
  };
  stats?: {
    interviewsCompleted: number;
    averageScore: number;
    lastActivityAt: Date | FirebaseTimestamp;
  };
}

export interface RealtimeConnectionStatus {
  isConnected: boolean;
  lastConnectionTime?: Date;
  reconnectAttempts: number;
  error?: string;
}

export interface OptimisticUpdate<T> {
  id: string;
  type: 'create' | 'update' | 'delete';
  data: Partial<T>;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
  error?: string;
}

// Firestore timestamp type
export interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}

// Enhanced Interview type with real-time fields
export interface EnhancedInterview extends Interview {
  status: 'draft' | 'in_progress' | 'completed' | 'finalized';
  lastUpdated?: Date | FirebaseTimestamp;
  activeParticipants?: string[]; // User IDs currently viewing/editing
  version?: number; // For optimistic concurrency control
}

// Enhanced Feedback type with real-time fields
export interface EnhancedFeedback extends Feedback {
  status: 'generating' | 'ready' | 'updated';
  generationProgress?: number; // 0-100
  lastUpdated?: Date | FirebaseTimestamp;
  version?: number;
}

// Real-time event types
export type RealtimeEvent = 
  | { type: 'interview_created'; data: Interview }
  | { type: 'interview_updated'; data: Partial<Interview> & { id: string } }
  | { type: 'interview_deleted'; data: { id: string } }
  | { type: 'feedback_generated'; data: Feedback }
  | { type: 'feedback_updated'; data: Partial<Feedback> & { id: string } }
  | { type: 'application_status_changed'; data: ApplicationStatus }
  | { type: 'user_profile_updated'; data: Partial<UserProfile> & { id: string } };

// SWR mutation options
export interface RealtimeMutationOptions {
  optimisticData?: any;
  rollbackOnError?: boolean;
  populateCache?: boolean;
  revalidate?: boolean;
}

// Cache invalidation patterns
export interface CacheInvalidationPattern {
  pattern: string | RegExp;
  action: 'revalidate' | 'clear' | 'update';
  condition?: (key: string, data: any) => boolean;
}
