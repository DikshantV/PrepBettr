"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { UserProfile, AutoApplySettings, JobSearchFilters } from '@/types/auto-apply';
import { UsageIndicator } from '@/components/UsageIndicator';

// Dynamic import for AutoApplyDashboard component that requires DOM APIs
const AutoApplyDashboard = dynamic(() => import('@/components/AutoApplyDashboard').then(mod => ({ default: mod.AutoApplyDashboard })), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-gray-700 rounded mb-2"></div>
            <div className="h-8 bg-gray-600 rounded mb-1"></div>
            <div className="h-3 bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded mb-4 w-1/3"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    </div>
  )
});

// Mock data for development
const mockUserProfile: UserProfile = {
  id: '1',
  email: 'user@example.com',
  name: 'John Doe',
  phone: '+1-555-0123',
  location: 'San Francisco, CA',
  linkedinUrl: 'https://linkedin.com/in/johndoe',
  githubUrl: 'https://github.com/johndoe',
  skills: ['JavaScript', 'React', 'Node.js', 'Python', 'AWS'],
  experience: [
    {
      id: '1',
      company: 'Tech Corp',
      position: 'Senior Software Engineer',
      startDate: '2020-01',
      endDate: undefined,
      isCurrent: true,
      description: 'Leading frontend development for web applications',
      achievements: ['Increased performance by 40%', 'Led team of 5 developers'],
      technologies: ['React', 'TypeScript', 'AWS'],
      location: 'San Francisco, CA'
    }
  ],
  education: [
    {
      id: '1',
      institution: 'University of California',
      degree: 'Bachelor of Science',
      fieldOfStudy: 'Computer Science',
      startDate: '2016-08',
      endDate: '2020-05',
      gpa: 3.8
    }
  ],
  summary: 'Experienced software engineer with expertise in full-stack development',
  targetRoles: ['Software Engineer', 'Full Stack Developer', 'Frontend Engineer'],
  salaryRange: {
    min: 100000,
    max: 150000,
    currency: 'USD'
  },
  workPreferences: {
    remote: true,
    hybrid: true,
    onsite: false,
    locations: ['San Francisco', 'New York', 'Remote']
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

const mockSettings: AutoApplySettings = {
  userId: '1',
  isEnabled: true,
  filters: {
    keywords: ['JavaScript', 'React', 'Frontend'],
    locations: ['San Francisco', 'Remote'],
    jobTypes: ['full-time'],
    workArrangements: ['remote', 'hybrid'],
    experienceLevel: ['mid-senior'],
    companySize: ['medium', 'large'],
    datePosted: 'past-week',
    portals: ['LinkedIn', 'Indeed'],
    minimumRelevancyScore: 70
  } as JobSearchFilters,
  autoApplyThreshold: 80,
  dailyApplicationLimit: 10,
  useCustomCoverLetter: true,
  coverLetterTemplate: 'Dear Hiring Manager, I am excited to apply for this position...',
  useCustomResume: false,
  followUpEnabled: true,
  followUpSchedule: {
    initialDays: 3,
    secondDays: 7
  },
  notifications: {
    email: true,
    newJobsFound: true,
    applicationsSubmitted: true,
    followUpReminders: true,
    errorAlerts: true
  },
  blacklistedCompanies: ['Company A', 'Company B'],
  preferredCompanies: ['Google', 'Meta', 'Apple'],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

export default function AutoApplyPage() {
  const [userProfile, setUserProfile] = useState<UserProfile>(mockUserProfile);
  const [settings, setSettings] = useState<AutoApplySettings>(mockSettings);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // TODO: Load user profile and settings from API
    setLoading(true);
    // Remove artificial delay - data is immediately available
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-white dark:text-white">Auto Apply with AI</h1>
          <UsageIndicator feature="autoApply" variant="badge" showLabel={false} />
        </div>
        <p className="text-gray-600 dark:text-gray-300">
          Automate your job search with AI-powered job matching and application submission.
        </p>
      </div>

      <AutoApplyDashboard 
        userProfile={userProfile} 
        settings={settings}
      />
    </div>
  );
}
