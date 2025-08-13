"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useInterview } from '@/lib/hooks/useFirestore';
import BanterLoader from '@/components/ui/BanterLoader';
import CommunityInterviewPage from "@/components/CommunityInterviewPage";
import {
    CommunityInterviewData,
    getCommunityInterviewFromStorage,
    setCommunityInterviewInStorage,
    parseTechstack,
    addDebugFunctions
} from '@/lib/utils/communityInterviewStorage';

const InterviewPageContent = () => {
    const searchParams = useSearchParams();
    const [interviewData, setInterviewData] = useState<CommunityInterviewData | null>(null);
    const [dataSource, setDataSource] = useState<'url' | 'localStorage' | 'firestore' | null>(null);
    
    // Extract all potential data sources
    const urlInterviewId = searchParams?.get('id') || null;
    const urlRole = searchParams?.get('role') || null;
    const urlType = searchParams?.get('type') || null;
    const urlLevel = searchParams?.get('level') || null;
    const urlTechstack = parseTechstack(searchParams?.get('techstack') || null);
    
    // Fetch interview data using Firestore lookup (only if we have an ID)
    const { interview, loading: firestoreLoading, error: firestoreError } = useInterview(urlInterviewId);
    
    // Data resolution effect
    useEffect(() => {
        const resolveInterviewData = () => {
            // Priority 1: Check if URL has complete data (preferred for direct links)
            if (urlInterviewId && urlRole && urlType) {
                const urlData: CommunityInterviewData = {
                    id: urlInterviewId,
                    role: decodeURIComponent(urlRole),
                    type: decodeURIComponent(urlType),
                    techstack: urlTechstack.length > 0 ? urlTechstack : ['General'],
                    level: urlLevel ? decodeURIComponent(urlLevel) : undefined,
                    timestamp: Date.now()
                };
                setInterviewData(urlData);
                setDataSource('url');
                console.log('✅ Using URL parameters for interview data');
                return;
            }
            
            // Priority 2: Check localStorage for recently stored data
            const storedData = getCommunityInterviewFromStorage();
            if (storedData && (!urlInterviewId || urlInterviewId === storedData.id)) {
                setInterviewData(storedData);
                setDataSource('localStorage');
                console.log('✅ Using localStorage for interview data');
                return;
            }
            
            // Priority 3: Use Firestore data if available
            if (interview && !firestoreLoading && !firestoreError) {
                const firestoreData: CommunityInterviewData = {
                    id: interview.id,
                    role: interview.role || interview.jobTitle || 'Unknown Role',
                    type: interview.type || 'technical',
                    techstack: Array.isArray(interview.techstack) ? interview.techstack : (interview.techstack ? [interview.techstack] : ['General']),
                    level: interview.level,
                    createdAt: typeof interview.createdAt === 'string' ? interview.createdAt : interview.createdAt.toISOString(),
                    timestamp: Date.now()
                };
                setInterviewData(firestoreData);
                setDataSource('firestore');
                console.log('✅ Using Firestore for interview data');
                return;
            }
            
            // If we have an ID but no other data sources worked, wait for Firestore
            if (urlInterviewId && firestoreLoading) {
                return; // Still loading
            }
            
            // No valid data found
            setInterviewData(null);
            setDataSource(null);
        };
        
        resolveInterviewData();
    }, [urlInterviewId, urlRole, urlType, urlLevel, urlTechstack, interview, firestoreLoading, firestoreError]);
    
    // Show loading state
    if (firestoreLoading && !interviewData) {
        return <BanterLoader overlay />;
    }
    
    // Show Firestore error state only if no other data sources are available
    if (firestoreError && !interviewData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <h2 className="text-xl font-semibold text-red-400 mb-4">Error Loading Interview</h2>
                <p className="text-gray-300">{firestoreError}</p>
                <p className="text-gray-500 mt-2">Please try again or contact support if the issue persists.</p>
            </div>
        );
    }
    
    // Show no interview selected state
    if (!interviewData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <h2 className="text-xl font-semibold text-gray-400 mb-4">No Interview Selected</h2>
                <p className="text-gray-300">Please select an interview from the dashboard to get started.</p>
                <p className="text-gray-500 mt-2">Make sure the interview link is complete and valid.</p>
            </div>
        );
    }
    
    // Update localStorage with current data for future persistence (if not already from localStorage)
    useEffect(() => {
        if (interviewData && dataSource !== 'localStorage') {
            setCommunityInterviewInStorage(interviewData);
        }
    }, [interviewData, dataSource]);
    
    // Add debug functions in development
    useEffect(() => {
        addDebugFunctions();
    }, []);
    
    return (
        <>
            {/* Debug info in development */}
            {process.env.NODE_ENV === 'development' && (
                <div className="fixed top-4 right-4 bg-gray-800 p-2 rounded text-xs text-white z-50">
                    Data source: {dataSource}
                </div>
            )}
            <CommunityInterviewPage 
                interviewId={interviewData.id}
                role={interviewData.role}
                type={interviewData.type}
                techstack={interviewData.techstack}
                level={interviewData.level}
            />
        </>
    );
};

const Page = () => {
    return (
        <Suspense fallback={<BanterLoader overlay />}>
            <InterviewPageContent />
        </Suspense>
    );
};

export default Page;
