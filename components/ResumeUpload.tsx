import React, { useState } from 'react';
import { ResumeUploadProps } from '@/types/auto-apply';
import { Button } from '@/components/ui/button';
import BanterLoader from '@/components/ui/BanterLoader';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';

export const ResumeUpload: React.FC<ResumeUploadProps> = ({ onProfileExtracted, loading }) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files ? event.target.files[0] : null;
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size cannot exceed 10MB.');
        toast.error('File size cannot exceed 10MB.');
        setFile(null);
      } else {
        setFile(selectedFile);
        setError(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      toast.warning('Please select a file to upload.');
      return;
    }

    if (!user) {
      setError('You must be logged in to upload a resume.');
      toast.error('Authentication error. Please log in again.');
      return;
    }

    // Get auth token from localStorage
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setError('Authentication token not found. Please log in again.');
      toast.error('Authentication error. Please log in again.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Resume uploaded and processed successfully!');
        onProfileExtracted(result.extractedData);
        console.log('File uploaded to:', result.fileUrl);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      const errorMessage = (err as Error).message || 'Failed to upload the file. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
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
      <Button onClick={handleUpload} disabled={loading || isUploading || !file} className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-600 disabled:bg-gray-700 disabled:text-gray-400">
        {(loading || isUploading) && <BanterLoader className="mr-2" />}
        {(loading || isUploading) ? 'Uploading...' : 'Upload and Extract'}</Button>
    </div>
  );
};

