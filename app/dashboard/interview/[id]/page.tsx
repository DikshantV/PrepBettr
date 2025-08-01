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
        // Check if this is a mock interview ID and generate appropriate data
        if (id.startsWith('mock-interview-')) {
            const mockIndex = parseInt(id.split('-')[2]) - 1;
            const mockInterviews = [
                {
                    role: 'Frontend Developer',
                    type: 'Technical',
                    techstack: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'],
                    questions: [
                        'Explain the concept of React hooks and provide examples',
                        'What is the virtual DOM and how does it work?',
                        'How do you handle state management in React applications?'
                    ]
                },
                {
                    role: 'Backend Developer',
                    type: 'Technical',
                    techstack: ['Node.js', 'Express', 'MongoDB', 'JavaScript'],
                    questions: [
                        'Explain RESTful API design principles',
                        'How do you handle database relationships in MongoDB?',
                        'What are middleware functions in Express.js?'
                    ]
                },
                {
                    role: 'Full Stack Developer',
                    type: 'Mixed',
                    techstack: ['Python', 'Django', 'PostgreSQL', 'Redis'],
                    questions: [
                        'Describe your experience with full-stack development',
                        'How do you optimize database queries?',
                        'What is your approach to handling user authentication?'
                    ]
                },
                {
                    role: 'Software Engineer',
                    type: 'Behavioral',
                    techstack: ['Vue.js', 'Nuxt.js', 'Vuex', 'SCSS'],
                    questions: [
                        'Tell me about a challenging project you worked on',
                        'How do you handle conflicts in a team environment?',
                        'Describe a time when you had to learn a new technology quickly'
                    ]
                },
                {
                    role: 'DevOps Engineer',
                    type: 'Technical',
                    techstack: ['Docker', 'Kubernetes', 'AWS', 'Jenkins'],
                    questions: [
                        'Explain containerization and its benefits',
                        'How do you implement CI/CD pipelines?',
                        'What is Infrastructure as Code?'
                    ]
                },
                {
                    role: 'Data Scientist',
                    type: 'Technical',
                    techstack: ['Python', 'TensorFlow', 'Pandas', 'SQL'],
                    questions: [
                        'Explain the difference between supervised and unsupervised learning',
                        'How do you handle missing data in datasets?',
                        'What is feature engineering and why is it important?'
                    ]
                },
                {
                    role: 'Mobile Developer',
                    type: 'Mixed',
                    techstack: ['React Native', 'JavaScript', 'Firebase', 'Redux'],
                    questions: [
                        'What are the advantages of React Native over native development?',
                        'How do you handle offline functionality in mobile apps?',
                        'Describe your experience with mobile app deployment'
                    ]
                },
                {
                    role: 'QA Engineer',
                    type: 'Technical',
                    techstack: ['Selenium', 'Jest', 'Cypress', 'JavaScript'],
                    questions: [
                        'What is the difference between unit testing and integration testing?',
                        'How do you design test cases for a new feature?',
                        'Explain automation testing strategies you have used'
                    ]
                }
            ];
            
            const selectedMock = mockInterviews[mockIndex % mockInterviews.length];
            
            const mockData = {
                interview: {
                    id,
                    role: selectedMock.role,
                    type: selectedMock.type,
                    questions: selectedMock.questions.map((q, idx) => ({
                        id: `${idx + 1}`,
                        content: q,
                        type: selectedMock.type.toLowerCase(),
                        difficulty: 'medium',
                        techStack: selectedMock.techstack
                    })),
                    techstack: selectedMock.techstack,
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