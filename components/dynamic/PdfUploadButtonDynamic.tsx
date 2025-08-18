"use client";

import dynamic from 'next/dynamic';
import { UploadCloud } from 'lucide-react';

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

const PdfUploadButton = dynamic(
  () => import('../PdfUploadButtonWrapper'),
  { 
    ssr: false,
    loading: () => (
      <div className="relative">
        <button
          type="button"
          disabled
          className="p-2 text-gray-400 border border-gray-600 rounded-lg bg-gray-800 cursor-not-allowed opacity-50"
          aria-label="Loading upload button..."
          title="Loading upload button..."
        >
          <UploadCloud className="w-6 h-6 animate-pulse" />
        </button>
      </div>
    )
  }
);

export default function PdfUploadButtonDynamic(props: PdfUploadButtonProps) {
  return <PdfUploadButton {...props} />;
}
