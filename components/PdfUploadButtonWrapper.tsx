"use client";

import dynamic from "next/dynamic";

// Dynamic import for PdfUploadButton component that requires DOM and framer-motion APIs
const PdfUploadButton = dynamic(() => import('./PdfUploadButton'), {
  ssr: false,
  loading: () => (
    <div className="relative">
      <button
        type="button"
        disabled
        className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 transition-colors shadow-sm animate-pulse"
        aria-label="Upload resume/CV"
        title="Loading upload component..."
      >
        <div className="w-6 h-6 bg-gray-400 dark:bg-gray-500 rounded animate-pulse"></div>
      </button>
    </div>
  )
});

// Re-export component interface for external use
interface PdfUploadButtonProps {
  onQuestionsGenerated?: (result: {
    questions: string[];
    fileUrl: string;
    docId: string;
  }) => void;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
}

export type { PdfUploadButtonProps };

export default PdfUploadButton;
