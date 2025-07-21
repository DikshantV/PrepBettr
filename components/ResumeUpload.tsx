import React, { useState } from 'react';
import { ResumeUploadProps } from '@/types/auto-apply';
import { Button } from '@/components/ui/button';

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

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', file);

      // TODO: Implement actual API call to upload the resume and extract the profile
      // For now, immediately extract mock profile data
      onProfileExtracted({ skills: ['JavaScript', 'React'], experience: [] }); // Mock response
      setError(null);
    } catch (err) {
      setError('Failed to upload the file. Please try again.');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Upload Your Resume</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Select a PDF file</label>
        <input type="file" accept=".pdf" onChange={handleFileChange} className="w-full" />
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
      <Button onClick={handleUpload} disabled={loading || !file} className="w-full">
        {loading ? 'Uploading...' : 'Upload and Extract'}</Button>
    </div>
  );
};

