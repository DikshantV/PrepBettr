"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import Agent from "@/components/Agent";
import { CodeEditorWrapper } from "@/components/CodeEditorWrapper";
// Removed server-only auth import - using API calls instead
import BanterLoader from "@/components/ui/BanterLoader";
import InterviewHeader from "@/app/dashboard/interview/[id]/InterviewHeader";
import { useCommunityInterview } from "@/lib/hooks/useCommunityInterview";
import { mockInterviewService } from "@/lib/services/mock-interview.service";

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

interface CommunityInterviewPageProps {
  interviewId?: string;
  role?: string;
  type?: string;
  techstack?: string[];
  level?: string;
}

const CommunityInterviewPage = ({ 
  interviewId, 
  role, 
  type, 
  techstack, 
  level 
}: CommunityInterviewPageProps = {}) => {
    const router = useRouter();
    const [isEditorExpanded, setIsEditorExpanded] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState('javascript');
    const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [questions, setQuestions] = useState<string[]>([]);
    const [questionsLoading, setQuestionsLoading] = useState(false);
    const [questionsError, setQuestionsError] = useState<string | null>(null);
    
    // Use SWR hook to fetch community interview data
    const { interview: communityInterview, isLoading: communityLoading, isError: communityError } = useCommunityInterview(interviewId || null);

    useEffect(() => {
        // Use API call instead of direct service import
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

    // Generate questions when community interview data is available
    useEffect(() => {
        const generateQuestions = async () => {
            // Skip if we have questions already stored in the community interview
            if (communityInterview?.questions && Array.isArray(communityInterview.questions) && communityInterview.questions.length > 0) {
                setQuestions(communityInterview.questions);
                return;
            }

            // Skip if no community interview data or still loading
            if (!communityInterview || communityLoading) {
                return;
            }

            // Use provided props or fallback to community interview data
            const interviewType = type || communityInterview.type || 'Mixed';
            const interviewTechstack = techstack || communityInterview.techstack || ['JavaScript'];
            const interviewRole = role || communityInterview.role || 'Software Developer';
            const interviewLevel = level || communityInterview.level || 'Mid-level';

            try {
                setQuestionsLoading(true);
                setQuestionsError(null);

                // Initialize the mock interview service if not already done
                await mockInterviewService.initialize();

                // Create a mock role object for the service
                const mockRole = {
                    jobTitle: interviewRole,
                    seniority: interviewLevel as 'Junior' | 'Mid-level' | 'Senior' | 'Lead' | 'Principal',
                    company: 'Community Interview',
                    industry: 'Technology'
                };

                // Generate questions using the same type and techstack
                const generatedQuestions = await mockInterviewService.generateQuestions(
                    mockRole,
                    interviewType,
                    Array.isArray(interviewTechstack) ? interviewTechstack : [interviewTechstack]
                );

                setQuestions(generatedQuestions);
                console.log('📝 Generated questions for community interview:', generatedQuestions.length);
            } catch (error) {
                console.error('Error generating questions:', error);
                setQuestionsError('Failed to generate interview questions');
                
                // Set fallback questions
                setQuestions([
                    'Tell me about yourself and your experience.',
                    'What interests you about this role?',
                    'Describe a challenging project you worked on.',
                    'How do you stay updated with technology trends?',
                    'What are your career goals?'
                ]);
            } finally {
                setQuestionsLoading(false);
            }
        };

        generateQuestions();
    }, [communityInterview, communityLoading, type, techstack, role, level]);

    if (isLoading || (interviewId && communityLoading)) {
        return (
            <BanterLoader overlay />
        );
    }

    // Handle community interview error
    if (interviewId && communityError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <h2 className="text-xl font-semibold text-red-400 mb-4">Error Loading Community Interview</h2>
                <p className="text-gray-300">{communityError.message || 'Failed to load interview data'}</p>
                <p className="text-gray-500 mt-2">Please try again or contact support if the issue persists.</p>
            </div>
        );
    }

    if (!user) {
        return null; // Redirecting to sign-in
    }

    return (
        <div className="flex flex-col gap-8">
            <InterviewHeader 
                role={role || 'Community Mock'}
                techstack={techstack && techstack.length > 0 ? techstack : ['General']}
                type={type || 'Community'}
                interviewId={interviewId}
                onToggleEditor={() => setIsEditorExpanded(!isEditorExpanded)}
            />
            
            <div className="">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-white">Interview Panel</h3>
                </div>
                <div className="space-y-4">
                    {questionsLoading && (
                        <div className="flex items-center justify-center py-4">
                            <div className="text-gray-400">Generating interview questions...</div>
                        </div>
                    )}
                    {questionsError && (
                        <div className="flex items-center justify-center py-4">
                            <div className="text-red-400">Error: {questionsError}</div>
                        </div>
                    )}
                    {!questionsLoading && questions.length > 0 && (
                        <Agent
                            userName={user.name}
                            userId={user.id}
                            interviewId={interviewId}
                            type="interview"
                            questions={questions}
                        />
                    )}
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

export default CommunityInterviewPage;
