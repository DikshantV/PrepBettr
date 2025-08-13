interface Feedback {
  id: string;
  interviewId: string;
  totalScore: number;
  categoryScores: Array<{
    name: string;
    score: number;
    comment: string;
  }>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  createdAt: string;
  overallScore?: number;
  categories?: Record<string, any>;
  generalFeedback?: string;
  nextSteps?: string[];
  updatedAt?: string;
}

interface Interview {
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
  }> | string[]; // Support both new structure and legacy string array
  createdAt: string | Date;
  updatedAt?: string | Date;
  finalized: boolean;
  feedbackGenerated?: boolean;
  // Legacy properties for backward compatibility
  role?: string;
  level?: string;
  techstack?: string | string[];
  type?: string;
  status?: string;
  companyLogo?: string;
  companyName?: string;
}

interface CreateFeedbackParams {
  interviewId: string;
  userId: string;
  transcript: { role: string; content: string }[];
  feedbackId?: string;
}

interface User {
  name: string;
  email: string;
  id: string;
  uid: string; // Firebase UID (same as id for compatibility)
  image?: string;
  emailVerified?: boolean;
  metadata?: {
    creationTime?: string;
    lastSignInTime?: string;
  };
}

interface InterviewCardProps {
  interviewId?: string;
  userId?: string;
  role: string;
  type: string;
  techstack: string[];
  createdAt?: string;
}

interface AgentProps {
  userName: string;
  userId?: string;
  interviewId?: string;
  feedbackId?: string;
  type: "generate" | "interview";
  questions?: string[];
}

interface RouteParams {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string>>;
}

interface GetFeedbackByInterviewIdParams {
  interviewId: string;
  userId: string;
}

interface GetLatestInterviewsParams {
  userId: string;
  limit?: number;
}

interface SignInResponse {
  success: boolean;
  message: string;
  userId?: string;
}

interface SignInParams {
  email: string;
  idToken: string;
}

interface SignUpParams {
  uid: string;
  name: string;
  email: string;
  password: string;
}

type FormType = "sign-in" | "sign-up";

interface InterviewFormProps {
  interviewId: string;
  role: string;
  level: string;
  type: string;
  techstack: string[];
  amount: number;
}

interface TechIconProps {
  techStack: string[];
}