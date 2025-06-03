"use client";

import { useState, useEffect, useRef } from 'react';
import PdfUploadButton from './PdfUploadButton';
import dynamic from 'next/dynamic';
import * as monaco from 'monaco-editor';

// Dynamically import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react'),
  { ssr: false }
);

interface CodeEditorProps {
  initialValue?: string;
  language?: string;
  onChange?: (value: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const CodeEditor = ({ 
  initialValue = '// Write your code here\n', 
  language = 'javascript',
  onChange,
  isExpanded: propIsExpanded = false,
  onToggleExpand
}: CodeEditorProps) => {
  const [isMounted, setIsMounted] = useState(false);
  const [code, setCode] = useState(initialValue);
  const [isExpanded, setIsExpanded] = useState(propIsExpanded);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Sync with the parent component's state
  useEffect(() => {
    setIsExpanded(propIsExpanded);
  }, [propIsExpanded]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleToggleExpand = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    if (onToggleExpand) {
      onToggleExpand();
    }
  };

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  };

  const handleEditorChange = (value: string | undefined) => {
    const newValue = value || '';
    setCode(newValue);
    if (onChange) {
      onChange(newValue);
    }
  };

  if (!isMounted || !isExpanded) {
    return null;
  }

  return (
    <div className="relative border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="transition-all duration-300 h-[500px]">
        <MonacoEditor
          height="100%"
          defaultLanguage={language}
          language={language}
          theme="vs-dark"
          value={code}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 10 },
          }}
        />
      <div className="flex justify-between items-center mb-2">
        <div className="flex space-x-2">
          <button
            onClick={handleToggleExpand}
            className="p-2 rounded-full border border-gray-300 dark:border-gray-700 shadow hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg className="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v9m-5 0H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-2M8 9l4-5 4 5m1 8h.01"/>
            </svg>
          </button>
          <PdfUploadButton />
        </div>
      </div>
      </div>
    </div>
  );
};

export default CodeEditor;
