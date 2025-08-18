"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ExtractedResumeData {
  personalInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  summary?: string;
  skills?: string[];
  experience?: any[];
  education?: any[];
  projects?: any[];
  certifications?: any[];
  languages?: any[];
}

interface ResumeData {
  questions: string[];
  fileUrl: string;
  resumeId: string;
  extractedData?: ExtractedResumeData;
}

interface ResumeContextValue {
  resumeData: ResumeData | null;
  setResumeData: (data: ResumeData | null) => void;
  hasResume: boolean;
  clearResume: () => void;
}

const ResumeContext = createContext<ResumeContextValue | undefined>(undefined);

interface ResumeProviderProps {
  children: ReactNode;
}

export const ResumeProvider: React.FC<ResumeProviderProps> = ({ children }) => {
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);

  const clearResume = () => {
    setResumeData(null);
  };

  const value: ResumeContextValue = {
    resumeData,
    setResumeData,
    hasResume: !!resumeData,
    clearResume,
  };

  return (
    <ResumeContext.Provider value={value}>
      {children}
    </ResumeContext.Provider>
  );
};

export const useResume = (): ResumeContextValue => {
  const context = useContext(ResumeContext);
  if (context === undefined) {
    throw new Error('useResume must be used within a ResumeProvider');
  }
  return context;
};

// Export types for use in other components
export type { ResumeData, ExtractedResumeData };
