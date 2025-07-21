"use client";

import React, { useState, useEffect } from 'react';
import { AutoApplyDashboard } from '@/components/AutoApplyDashboard';
import { UserProfile, AutoApplySettings, JobSearchFilters } from '@/types/auto-apply';

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
      endDate: null,
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Auto Apply with AI</h1>
        <p className="text-gray-600">
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
