"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, Search, Settings, BarChart3, Download, Upload, Play, Pause, 
  AlertTriangle, CheckCircle, Clock, Eye, TrendingUp, CreditCard,
  Activity, Globe, Zap, RefreshCw, X, ExternalLink
} from 'lucide-react';

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

// Real-time application tracking interface
interface ApplicationUpdate {
  id: string;
  status: 'in_progress' | 'success' | 'failed' | 'retry';
  portal: string;
  jobTitle: string;
  company: string;
  timestamp: string;
  errorMessage?: string;
  screenshotUrl?: string;
  duration?: number;
}

// TheirStack credit monitoring interface
interface CreditUsage {
  used: number;
  total: number;
  percentage: number;
  monthlyReset: string;
  lastUpdated: string;
}

// Real-time statistics interface
interface RealTimeStats {
  totalApplications: number;
  todayApplications: number;
  weeklyApplications: number;
  pendingApplications: number;
  interviewRequests: number;
  averageRelevancyScore: number;
  successRate: number;
  portalStats: {
    linkedin: { applications: number; successRate: number };
    indeed: { applications: number; successRate: number };
    theirstack: { applications: number; successRate: number };
    generic: { applications: number; successRate: number };
  };
  creditUsage: CreditUsage;
}

export const AutoApplyDashboard: React.FC<AutoApplyDashboardProps> = ({ userProfile, settings }) => {
  const [jobListings, setJobListings] = useState<JobListing[]>(mockJobs);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [currentSettings, setCurrentSettings] = useState<AutoApplySettings>(settings);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Real-time state management
  const [realTimeStats, setRealTimeStats] = useState<RealTimeStats>({
    totalApplications: 0,
    todayApplications: 0,
    weeklyApplications: 0,
    pendingApplications: 0,
    interviewRequests: 0,
    averageRelevancyScore: 0,
    successRate: 0,
    portalStats: {
      linkedin: { applications: 0, successRate: 0 },
      indeed: { applications: 0, successRate: 0 },
      theirstack: { applications: 0, successRate: 0 },
      generic: { applications: 0, successRate: 0 }
    },
    creditUsage: {
      used: 0,
      total: 1000,
      percentage: 0,
      monthlyReset: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    }
  });
  
  const [applicationUpdates, setApplicationUpdates] = useState<ApplicationUpdate[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      // Connect to our production Azure Function WebSocket endpoint
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://prepbettr-auto-apply.azurewebsites.net/ws';
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('🔗 WebSocket connected to auto-apply service');
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      wsRef.current.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt reconnection after delay
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 5000);
        }
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      setIsConnected(false);
    }
  }, []);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    setLastUpdate(new Date());
    
    switch (data.type) {
      case 'application_update':
        setApplicationUpdates(prev => [data.payload, ...prev.slice(0, 19)]); // Keep last 20
        break;
        
      case 'stats_update':
        setRealTimeStats(prev => ({ ...prev, ...data.payload }));
        break;
        
      case 'credit_usage':
        setRealTimeStats(prev => ({
          ...prev,
          creditUsage: data.payload
        }));
        break;
        
      case 'job_listings_update':
        setJobListings(data.payload);
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  }, []);

  // Load initial data from API
  const loadInitialData = useCallback(async () => {
    try {
      // Load real-time statistics
      const statsResponse = await fetch('/api/auto-apply/stats');
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setRealTimeStats(stats);
      }

      // Load recent application updates
      const updatesResponse = await fetch('/api/auto-apply/recent-updates');
      if (updatesResponse.ok) {
        const updates = await updatesResponse.json();
        setApplicationUpdates(updates);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }, []);

  // Initialize WebSocket and load data on mount
  useEffect(() => {
    loadInitialData();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket, loadInitialData]);

  // View screenshot for failed applications
  const viewScreenshot = (screenshotUrl: string) => {
    window.open(screenshotUrl, '_blank');
  };

  // Clear application update
  const dismissUpdate = (updateId: string) => {
    setApplicationUpdates(prev => prev.filter(update => update.id !== updateId));
  };

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
      setRealTimeStats(prev => ({ ...prev, totalApplications: prev.totalApplications + 1 }));
      
    } catch (error) {
      console.error('Application failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (jobId: string) => {
    setLoading(true);
    try {
      // TODO: Implement actual job analysis with Azure OpenAI
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
      stats: realTimeStats,
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
            <div className="text-2xl font-bold text-white">{realTimeStats.totalApplications}</div>
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
            <div className="text-2xl font-bold text-white">{realTimeStats.pendingApplications}</div>
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
            <div className="text-2xl font-bold text-white">{realTimeStats.interviewRequests}</div>
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
            <div className="text-2xl font-bold text-white">{realTimeStats.averageRelevancyScore}%</div>
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

      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-gray-400">
          {isConnected ? 'Connected to auto-apply service' : 'Disconnected'}
        </span>
        <span className="text-gray-500">•</span>
        <span className="text-gray-500">Last update: {lastUpdate.toLocaleTimeString()}</span>
      </div>

      {/* TheirStack Credit Warning */}
      {realTimeStats.creditUsage.percentage >= 80 && (
        <Alert className="bg-yellow-900 border-yellow-600">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-100">
            <strong>TheirStack Credit Warning:</strong> You have used {realTimeStats.creditUsage.percentage}% 
            ({realTimeStats.creditUsage.used}/{realTimeStats.creditUsage.total}) of your monthly credits. 
            Credits reset on {new Date(realTimeStats.creditUsage.monthlyReset).toLocaleDateString()}.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs - Enhanced with dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-gray-800 border border-gray-600">
          <TabsTrigger value="dashboard" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">Dashboard</TabsTrigger>
          <TabsTrigger value="search" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">Job Search</TabsTrigger>
          <TabsTrigger value="profile" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">Profile</TabsTrigger>
          <TabsTrigger value="settings" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">Settings</TabsTrigger>
          <TabsTrigger value="analytics" className="text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="space-y-4">
          {/* Real-time Statistics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">Total Applications</CardTitle>
                <Activity className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{realTimeStats.totalApplications}</div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>Today: {realTimeStats.todayApplications}</span>
                  <span>•</span>
                  <span>Week: {realTimeStats.weeklyApplications}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">Pending</CardTitle>
                <Clock className="h-4 w-4 text-yellow-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{realTimeStats.pendingApplications}</div>
                <p className="text-xs text-gray-400">
                  Awaiting response
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">Interviews</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{realTimeStats.interviewRequests}</div>
                <p className="text-xs text-gray-400">
                  {realTimeStats.successRate}% success rate
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-white">Avg. Relevancy</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{realTimeStats.averageRelevancyScore}%</div>
                <Progress value={realTimeStats.averageRelevancyScore} className="mt-2 bg-gray-700" />
              </CardContent>
            </Card>
          </div>

          {/* TheirStack Credit Usage */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <CreditCard className="h-5 w-5 text-green-400" />
                TheirStack Credit Usage
              </CardTitle>
              <CardDescription className="text-gray-300">
                Monthly credit consumption for job portal access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Used Credits</span>
                  <span className="text-sm font-semibold text-white">
                    {realTimeStats.creditUsage.used} / {realTimeStats.creditUsage.total}
                  </span>
                </div>
                <Progress 
                  value={realTimeStats.creditUsage.percentage} 
                  className="bg-gray-700"
                />
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <span>{realTimeStats.creditUsage.percentage}% used</span>
                  <span>Resets: {new Date(realTimeStats.creditUsage.monthlyReset).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Portal Performance */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Globe className="h-5 w-5 text-blue-400" />
                Job Portal Performance
              </CardTitle>
              <CardDescription className="text-gray-300">
                Applications and success rates by platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(realTimeStats.portalStats).map(([portal, stats]) => (
                  <div key={portal} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        portal === 'linkedin' ? 'bg-blue-500' :
                        portal === 'indeed' ? 'bg-blue-600' :
                        portal === 'theirstack' ? 'bg-green-500' :
                        'bg-gray-500'
                      }`} />
                      <span className="text-sm font-medium text-white capitalize">{portal}</span>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div>Applications: <span className="text-white">{stats.applications}</span></div>
                      <div>Success: <span className="text-white">{stats.successRate}%</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Real-time Application Updates */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Zap className="h-5 w-5 text-yellow-400" />
                Live Application Updates
                {applicationUpdates.length > 0 && (
                  <Badge variant="secondary" className="bg-blue-600 text-white">
                    {applicationUpdates.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-gray-300">
                Real-time status of application submissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {applicationUpdates.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No recent application updates</p>
                  <p className="text-xs">Updates will appear here when auto-apply is active</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {applicationUpdates.map((update) => (
                    <div key={update.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-800 border border-gray-600">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        update.status === 'success' ? 'bg-green-500' :
                        update.status === 'failed' ? 'bg-red-500' :
                        update.status === 'in_progress' ? 'bg-yellow-500' :
                        'bg-blue-500'
                      }`} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white truncate">
                            {update.jobTitle} at {update.company}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs border ${
                              update.status === 'success' ? 'border-green-500 text-green-400' :
                              update.status === 'failed' ? 'border-red-500 text-red-400' :
                              update.status === 'in_progress' ? 'border-yellow-500 text-yellow-400' :
                              'border-blue-500 text-blue-400'
                            }`}
                          >
                            {update.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{update.portal}</span>
                          <span>•</span>
                          <span>{new Date(update.timestamp).toLocaleTimeString()}</span>
                          {update.duration && (
                            <>
                              <span>•</span>
                              <span>{update.duration}s</span>
                            </>
                          )}
                        </div>
                        
                        {update.errorMessage && (
                          <div className="mt-2 text-xs text-red-400">
                            Error: {update.errorMessage}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {update.screenshotUrl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => viewScreenshot(update.screenshotUrl!)}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => dismissUpdate(update.id)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  onClick={() => setActiveTab('search')} 
                  className="w-full justify-start bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search New Jobs
                </Button>
                <Button 
                  onClick={() => setActiveTab('settings')} 
                  className="w-full justify-start bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Update Preferences
                </Button>
                <Button 
                  onClick={downloadSummaryReport} 
                  className="w-full justify-start bg-gray-800 hover:bg-gray-700 text-white border-gray-600"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Report
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">System Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Auto-Apply Engine</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${currentSettings.isEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-xs text-gray-400">
                      {currentSettings.isEnabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">WebSocket Connection</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-xs text-gray-400">
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">TheirStack API</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-gray-400">Operational</span>
                  </div>
                </div>
                
                <Button 
                  onClick={connectWebSocket} 
                  size="sm" 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Connection
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
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
