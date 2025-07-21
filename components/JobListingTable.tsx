import React from 'react';
import { JobListing, JobListingTableProps, APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from '@/types/auto-apply';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, BarChart3, Zap, Eye, Loader2 } from 'lucide-react';

export const JobListingTable: React.FC<JobListingTableProps> = ({ jobs, onApply, onAnalyze, onView, loading, pagination }) => {
  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="text-gray-400 mb-4">
            <BarChart3 className="h-12 w-12" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs found</h3>
          <p className="text-gray-600 text-center max-w-md">
            Try adjusting your search filters or keywords to find more relevant positions.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatSalary = (salary: JobListing['salary']) => {
    if (!salary) return 'Not specified';
    const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);
    const min = salary.min ? formatNumber(salary.min) : '';
    const max = salary.max ? formatNumber(salary.max) : '';
    const range = min && max ? `${min} - ${max}` : min || max || 'Not specified';
    return `${salary.currency} ${range}/${salary.period}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    // Use consistent date format to avoid hydration mismatch
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: JobListing['applicationStatus']) => {
    const colors = {
      'discovered': 'bg-blue-100 text-blue-800',
      'analyzing': 'bg-yellow-100 text-yellow-800',
      'ready_to_apply': 'bg-green-100 text-green-800',
      'applying': 'bg-orange-100 text-orange-800',
      'applied': 'bg-purple-100 text-purple-800',
      'application_viewed': 'bg-indigo-100 text-indigo-800',
      'interview_request': 'bg-emerald-100 text-emerald-800',
      'rejected': 'bg-red-100 text-red-800',
      'withdrawn': 'bg-gray-100 text-gray-800',
      'expired': 'bg-gray-100 text-gray-600'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getRelevancyColor = (score?: number) => {
    if (!score) return 'text-gray-600';
    if (score >= 85) return 'text-green-600 font-semibold';
    if (score >= 70) return 'text-blue-600 font-medium';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Job Opportunities ({jobs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr className="text-left">
                <th className="px-4 py-3 text-sm font-medium text-gray-700">Job Details</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700">Company</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700">Portal</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700">Match Score</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                  {/* Job Details */}
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="font-medium text-gray-900 text-sm">{job.title}</div>
                      <div className="text-xs text-gray-500">
                        {job.location} • {job.workArrangement}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatSalary(job.salary)}
                      </div>
                      <div className="text-xs text-gray-400">
                        Posted {formatDate(job.postedDate)}
                      </div>
                    </div>
                  </td>
                  
                  {/* Company */}
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-gray-900">{job.company}</div>
                    <div className="text-xs text-gray-500 capitalize">{job.jobType}</div>
                  </td>
                  
                  {/* Portal */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{job.jobPortal.name}</div>
                      {job.jobPortal.supportsAutoApply && (
                        <Badge variant="secondary" className="text-xs">
                          Auto-Apply
                        </Badge>
                      )}
                    </div>
                  </td>
                  
                  {/* Match Score */}
                  <td className="px-4 py-4">
                    <div className={`text-sm font-semibold ${getRelevancyColor(job.relevancyScore)}`}>
                      {job.relevancyScore ? `${job.relevancyScore}%` : 'N/A'}
                    </div>
                    {job.matchedSkills && job.matchedSkills.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {job.matchedSkills.slice(0, 2).join(', ')}
                        {job.matchedSkills.length > 2 && ` +${job.matchedSkills.length - 2}`}
                      </div>
                    )}
                  </td>
                  
                  {/* Status */}
                  <td className="px-4 py-4">
                    <Badge className={`text-xs ${getStatusColor(job.applicationStatus)}`}>
                      {job.applicationStatus === 'applying' && (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      )}
                      {APPLICATION_STATUS_LABELS[job.applicationStatus] || job.applicationStatus}
                    </Badge>
                  </td>
                  
                  {/* Actions */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(job.id)}
                        className="h-8 w-8 p-0"
                        title="View job posting"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      
                      {job.applicationStatus === 'discovered' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onAnalyze(job.id)}
                          className="h-8 w-8 p-0"
                          title="Analyze job match"
                          disabled={loading}
                        >
                          <BarChart3 className="h-3 w-3" />
                        </Button>
                      )}
                      
                      {(job.applicationStatus === 'ready_to_apply' || job.applicationStatus === 'analyzing') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onApply(job.id)}
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-800"
                          title="Apply to job"
                          disabled={loading || job.applicationStatus === 'applying'}
                        >
                          {job.applicationStatus === 'applying' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(job.originalUrl, '_blank')}
                        className="h-8 w-8 p-0"
                        title="Open original job posting"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {pagination && (
          <div className="border-t px-4 py-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {Math.min(pagination.pageSize, jobs.length)} of {pagination.total} jobs
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => pagination.onChange(pagination.current - 1)}
                disabled={pagination.current <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-700">
                Page {pagination.current} of {Math.ceil(pagination.total / pagination.pageSize)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pagination.onChange(pagination.current + 1)}
                disabled={pagination.current >= Math.ceil(pagination.total / pagination.pageSize)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

