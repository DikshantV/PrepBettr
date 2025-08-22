"use client";

import React, { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { UploadCloud, FileText, X } from 'lucide-react';
import BanterLoader from '@/components/ui/BanterLoader';
import { GlowingButton } from '@/components/ui/GlowingButton';
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
import { useTelemetry } from '@/components/providers/TelemetryProvider';

type UploadResponse = {
  success: boolean;
  data?: {
    message?: string;
    resumeId?: string;
    extractedData?: {
      personalInfo?: any;
      summary?: string;
      skills?: string[];
      experience?: any[];
      education?: any[];
      projects?: any[];
      certifications?: any[];
      languages?: any[];
    };
    interviewQuestions?: string[];
    storageProvider?: 'azure' | 'firebase';
    fileInfo?: {
      fileName: string;
      fileSize: number;
      mimeType: string;
      fileUrl: string;
      sasUrl?: string;
    };
  };
  error?: string;
}

interface PdfUploadButtonProps {
  onQuestionsGenerated?: (result: {
    questions: string[];
    fileUrl: string;
    resumeId: string;
    extractedData?: any;
  }) => void;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
  onResumeReplaced?: () => void;
}

const PdfUploadButton = ({ 
  onQuestionsGenerated, 
  onUploadStart, 
  onUploadEnd,
  onResumeReplaced 
}: PdfUploadButtonProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploaderRef = useRef<HTMLButtonElement>(null);
  const { trackResumeUpload, trackUserAction, trackError } = useTelemetry();

  // Handle upload start
  useItemStartListener(async (item) => {
    const uploadFile = item.file as File;
    
    // If there's an existing file, this means we're replacing it
    if (file) {
      console.log('🔄 Replacing existing resume file...');
      onResumeReplaced?.();
      
      // Track resume replacement
      await trackUserAction('resume_upload_replacement', 'resume_processing', {
        oldFileName: file.name,
        newFileName: uploadFile.name,
        oldFileSize: file.size.toString(),
        newFileSize: uploadFile.size.toString()
      });
    }
    
    setFile(uploadFile);
    setIsUploading(true);
    onUploadStart?.();
    
    // Track upload start
    await trackUserAction('resume_upload_start', 'resume_processing', {
      fileName: uploadFile.name,
      fileSize: uploadFile.size.toString(),
      fileType: uploadFile.type,
      isReplacement: (!!file).toString()
    });
  });

  // Handle upload progress
  useItemProgressListener((item) => {
    setUploadProgress(item.completed);
  });

  // Handle upload errors
  useItemErrorListener(async (item) => {
    setIsUploading(false);
    const error = item.uploadResponse?.data?.error || 'Failed to upload file';
    const errorMessage = typeof error === 'string' ? error : 'An unknown error occurred';
    
    toast.error('Upload failed', {
      description: errorMessage
    });
    
    // Track upload error
    await trackError(new Error(errorMessage), {
      action: 'resume_upload_error',
      fileName: file?.name || 'unknown',
      fileSize: file?.size.toString() || '0',
      uploadProgress: uploadProgress.toString()
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
    const endTime = Date.now();
    // Extract start time from item data or use end time as fallback
    const itemStartTime = (item as any).startTime || endTime;
    const processingTime = endTime - itemStartTime;
    
    try {
      const response = item.uploadResponse?.data as UploadResponse;
      
      if (response?.success) {
        const questions = response.data?.interviewQuestions || [];
        const extractedData = response.data?.extractedData;
        const fileUrl = response.data?.fileInfo?.fileUrl || '';
        const resumeId = response.data?.resumeId || '';
        
        if (questions.length > 0) {
          toast.success('Resume processed successfully!', {
            description: `Generated ${questions.length} interview questions`
          });
          
          // Track successful resume upload and processing
          if (file) {
            await trackResumeUpload(
              file.size,
              file.type,
              processingTime
            );
            
            await trackUserAction('resume_upload_success', 'resume_processing', {
              fileName: file.name,
              questionsGenerated: questions.length.toString(),
              processingTimeMs: processingTime.toString(),
              resumeId
            });
          }
          
          onQuestionsGenerated?.({
            questions,
            fileUrl,
            resumeId,
            extractedData
          });
        } else {
          toast.warning('Resume uploaded but no questions generated', {
            description: 'The resume was processed but might not contain enough relevant content for question generation.'
          });
          
          // Track upload with no questions generated
          await trackUserAction('resume_upload_no_questions', 'resume_processing', {
            fileName: file?.name || 'unknown',
            processingTimeMs: processingTime.toString(),
            resumeId
          });
          
          // Still call the callback with empty questions so UI knows upload succeeded
          onQuestionsGenerated?.({
            questions: [],
            fileUrl,
            resumeId,
            extractedData
          });
        }
      } else {
        throw new Error(response?.error || 'Failed to process resume');
      }
    } catch (error) {
      console.error('Error processing PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      
      toast.error('Failed to process PDF', {
        description: errorMessage
      });
      
      // Track processing error
      await trackError(error instanceof Error ? error : new Error(errorMessage), {
        action: 'resume_processing_error',
        fileName: file?.name || 'unknown',
        processingTimeMs: processingTime.toString()
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
      {isUploading && <BanterLoader overlay text="Uploading and Processing Resume..." />}
      <GlowingButton
        onClick={onClick}
        disabled={isUploading || isUploadingProp}
        size="sm"
        className="w-auto h-10"
        innerClassName={`${
          isUploading || isUploadingProp 
            ? 'bg-indigo-600 dark:bg-indigo-700' 
            : 'bg-slate-950 dark:bg-slate-900 hover:bg-slate-800 dark:hover:bg-slate-800'
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
      </GlowingButton>

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
        if (user && auth && auth.currentUser) {
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
        url: '/api/resume/upload',
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
