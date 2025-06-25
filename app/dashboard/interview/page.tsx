"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Agent from "@/components/Agent";
import { CodeEditorWrapper } from "@/components/CodeEditorWrapper";
import { getCurrentUser } from "@/lib/actions/auth.action";
import PdfUploadButton from "@/components/PdfUploadButton";

interface User {
  id: string;
  name: string;
  email: string;
}

const Page = () => {
    const router = useRouter();
    const [isEditorExpanded, setIsEditorExpanded] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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
                setIsLoading(false);
            }
        };

        fetchUser();
    }, [router]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen">Loading...</div>;
    }

    if (!user) {
        return null; // Redirecting to sign-in
    }

    return (
        <div className="flex flex-col gap-8">
            <h2 className="text-2xl font-bold">AI-Powered Mock Interview</h2>
            
            <div className="">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold">Interview Panel</h3>
                    <div className="flex items-center gap-2">
                        <PdfUploadButton />
                        <button
                            onClick={() => setIsEditorExpanded(!isEditorExpanded)}
                            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                    <h3 className="text-xl font-semibold mb-4">Code Editor</h3>
                    <CodeEditorWrapper 
                        initialValue="// Write your code here\n// The interviewer may ask you to solve coding problems\n// Use this editor to write and test your solutions" 
                        language="javascript"
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