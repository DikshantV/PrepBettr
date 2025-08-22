"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import Agent from "@/components/Agent";
import { CodeEditorWrapper } from "@/components/CodeEditorWrapper";
// Removed server-only import - auth handled by middleware and client auth state
import PdfUploadButton from "@/components/dynamic/PdfUploadButtonDynamic";
import { ResumePromptToast, useResumePromptToast } from "@/components/ResumePromptToast";
import BanterLoader from "@/components/ui/BanterLoader";

const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'ruby', label: 'Ruby' },
];

interface User {
  id: string;
  name: string;
  email: string;
}

interface ResumeData {
  questions: string[];
  fileUrl: string;
  resumeId: string;
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
}

const Page = () => {
    const router = useRouter();
    const [isEditorExpanded, setIsEditorExpanded] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState('javascript');
    const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [resumeData, setResumeData] = useState<ResumeData | null>(null);
    
    // Resume prompt toast state
    const { show: showToast, hideToast, showToast: showPromptToast } = useResumePromptToast(false);

    useEffect(() => {
        // Check for user auth via API call instead of direct import
        const fetchUser = async () => {
            try {
                const response = await fetch('/api/auth/user');
                if (!response.ok) {
                    router.push('/sign-in');
                    return;
                }
                
                const userData = await response.json();
                if (!userData.user) {
                    router.push('/sign-in');
                    return;
                }
                
                setUser({
                    id: userData.user.uid || userData.user.id,
                    name: userData.user.name || userData.user.displayName || 'User',
                    email: userData.user.email || ''
                });
            } catch (error) {
                console.error('Error fetching user:', error);
                router.push('/sign-in');
            } finally {
                setIsLoading(false);
            }
        };

        fetchUser();
    }, [router]);

    // Show resume prompt toast when user arrives and no resume is uploaded
    useEffect(() => {
        if (user && !resumeData && !showToast) {
            // Delay showing the toast slightly to avoid overwhelming the UI
            const timer = setTimeout(() => {
                showPromptToast();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [user, resumeData, showToast, showPromptToast]);

    // Handle successful resume upload
    const handleResumeUpload = (uploadResult: ResumeData) => {
        console.log('Resume uploaded successfully:', uploadResult);
        setResumeData(uploadResult);
        hideToast(); // Hide the prompt toast
    };

    // Handle resume replacement
    const handleResumeReplaced = () => {
        console.log('Resume being replaced...');
        // Could show a confirmation dialog here if needed
    };

    if (isLoading) {
        return (
            <BanterLoader overlay />
        );
    }

    if (!user) {
        return null; // Redirecting to sign-in
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="mb-6 p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white">
                            AI-Powered Mock Interview
                        </h2>
                    </div>
                    <div className="flex items-center gap-4">
                    </div>
                </div>
            </div>
            
            <div className="">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-white">Interview Panel</h3>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <PdfUploadButton 
                                onQuestionsGenerated={handleResumeUpload}
                                onResumeReplaced={handleResumeReplaced}
                            />
                            <ResumePromptToast 
                                show={showToast && !resumeData}
                                onDismiss={hideToast}
                                message="Upload resume for better questions"
                            />
                        </div>
                        <div className="flex items-center gap-2">

                            <button
                                onClick={() => setIsEditorExpanded(!isEditorExpanded)}
                                className="p-2 text-gray-300 hover:text-white rounded-lg border border-gray-600 hover:bg-gray-700 transition-colors shadow-sm"
                                aria-label={isEditorExpanded ? 'Hide code editor' : 'Show code editor'}
                                title={isEditorExpanded ? 'Hide code editor' : 'Show code editor'}
                            >
                                <svg 
                                    className="w-6 h-6" 
                                    aria-hidden="true" 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    width="24" 
                                    height="24" 
                                    fill="none" 
                                    viewBox="0 0 24 24"
                                >
                                    <path 
                                        stroke="currentColor" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                        strokeWidth="2" 
                                        d="m8 8-4 4 4 4m8 0 4-4-4-4m-2-3-4 14"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <Agent
                        userName={user.name}
                        userId={user.id}
                        type="generate"
                        resumeInfo={resumeData?.extractedData}
                        resumeQuestions={resumeData?.questions}
                    />
                </div>
            </div>

            {isEditorExpanded && (
                <div className="">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-white">Code Editor</h3>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsLanguageDropdownOpen(!isLanguageDropdownOpen);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-200 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                {SUPPORTED_LANGUAGES.find(lang => lang.value === selectedLanguage)?.label || 'Language'}
                                <ChevronDown className="w-4 h-4 ml-1" />
                            </button>
                            {isLanguageDropdownOpen && (
                                <div className="absolute right-0 z-10 mt-1 w-40 origin-top-right rounded-md bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    <div className="py-1">
                                        {SUPPORTED_LANGUAGES.map((language) => (
                                            <button
                                                key={language.value}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedLanguage(language.value);
                                                    setIsLanguageDropdownOpen(false);
                                                }}
                                                className={`block w-full text-left px-4 py-2 text-sm ${
                                                    selectedLanguage === language.value
                                                        ? 'bg-gray-700 text-white'
                                                        : 'text-gray-200 hover:bg-gray-700'
                                                }`}
                                            >
                                                {language.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <CodeEditorWrapper 
                        initialValue={`// Write your ${SUPPORTED_LANGUAGES.find(lang => lang.value === selectedLanguage)?.label || 'code'} here\n// The interviewer may ask you to solve coding problems\n// Use this editor to write and test your solutions`} 
                        language={selectedLanguage}
                        className="h-[500px] transition-all duration-300"
                        isExpanded={true}
                        onToggleExpand={() => setIsEditorExpanded(false)}
                    />
                </div>
            )}
        </div>
    );
};

export default Page;