"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import Agent from "@/components/Agent";
import { CodeEditorWrapper } from "@/components/CodeEditorWrapper";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { UsageIndicator } from "@/components/UsageIndicator";
import PdfUploadButton from "@/components/dynamic/PdfUploadButtonDynamic";
import { useLoading } from "@/contexts/LoadingContext";

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

const Page = () => {
    const router = useRouter();
    const { showLoader, hideLoader } = useLoading();
    const [isEditorExpanded, setIsEditorExpanded] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState('javascript');
    const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const currentUser = await getCurrentUser();
                if (!currentUser) {
                    router.push('/sign-in');
                    return;
                }
                setUser({
                    id: currentUser.id,
                    name: currentUser.name || 'User',
                    email: currentUser.email || ''
                });
            } catch (error) {
                console.error('Error fetching user:', error);
                router.push('/sign-in');
            } finally {
                setIsInitialized(true);
            }
        };

        fetchUser();
    }, [router]);

    if (!isInitialized) {
        return null; // Global loader is handling this
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
                        <UsageIndicator feature="interviews" variant="badge" showLabel={false} />
                    </div>
                </div>
            </div>
            
            <div className="">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-white">Interview Panel</h3>
                    <div className="flex items-center gap-2">
                        <PdfUploadButton />
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