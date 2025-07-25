"use client";

import React, { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { UploadCloud, FileText, X } from 'lucide-react';
import BanterLoader from '@/components/ui/BanterLoader';
import { motion, AnimatePresence } from 'framer-motion';
import Uploady, { 
  useItemProgressListener, 
  useItemErrorListener, 
  useItemFinalizeListener,
  useItemStartListener,
  useItemAbortListener
} from '@rpldy/uploady';
import { asUploadButton } from '@rpldy/upload-button';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/firebase/client';

type UploadResponse = {
  success: boolean;
  data?: {
    questions?: string[];
    fileUrl?: string;
    docId?: string;
  };
  error?: string;
}

interface PdfUploadButtonProps {
  onQuestionsGenerated?: (result: {
    questions: string[];
    fileUrl: string;
    docId: string;
  }) => void;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
}

const PdfUploadButton = ({ 
  onQuestionsGenerated, 
  onUploadStart, 
  onUploadEnd 
}: PdfUploadButtonProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploaderRef = useRef<HTMLButtonElement>(null);

  // Handle upload start
  useItemStartListener((item) => {
    setFile(item.file as File);
    setIsUploading(true);
    onUploadStart?.();
  });

  // Handle upload progress
  useItemProgressListener((item) => {
    setUploadProgress(item.completed);
  });

  // Handle upload errors
  useItemErrorListener((item) => {
    setIsUploading(false);
    const error = item.uploadResponse?.data?.error || 'Failed to upload file';
    toast.error('Upload failed', {
      description: typeof error === 'string' ? error : 'An unknown error occurred'
    });
    setFile(null);
    setUploadProgress(0);
    onUploadEnd?.();
  });

  // Handle upload abort
  useItemAbortListener(() => {
    setIsUploading(false);
    setFile(null);
    setUploadProgress(0);
    onUploadEnd?.();
  });

  // Handle successful upload
  useItemFinalizeListener(async (item) => {
    try {
      const response = item.uploadResponse?.data as UploadResponse;
      
      if (response?.success) {
        const questions = response.data?.questions;
        if (questions?.length) {
          toast.success('Document processed successfully!');
          onQuestionsGenerated?.({
            questions,
            fileUrl: response.data?.fileUrl || '',
            docId: response.data?.docId || ''
          });
        } else {
          toast.warning('No questions were generated', {
            description: 'The PDF might not contain enough content or the content might not be suitable for question generation.'
          });
        }
      } else {
        throw new Error(response?.error || 'Failed to process PDF');
      }
    } catch (error) {
      console.error('Error processing PDF:', error);
      toast.error('Failed to process PDF', {
        description: error instanceof Error ? error.message : 'An unknown error occurred'
      });
    } finally {
      setIsUploading(false);
      onUploadEnd?.();
    }
  });

  const removeFile = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setUploadProgress(0);
    setIsUploading(false);
    
    // If you want to abort the current upload when removing the file
    interface WindowWithUploader extends Window {
      RPyldyUploader?: {
        abortAll: () => void;
      };
    }
    const uploader = (window as WindowWithUploader).RPyldyUploader;
    if (uploader) {
      uploader.abortAll();
    }
  }, []);

  // Custom button component for Uploady
  const CustomUploadButton = asUploadButton(({ onClick, isUploading: isUploadingProp }: { onClick: () => void, isUploading: boolean }) => (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={isUploading || isUploadingProp}
        className={`p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm ${
          isUploading || isUploadingProp ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : ''
        }`}
        aria-label="Upload resume/CV"
        title="Upload resume/CV (PDF)"
        ref={uploaderRef}
      >
        {isUploading || isUploadingProp ? (
          <BanterLoader />
        ) : (
          <UploadCloud className="w-6 h-6" />
        )}
      </button>

      <AnimatePresence>
        {file && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-0 z-10 mt-2 w-64 origin-top-right rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          >
            <div className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                    {file.name}
                  </span>
                </div>
                <div className="flex items-center">
                  {isUploading ? (
                    <BanterLoader />
                  ) : (
                    <button
                      type="button"
                      onClick={removeFile}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1 -mr-1"
                      aria-label="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                <div 
                  className="h-1.5 rounded-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ));

  return <CustomUploadButton />;
};

// Main component with Uploady provider
export default function PdfUploadButtonWrapper(props: PdfUploadButtonProps) {
  const { user } = useAuth();
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
  });

  // Update headers with auth token when user changes
  React.useEffect(() => {
    const updateAuthHeaders = async () => {
      try {
        if (user && auth.currentUser) {
          const idToken = await auth.currentUser.getIdToken();
          setAuthHeaders(prev => ({
            ...prev,
            'Authorization': `Bearer ${idToken}`
          }));
        } else {
          // Remove auth header if no user
          setAuthHeaders(prev => {
            const { Authorization, ...rest } = prev;
            return rest;
          });
        }
      } catch (error) {
        console.error('Error getting auth token:', error);
        // Continue without auth token - server will handle development mode
      }
    };

    updateAuthHeaders();
  }, [user]);

  return (
    <Uploady
      destination={{ 
        url: '/api/upload-pdf',
        headers: authHeaders
      }}
      accept="application/pdf"
      multiple={false}
      autoUpload={true}
      inputFieldName="file"
      fileFilter={(file: File | string) => {
        // Additional client-side validation
        if (typeof file === 'string') {
          return false;
        }
        const isValid = file.type === 'application/pdf';
        if (!isValid) {
          toast.error('Invalid file type', {
            description: 'Please upload a PDF file'
          });
        }
        return isValid;
      }}
      formatServerResponse={(_response: string | UploadResponse) => {
        try {
          const response = typeof _response === 'string' ? JSON.parse(_response) : _response;
          return {
            success: response.success !== false,
            data: response.data || response,
            error: response.error
          };
        } catch (e) {
          console.error('Error parsing server response:', e);
          return {
            success: false,
            error: 'Invalid server response format',
            data: {}
          };
        }
      }}
      maxGroupSize={1}
      clearPendingOnAdd={true}
      forceJsonResponse={true}
    >
      <PdfUploadButton {...props} />
    </Uploady>
  );
}
