
"use client";

import useSWR from 'swr';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/client';

// Define the fetcher function for SWR
const fetcher = async (id: string) => {
    if (!id) {
        throw new Error("Interview ID is required");
    }

    // Reference to the document in the publicInterviews collection
    const interviewDocRef = doc(db, 'publicInterviews', id);

    // Fetch the document
    const interviewDoc = await getDoc(interviewDocRef);

    // Handle the case where the document does not exist
    if (!interviewDoc.exists()) {
        throw new Error("Interview not found");
    }

    // Return the document data
    return interviewDoc.data();
};

// Define the custom SWR hook
export const useCommunityInterview = (id: string | null) => {
    // Use SWR to fetch and cache the data
    const { data, error } = useSWR(id ? id : null, fetcher, {
        revalidateOnFocus: false, // Optional: prevent re-fetching on window focus
    });

    return {
        interview: data,
        isLoading: !error && !data,
        isError: error,
    };
};

