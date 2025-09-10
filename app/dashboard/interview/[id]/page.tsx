// export const dynamic = 'force-dynamic'; // Commented out for static export

import { getCurrentUser } from "@/lib/actions/auth.action";
import InterviewClient from "./InterviewClient";
import { questionBankService, MOCK_INTERVIEW_TEMPLATES } from '@/lib/services/question-bank-service';
import type { InterviewTemplate } from '@/lib/services/question-bank-service';

export interface InterviewData {
    interview: {
        id: string;
        role: string;
        type: string;
        questions: {
            id: string;
            content: string;
            type: string;
            difficulty: string;
            techStack: string[];
            answer?: string;
            feedback?: string;
        }[];
        techstack: string[];
        createdAt: string;
    };
    feedback: {
        id: string;
        overall: string;
        strengths: string[];
        areasForImprovement: string[];
    } | null;
    user: {
        id: string;
        name: string;
        email: string;
    };
}

async function getInterviewData(id: string) {
    try {
        // Check if this is a mock interview ID and generate appropriate data
        if (id.startsWith('mock-interview-')) {
            const mockIndex = parseInt(id.split('-')[2]) - 1;
            
            // Get interview template from question bank service
            const templates = questionBankService.getAllTemplates();
            const selectedTemplate = templates[mockIndex % templates.length];
            
            const mockData = {
                interview: {
                    id,
                    role: selectedTemplate.role,
                    type: selectedTemplate.type,
                    questions: selectedTemplate.questions.map((q, idx) => ({
                        id: `${idx + 1}`,
                        content: q,
                        type: selectedTemplate.type.toLowerCase(),
                        difficulty: selectedTemplate.difficulty,
                        techStack: selectedTemplate.techStack
                    })),
                    techstack: selectedTemplate.techStack,
                    createdAt: new Date().toISOString(),
                },
                feedback: null,
            };
            
            const currentUser = await getCurrentUser();
            
            return {
                ...mockData,
                user: currentUser ? {
                    id: (currentUser as any).uid || (currentUser as any).id || 'static-user',
                    name: (currentUser as any).name || (currentUser as any).displayName || 'User',
                    email: (currentUser as any).email || 'user@example.com'
                } : {
                    id: 'static-user',
                    name: 'User',
                    email: 'user@example.com'
                }
            };
        }
        
        // In a real app, you would fetch this data from the database
        // const response = await fetch(`/api/interview/${id}`);
        // const result = await response.json();

        // Default mock data for non-mock interviews
        const mockData = {
            interview: {
                id,
                role: 'Developer',
                type: 'Technical',
                questions: [
                    {
                        id: '1',
                        content: 'Explain the concept of React hooks',
                        type: 'technical',
                        difficulty: 'medium',
                        techStack: ['React', 'JavaScript']
                    },
                    {
                        id: '2',
                        content: 'What is the virtual DOM?',
                        type: 'technical',
                        difficulty: 'easy',
                        techStack: ['React', 'JavaScript']
                    }
                ],
                techstack: ['JavaScript', 'React', 'Node.js'],
                createdAt: new Date().toISOString(),
            },
            feedback: null,
        };

        const currentUser = await getCurrentUser();
        
        return {
            ...mockData,
            user: currentUser ? {
                id: (currentUser as any).uid || (currentUser as any).id || 'static-user',
                name: (currentUser as any).name || (currentUser as any).displayName || 'User',
                email: (currentUser as any).email || 'user@example.com'
            } : {
                id: 'static-user',
                name: 'User',
                email: 'user@example.com'
            }
        };
    } catch (error) {
        console.error('Error fetching interview data:', error);
        throw error;
    }
}

// import { Metadata } from 'next';

interface PageParams {
    id: string;
}

interface PageProps {
    params: Promise<PageParams>;
}

export async function generateStaticParams() {
    // Generate static params for mock interviews only
    // In production, you'd fetch actual interview IDs from the database
    return [
        { id: 'mock-interview-1' },
        { id: 'mock-interview-2' },
        { id: 'mock-interview-3' },
        { id: 'mock-interview-4' },
        { id: 'mock-interview-5' },
        { id: 'mock-interview-6' },
        { id: 'mock-interview-7' },
        { id: 'mock-interview-8' },
    ];
}

export default async function Page({ params }: PageProps) {
    const { id } = await params;
    const interviewData = await getInterviewData(id);

    return <InterviewClient
        interview={interviewData.interview}
        feedback={interviewData.feedback}
        user={interviewData.user}
    />;
}
