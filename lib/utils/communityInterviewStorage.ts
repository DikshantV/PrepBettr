// Utility functions for managing community interview localStorage data

export interface CommunityInterviewData {
    id: string;
    role: string;
    type: string;
    techstack: string[];
    level?: string;
    createdAt?: string;
    companyLogo?: string;
    timestamp: number;
}

export const COMMUNITY_INTERVIEW_STORAGE_KEY = 'communityMockInterviewSelection';

/**
 * Safely get community interview data from localStorage
 */
export const getCommunityInterviewFromStorage = (): CommunityInterviewData | null => {
    if (typeof window === 'undefined') return null;
    
    try {
        const stored = localStorage.getItem(COMMUNITY_INTERVIEW_STORAGE_KEY);
        if (!stored) return null;
        
        const data = JSON.parse(stored) as CommunityInterviewData;
        
        // Check if data is less than 24 hours old to prevent stale data
        const isStale = Date.now() - data.timestamp > 24 * 60 * 60 * 1000;
        if (isStale) {
            localStorage.removeItem(COMMUNITY_INTERVIEW_STORAGE_KEY);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('Error parsing stored community interview data:', error);
        localStorage.removeItem(COMMUNITY_INTERVIEW_STORAGE_KEY);
        return null;
    }
};

/**
 * Store community interview data in localStorage
 */
export const setCommunityInterviewInStorage = (data: Omit<CommunityInterviewData, 'timestamp'>): void => {
    if (typeof window === 'undefined') return;
    
    try {
        const dataWithTimestamp: CommunityInterviewData = {
            ...data,
            timestamp: Date.now()
        };
        localStorage.setItem(COMMUNITY_INTERVIEW_STORAGE_KEY, JSON.stringify(dataWithTimestamp));
    } catch (error) {
        console.error('Error storing community interview data:', error);
    }
};

/**
 * Clear community interview data from localStorage
 */
export const clearCommunityInterviewFromStorage = (): void => {
    if (typeof window === 'undefined') return;
    
    try {
        localStorage.removeItem(COMMUNITY_INTERVIEW_STORAGE_KEY);
        console.log('Community interview data cleared from storage');
    } catch (error) {
        console.error('Error clearing community interview data:', error);
    }
};

/**
 * Check if stored data matches given interview ID
 */
export const isStoredInterviewId = (interviewId: string): boolean => {
    const stored = getCommunityInterviewFromStorage();
    return stored?.id === interviewId;
};

/**
 * Parse techstack from URL parameter string
 */
export const parseTechstack = (techstackParam: string | null): string[] => {
    if (!techstackParam) return [];
    return techstackParam.split(',').filter(Boolean);
};

/**
 * Helper to add global debug functions for development
 */
export const addDebugFunctions = (): void => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        // @ts-ignore
        window.clearCommunityInterview = clearCommunityInterviewFromStorage;
        // @ts-ignore
        window.getCommunityInterview = getCommunityInterviewFromStorage;
        console.log('Debug functions added: window.clearCommunityInterview(), window.getCommunityInterview()');
    }
};
