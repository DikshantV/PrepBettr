"use client";

import React, { useState, useEffect } from 'react';
import {
  AutoApplyDashboardProps,
  JobListing,
  JobSearchFilters,
  UserProfile,
  AutoApplySettings,
  JOB_PORTALS,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
} from '@/types/auto-apply';
import { JobListingTable } from './JobListingTable';
import { JobFilters } from './JobFilters';
import { ResumeUpload } from './ResumeUpload';
import { SettingsForm } from './SettingsForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Search, Settings, BarChart3, Download, Upload, Play, Pause } from 'lucide-react';

// Mock job data for demonstration
const mockJobs: JobListing[] = [
  {
    id: '1',
    title: 'Senior Frontend Developer',
    company: 'Tech Innovations Inc.',
    location: 'San Francisco, CA',
    salary: {
      min: 120000,
      max: 160000,
      currency: 'USD',
      period: 'yearly'
    },
    jobType: 'full-time',
    workArrangement: 'hybrid',
    description: 'Join our team to build cutting-edge web applications using React and TypeScript.',
    requirements: ['5+ years React experience', 'TypeScript proficiency', 'Frontend architecture'],
    responsibilities: ['Lead frontend development', 'Mentor junior developers', 'Code reviews'],
    postedDate: '2024-01-15',
    jobPortal: JOB_PORTALS[0], // LinkedIn
    originalUrl: 'https://linkedin.com/jobs/123',
    relevancyScore: 88,
    matchedSkills: ['React', 'TypeScript', 'JavaScript'],
    missingSkills: ['Vue.js'],
    applicationStatus: 'ready_to_apply',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z'
  },
  {
    id: '2',
    title: 'Full Stack Engineer',
    company: 'StartupXYZ',
    location: 'Remote',
    salary: {
      min: 100000,
      max: 140000,
      currency: 'USD',
      period: 'yearly'
    },
    jobType: 'full-time',
    workArrangement: 'remote',
    description: 'Build scalable web applications from frontend to backend.',
    requirements: ['Node.js', 'React', 'Database design'],
    responsibilities: ['Full-stack development', 'API design', 'Database optimization'],
    postedDate: '2024-01-14',
    jobPortal: JOB_PORTALS[1], // Indeed
    originalUrl: 'https://indeed.com/jobs/456',
    relevancyScore: 92,
    matchedSkills: ['React', 'Node.js', 'JavaScript', 'Python'],
    missingSkills: ['MongoDB'],
    applicationStatus: 'applied',
    createdAt: '2024-01-14T10:30:00Z',
    updatedAt: '2024-01-14T10:30:00Z'
  },
  {
    id: '3',
    title: 'Software Development Engineer',
    company: 'Big Tech Corp',
    location: 'Seattle, WA',
    salary: {
      min: 150000,
      max: 200000,
      currency: 'USD',
      period: 'yearly'
    },
    jobType: 'full-time',
    workArrangement: 'onsite',
    description: 'Work on large-scale distributed systems and cloud infrastructure.',
    requirements: ['AWS', 'Microservices', 'System design'],
    responsibilities: ['System architecture', 'Performance optimization', 'Code quality'],
    postedDate: '2024-01-13',
    jobPortal: JOB_PORTALS[0], // LinkedIn
    originalUrl: 'https://linkedin.com/jobs/789',
    relevancyScore: 75,
    matchedSkills: ['JavaScript', 'Python', 'AWS'],
    missingSkills: ['Kubernetes', 'Docker'],
    applicationStatus: 'analyzing',
    createdAt: '2024-01-13T14:15:00Z',
    updatedAt: '2024-01-13T14:15:00Z'
  }
];

export const AutoApplyDashboard: React.FC<AutoApplyDashboardProps> = ({ userProfile, settings }) => {
  const [jobListings, setJobListings] = useState<JobListing[]>(mockJobs);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [currentSettings, setCurrentSettings] = useState<AutoApplySettings>(settings);
  const [activeTab, setActiveTab] = useState<string>('search');
  const [stats, setStats] = useState({
    totalApplications: 127,
    pendingApplications: 23,
    interviewRequests: 8,
    averageRelevancyScore: 82
  });

  const handleSearch = async (filters: JobSearchFilters) => {
    setSearchLoading(true);
    try {
      // TODO: Implement actual job search API call
      console.log('Searching with filters:', filters);
      
      // For now, just filter mock jobs based on keywords
      const filteredJobs = mockJobs.filter(job => 
        filters.keywords.some(keyword => 
          job.title.toLowerCase().includes(keyword.toLowerCase()) ||
          job.description.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      
      setJobListings(filteredJobs);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleApply = async (jobId: string) => {
    setLoading(true);
    try {
      // TODO: Implement actual job application logic
      console.log(`Applying for job with ID: ${jobId}`);
      
      // Update job status to "applying" then "applied"
      setJobListings(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, applicationStatus: 'applying' }
          : job
      ));
      
      // For now, immediately mark as applied (remove simulation delay)
      setJobListings(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, applicationStatus: 'applied' }
          : job
      ));
      
      // Update stats
      setStats(prev => ({ ...prev, totalApplications: prev.totalApplications + 1 }));
      
    } catch (error) {
      console.error('Application failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (jobId: string) => {
    setLoading(true);
    try {
      // TODO: Implement actual job analysis with Gemini API
      console.log(`Analyzing job with ID: ${jobId}`);
      
      // Update job status to "analyzing"
      setJobListings(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, applicationStatus: 'analyzing' }
          : job
      ));
      
      // Generate random relevancy score for demo (remove delay)
      const relevancyScore = Math.floor(Math.random() * 40) + 60; // 60-100
      
      setJobListings(prev => prev.map(job => 
        job.id === jobId 
          ? { 
              ...job, 
              applicationStatus: 'ready_to_apply',
              relevancyScore 
            }
          : job
      ));
      
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (jobId: string) => {
    const job = jobListings.find(j => j.id === jobId);
    if (job) {
      window.open(job.originalUrl, '_blank');
    }
  };

  const handleProfileExtracted = (profile: Partial<UserProfile>) => {
    console.log('Extracted profile:', profile);
    // TODO: Update user profile with extracted data
  };

  const handleSettingsChange = (newSettings: AutoApplySettings) => {
    setCurrentSettings(newSettings);
  };

  const handleSettingsSave = async () => {
    setLoading(true);
    try {
      // TODO: Save settings to API
      console.log('Saving settings:', currentSettings);
      // Remove artificial delay - let the actual API call determine timing
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadSummaryReport = async () => {
    // TODO: Generate and download summary report
    console.log('Generating summary report...');
    
    const reportData = {
      userProfile,
      stats,
      jobListings,
      settings: currentSettings,
      generatedAt: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `auto-apply-report-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const toggleAutoApply = () => {
    const newSettings = {
      ...currentSettings,
      isEnabled: !currentSettings.isEnabled
    };
    setCurrentSettings(newSettings);
    handleSettingsSave();
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview - Dark theme optimized */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Applications</CardTitle>
            <BarChart3 className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.totalApplications}</div>
            <p className="text-xs text-gray-400">
              +12 from last week
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Pending</CardTitle>
            <Bot className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.pendingApplications}</div>
            <p className="text-xs text-gray-400">
              Awaiting response
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Interviews</CardTitle>
            <Search className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.interviewRequests}</div>
            <p className="text-xs text-gray-400">
              6.3% response rate
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Avg. Match Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.averageRelevancyScore}%</div>
            <p className="text-xs text-gray-400">
              +2% improvement
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Auto-Apply Toggle - Dark theme with enhanced contrast */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white mb-3">
                <Bot className="h-5 w-5 text-blue-400" />
                Auto-Apply Status
              </CardTitle>
              <CardDescription className="text-gray-300">
                AI agent will automatically search and apply to relevant jobs
              </CardDescription>
            </div>
            <Button 
              onClick={toggleAutoApply}
              variant={currentSettings.isEnabled ? 'default' : 'outline'}
              className={currentSettings.isEnabled ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' : 'border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white'}
            >
              {currentSettings.isEnabled ? (
                <><Pause className="h-4 w-4 mr-2" /> Active</>
              ) : (
                <><Play className="h-4 w-4 mr-2" /> Start</>
              )}
            </Button>
          </div>
        </CardHeader>
        {currentSettings.isEnabled && (
          <CardContent>
            <div className="text-sm text-gray-300">
              Next scheduled search: in 2 hours • Daily limit: {currentSettings.dailyApplicationLimit} applications
            </div>
          </CardContent>
        )}
      </Card>

      {/* Main Tabs - Dark theme with accessible contrast */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-gray-800 border border-gray-600">
          <TabsTrigger value="search" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">Job Search</TabsTrigger>
          <TabsTrigger value="profile" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">Profile</TabsTrigger>
          <TabsTrigger value="settings" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">Settings</TabsTrigger>
          <TabsTrigger value="analytics" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="search" className="space-y-4">
          <JobFilters
            filters={currentSettings.filters}
            onChange={(newFilters) => {
              const newSettings = { ...currentSettings, filters: newFilters };
              setCurrentSettings(newSettings);
            }}
            onSearch={() => handleSearch(currentSettings.filters)}
            loading={searchLoading}
          />
          
          <JobListingTable
            jobs={jobListings}
            onApply={handleApply}
            onAnalyze={handleAnalyze}
            onView={handleView}
            loading={loading}
          />
        </TabsContent>
        
        <TabsContent value="profile" className="space-y-4">
          <ResumeUpload 
            onProfileExtracted={handleProfileExtracted}
            loading={loading}
          />
          
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Current Profile Summary</CardTitle>
              <CardDescription className="text-gray-300">Your extracted profile information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2 text-white">Contact Info</h4>
                  <p className="text-sm text-gray-300">{userProfile.name}</p>
                  <p className="text-sm text-gray-300">{userProfile.email}</p>
                  <p className="text-sm text-gray-300">{userProfile.location}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-white">Skills</h4>
                  <div className="flex flex-wrap gap-1">
                    {userProfile.skills.slice(0, 8).map((skill, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-600 text-white text-xs rounded border border-blue-500">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-4">
          <SettingsForm
            settings={currentSettings}
            onChange={handleSettingsChange}
            onSave={handleSettingsSave}
            loading={loading}
          />
        </TabsContent>
        
        <TabsContent value="analytics" className="space-y-4">
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Application Analytics</CardTitle>
              <CardDescription className="text-gray-300">Track your job search performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2 text-white">Applications by Status</h4>
                    <div className="space-y-2">
                      {Object.entries({
                        applied: 87,
                        pending: 23,
                        interview: 8,
                        rejected: 9
                      }).map(([status, count]) => (
                        <div key={status} className="flex justify-between items-center border-b border-gray-700 pb-1">
                          <span className="text-sm capitalize text-gray-300">{status}</span>
                          <span className="font-semibold text-white">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2 text-white">Top Job Portals</h4>
                    <div className="space-y-2">
                      {[{ name: 'LinkedIn', count: 45 }, { name: 'Indeed', count: 32 }, { name: 'Glassdoor', count: 28 }].map((portal) => (
                        <div key={portal.name} className="flex justify-between items-center border-b border-gray-700 pb-1">
                          <span className="text-sm text-gray-300">{portal.name}</span>
                          <span className="font-semibold text-white">{portal.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <Button onClick={downloadSummaryReport} className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-600">
                  <Download className="h-4 w-4 mr-2" />
                  Download Detailed Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
