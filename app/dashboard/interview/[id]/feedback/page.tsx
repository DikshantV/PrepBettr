import FeedbackClient from './FeedbackClient';

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

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function FeedbackPage({ params }: PageProps) {
    return <FeedbackClient />;
}
