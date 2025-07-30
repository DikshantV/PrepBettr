import React, { useState } from 'react';
import { ResumeUploadProps } from '@/types/auto-apply';
import { Button } from '@/components/ui/button';
import BanterLoader from '@/components/ui/BanterLoader';
import { useUsageActions } from '@/hooks/useUsageActions';
import { toast } from 'sonner';

export const ResumeUpload: React.FC<ResumeUploadProps> = ({ onProfileExtracted, loading }) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    if (file) {
      setFile(file);
      setError(null);
    }
  };

  const { incrementUsageOptimistic, incrementUsage, canUseFeature } = useUsageActions();

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    // Check if user can use this feature
    if (!canUseFeature('resumeTailor')) {
      toast.error("You've reached your Resume Tailor limit. Upgrade your plan for more usage.");
      return;
    }

    try {
      // Optimistically increment usage for immediate UI feedback
      incrementUsageOptimistic('resumeTailor');

      const formData = new FormData();
      formData.append('file', file);

      // TODO: Implement actual API call to upload the resume and extract the profile
      // For now, immediately extract mock profile data
      onProfileExtracted({ skills: ['JavaScript', 'React'], experience: [] }); // Mock response
      setError(null);

      // Sync usage increment with server (no need to wait for this)
      incrementUsage('resumeTailor').catch(err => {
        console.error('Failed to sync usage with server:', err);
      });

    } catch (err) {
      setError('Failed to upload the file. Please try again.');
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg shadow-md space-y-4">
      <h3 className="text-lg font-semibold text-white">Upload Your Resume</h3>
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-1">Select a PDF file</label>
        <input 
          type="file" 
          accept=".pdf" 
          onChange={handleFileChange} 
          className="w-full text-gray-300 bg-gray-800 border border-gray-600 rounded-md p-2 file:mr-4 file:py-1 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500" 
        />
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>
      <Button onClick={handleUpload} disabled={loading || !file} className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-600 disabled:bg-gray-700 disabled:text-gray-400">
        {loading && <BanterLoader className="mr-2" />}
        {loading ? 'Uploading...' : 'Upload and Extract'}</Button>
    </div>
  );
};

