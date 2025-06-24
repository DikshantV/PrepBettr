"use client";

import { useState, useRef, ChangeEvent } from 'react';
import { toast } from 'sonner';

interface PdfUploadButtonProps {
  onQuestionsGenerated?: (result: {
    questions: string[];
    fileUrl: string;
    docId: string;
  }) => void;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
}

export default function PdfUploadButton({ 
  onQuestionsGenerated, 
  onUploadStart, 
  onUploadEnd 
}: PdfUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if a file is PDF
    if (file.type !== 'application/pdf') {
      toast.error('Invalid file type', {
        description: 'Please upload a PDF file'
      });
      return;
    }

    try {
      setIsUploading(true);
      onUploadStart?.();
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process PDF');
      }
      
      const data = await response.json();
      
      if (data.questions && data.questions.length > 0) {
        toast.success('Document processed successfully!');
        onQuestionsGenerated?.({
          questions: data.questions,
          fileUrl: data.fileUrl,
          docId: data.docId
        });
      } else {
        toast.warning('No questions were generated', {
          description: 'The PDF might not contain enough content or the content might not be suitable for question generation.'
        });
      }
      
    } catch (error) {
      console.error('Error processing PDF:', error);
      toast.error('Failed to process PDF', {
        description: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setIsUploading(false);
      onUploadEnd?.();
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
          isUploading 
            ? 'bg-gray-400' 
            : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
        }`}
        aria-label={isUploading ? 'Processing...' : 'Upload PDF'}
      >
        {isUploading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          <>
            <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Resume/CV
          </>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
        aria-label="Upload PDF"
      />
    </div>
  );
}
