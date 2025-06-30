"use client";

import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { UploadCloud, FileText, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [file, setFile] = useState<File | null>(null);
  const [, setIsDragging] = useState(false);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const pdfFile = acceptedFiles[0];
    if (!pdfFile) return;

    // Check if file is PDF
    if (pdfFile.type !== 'application/pdf') {
      toast.error('Invalid file type', {
        description: 'Please upload a PDF file'
      });
      return;
    }

    setFile(pdfFile);
    await handleFileUpload(pdfFile);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    multiple: false,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDropAccepted: () => setIsDragging(false),
    onDropRejected: () => {
      setIsDragging(false);
      toast.error('Invalid file', {
        description: 'Please upload a valid PDF file'
      });
    },
  });

  const handleFileUpload = async (fileToUpload: File) => {
    try {
      setIsUploading(true);
      onUploadStart?.();
      
      const formData = new FormData();
      formData.append('file', fileToUpload);
      
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
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  return (
    <div className="relative">
      <div 
        {...getRootProps()} 
        ref={dropzoneRef}
        className="flex items-center"
      >
        <input {...getInputProps()} />
        <button
          type="button"
          className={`p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm ${
            isDragActive ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : ''
          }`}
          aria-label="Upload resume/CV"
          title="Upload resume/CV (PDF)"
        >
          {isUploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <UploadCloud className="w-6 h-6" />
          )}
        </button>
      </div>

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
                    <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin ml-2" />
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile();
                      }}
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
                  className={`h-1.5 rounded-full ${
                    isUploading ? 'bg-indigo-500 w-3/4' : 'bg-green-500 w-full'
                  }`}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
