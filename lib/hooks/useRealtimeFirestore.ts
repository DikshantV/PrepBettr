"use client";

import { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  doc,
  DocumentSnapshot,
  QuerySnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '@/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import useSWR from 'swr';
import { ApplicationStatus, UserProfile } from '@/types/realtime';

// Generic real-time document hook with SWR caching
export function useRealtimeDocument<T>(
  collectionName: string, 
  documentId: string | null,
  fallbackData?: T | null
) {
  const { user } = useAuth();
  const key = documentId ? `${collectionName}/${documentId}` : null;

  const { data, error, mutate } = useSWR(
    key,
    () => null, // We'll handle data fetching via onSnapshot
    {
      fallbackData,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!documentId || !user) {
      setIsLoading(false);
      mutate(null);
      return;
    }

    setIsLoading(true);
    const docRef = doc(db, collectionName, documentId);
    
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          const docData = { id: snapshot.id, ...snapshot.data() } as T;
          mutate(docData, false); // Update SWR cache without revalidation
        } else {
          mutate(null, false);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error(`Error listening to ${collectionName}/${documentId}:`, error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [documentId, user, collectionName, mutate]);

  return {
    data,
    error,
    isLoading,
    mutate
  };
}

// Real-time user interviews hook with SWR
export function useRealtimeUserInterviews() {
  const { user, loading: authLoading } = useAuth();
  const key = user ? `user-interviews/${user.id}` : null;

  const { data, error, mutate } = useSWR(
    key,
    () => [], // We'll handle data fetching via onSnapshot
    {
      fallbackData: [],
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) {
        setIsLoading(false);
        mutate([]);
      }
      return;
    }

    setIsLoading(true);
    const interviewsQuery = query(
      collection(db, 'interviews'),
      where('userId', '==', user.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      interviewsQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const interviews = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Interview[];
        
        mutate(interviews, false); // Update SWR cache without revalidation
        setIsLoading(false);
      },
      (error) => {
        console.error('Error listening to user interviews:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading, mutate]);

  return {
    data: data || [],
    error,
    isLoading: authLoading || isLoading,
    mutate
  };
}

// Real-time public interviews hook with SWR
export function useRealtimePublicInterviews(limitCount: number = 20) {
  const { user, loading: authLoading } = useAuth();
  const key = user ? `public-interviews/${user.id}` : null;

  const { data, error, mutate } = useSWR(
    key,
    () => [], // We'll handle data fetching via onSnapshot
    {
      fallbackData: [],
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) {
        setIsLoading(false);
        mutate([]);
      }
      return;
    }

    setIsLoading(true);
    const publicQuery = query(
      collection(db, 'interviews'),
      where('finalized', '==', true),
      where('userId', '!=', user.id),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(
      publicQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const interviews = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Interview[];
        
        mutate(interviews, false); // Update SWR cache without revalidation
        setIsLoading(false);
      },
      (error) => {
        console.error('Error listening to public interviews:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading, limitCount, mutate]);

  return {
    data: data || [],
    error,
    isLoading: authLoading || isLoading,
    mutate
  };
}

// Real-time interview hook with access control
export function useRealtimeInterview(interviewId: string | null) {
  const { user, loading: authLoading } = useAuth();
  
  return useRealtimeDocument<Interview>(
    'interviews', 
    interviewId,
    null
  );
}

// Real-time feedback hook
export function useRealtimeFeedback(interviewId: string | null) {
  const { user, loading: authLoading } = useAuth();
  const key = user && interviewId ? `feedback/${interviewId}/${user.id}` : null;

  const { data, error, mutate } = useSWR(
    key,
    () => null, // We'll handle data fetching via onSnapshot
    {
      fallbackData: null,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user || !interviewId) {
      if (!authLoading) {
        setIsLoading(false);
        mutate(null);
      }
      return;
    }

    setIsLoading(true);
    const feedbackQuery = query(
      collection(db, 'feedback'),
      where('interviewId', '==', interviewId),
      where('userId', '==', user.id),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      feedbackQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        if (!snapshot.empty) {
          const feedbackDoc = snapshot.docs[0];
          const feedback = { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
          mutate(feedback, false);
        } else {
          mutate(null, false);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('Error listening to feedback:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [interviewId, user, authLoading, mutate]);

  return {
    data,
    error,
    isLoading: authLoading || isLoading,
    mutate
  };
}

// Real-time application status hook for resume processing
export function useRealtimeApplicationStatus(applicationId: string | null) {
  const { user } = useAuth();
  
  return useRealtimeDocument<ApplicationStatus>(
    'applicationStatuses', 
    applicationId,
    null
  );
}

// Hook for real-time user profile updates
export function useRealtimeUserProfile(userId: string | null) {
  return useRealtimeDocument<UserProfile>(
    'users', 
    userId,
    null
  );
}
