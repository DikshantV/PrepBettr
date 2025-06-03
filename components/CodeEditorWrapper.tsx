'use client';

import dynamic from 'next/dynamic';

const CodeEditor = dynamic(
  () => import('@/components/CodeEditor'),
  { 
    ssr: false,
    loading: () => <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
      <div className="animate-pulse text-gray-500">Loading editor...</div>
    </div>
  }
);

interface CodeEditorWrapperProps {
  initialValue?: string;
  language?: string;
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const CodeEditorWrapper = ({ 
  initialValue = "// Write your code here", 
  language = "javascript",
  className = "",
  isExpanded = true,
  onToggleExpand
}: CodeEditorWrapperProps) => {
  return (
    <div className={className}>
      <CodeEditor 
        initialValue={initialValue} 
        language={language} 
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
      />
    </div>
  );
};

export default CodeEditorWrapper;
