import React from 'react';
import { JobFiltersProps, JobSearchFilters } from '@/types/auto-apply';
import { Button } from '@/components/ui/button';

export const JobFilters: React.FC<JobFiltersProps> = ({ filters, onChange, onSearch, loading }) => {
  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const keywords = e.target.value.split(',').map(keyword => keyword.trim()).filter(Boolean);
    onChange({
      ...filters,
      keywords,
    });
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const locations = e.target.value.split(',').map(location => location.trim()).filter(Boolean);
    onChange({
      ...filters,
      locations,
    });
  };

  const handleJobTypeChange = (jobType: string, checked: boolean) => {
    const newJobTypes = checked
      ? [...filters.jobTypes, jobType as any]
      : filters.jobTypes.filter(type => type !== jobType);
    onChange({
      ...filters,
      jobTypes: newJobTypes,
    });
  };

  const handleWorkArrangementChange = (arrangement: string, checked: boolean) => {
    const newArrangements = checked
      ? [...filters.workArrangements, arrangement as any]
      : filters.workArrangements.filter(arr => arr !== arrangement);
    onChange({
      ...filters,
      workArrangements: newArrangements,
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Job Search Filters</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
          <input
            type="text"
            placeholder="React, JavaScript, Python..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={handleKeywordChange}
            value={filters.keywords.join(', ')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Locations</label>
          <input
            type="text"
            placeholder="New York, Remote, San Francisco..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={handleLocationChange}
            value={filters.locations.join(', ')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Posted</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.datePosted}
            onChange={(e) => onChange({ ...filters, datePosted: e.target.value as any })}
          >
            <option value="any">Any time</option>
            <option value="past-24-hours">Past 24 hours</option>
            <option value="past-week">Past week</option>
            <option value="past-month">Past month</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
          <div className="space-y-2">
            {['full-time', 'part-time', 'contract', 'internship'].map((type) => (
              <label key={type} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.jobTypes.includes(type as any)}
                  onChange={(e) => handleJobTypeChange(type, e.target.checked)}
                  className="mr-2"
                />
                <span className="capitalize">{type.replace('-', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Work Arrangement</label>
          <div className="space-y-2">
            {['remote', 'hybrid', 'onsite'].map((arrangement) => (
              <label key={arrangement} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.workArrangements.includes(arrangement as any)}
                  onChange={(e) => handleWorkArrangementChange(arrangement, e.target.checked)}
                  className="mr-2"
                />
                <span className="capitalize">{arrangement}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Relevancy Score</label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.minimumRelevancyScore}
          onChange={(e) => onChange({ ...filters, minimumRelevancyScore: parseInt(e.target.value) })}
          className="w-full"
        />
        <span className="text-sm text-gray-500">{filters.minimumRelevancyScore}%</span>
      </div>

      <Button onClick={onSearch} disabled={loading} className="w-full">
        {loading ? 'Searching...' : 'Search Jobs'}
      </Button>
    </div>
  );
};
