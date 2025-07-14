export const dynamic = 'force-dynamic';

import { getCurrentUser } from "@/lib/actions/auth.action";
import InterviewClient from "./InterviewClient";

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
        // In a real app, you would fetch this data
        // const response = await fetch(`/api/interview/${id}`);
        // const result = await response.json();

        // Mock data for now
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
        if (!currentUser) {
            throw new Error('User not authenticated');
        }

        return {
            ...mockData,
            user: {
                id: currentUser.id,
                name: currentUser.name || 'User',
                email: currentUser.email || ''
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

export default async function Page({ params }: PageProps) {
    const { id } = await params;
    const interviewData = await getInterviewData(id);

    return <InterviewClient
        interview={interviewData.interview}
        feedback={interviewData.feedback}
        user={interviewData.user}
    />;
}