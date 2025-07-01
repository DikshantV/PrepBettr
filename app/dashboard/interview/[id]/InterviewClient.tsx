"use client";

import dynamic from 'next/dynamic';
import { InterviewData } from './page';

// Dynamically import the client component with no SSR
const InterviewContent = dynamic(
    () => import('./InterviewContent'),
    { ssr: false }
);

interface InterviewClientProps {
    interview: InterviewData['interview'];
    feedback: InterviewData['feedback'];
    user: InterviewData['user'];
}

export default function InterviewClient({ interview, feedback, user }: InterviewClientProps) {
    return <InterviewContent interview={interview} feedback={feedback} user={user} />;
}
