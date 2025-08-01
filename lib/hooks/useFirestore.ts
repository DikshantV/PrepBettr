"use client";

import { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { db } from '@/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';

// Hook for fetching user's own interviews
export function useUserInterviews() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const fetchInterviews = async () => {
      if (authLoading) return; // Wait for auth to resolve
      
      if (!user) {
        setInterviews([]);
        setLocalLoading(false);
        return;
      }

      try {
        setLocalLoading(true);
        setError(null);

        const interviewsQuery = query(
          collection(db, 'interviews'),
          where('userId', '==', user.id),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(interviewsQuery);
        const userInterviews: Interview[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Interview[];

        setInterviews(userInterviews);
      } catch (err) {
        console.error('Error fetching user interviews:', err);
        setError('Failed to load interviews');
      } finally {
        setLocalLoading(false);
      }
    };

    fetchInterviews();
  }, [user, authLoading]);

  return { interviews, loading: authLoading || localLoading, error };
}

// Hook for fetching public/finalized interviews (excluding user's own)
export function usePublicInterviews() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const fetchInterviews = async () => {
      if (authLoading) return; // Wait for auth to resolve
      
      if (!user) {
        setInterviews([]);
        setLocalLoading(false);
        return;
      }

      try {
        setLocalLoading(true);
        setError(null);

        const publicQuery = query(
          collection(db, 'interviews'),
          where('finalized', '==', true),
          where('userId', '!=', user.id), // Exclude user's own interviews
          orderBy('createdAt', 'desc'),
          limit(20)
        );

        const querySnapshot = await getDocs(publicQuery);
        const publicInterviews: Interview[] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Interview[];

        setInterviews(publicInterviews);
      } catch (err) {
        console.error('Error fetching public interviews:', err);
        setError('Failed to load public interviews');
      } finally {
        setLocalLoading(false);
      }
    };

    fetchInterviews();
  }, [user, authLoading]);

  return { interviews, loading: authLoading || localLoading, error };
}

// Hook for fetching a specific interview (with auth check)
export function useInterview(interviewId: string | null) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [localLoading, setLocalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const fetchInterview = async () => {
      if (!interviewId) {
        setInterview(null);
        setLocalLoading(false);
        return;
      }
      
      if (authLoading) return; // Wait for auth to resolve
      
      if (!user) {
        setInterview(null);
        setLocalLoading(false);
        return;
      }

      try {
        setLocalLoading(true);
        setError(null);

        const interviewDoc = await getDoc(doc(db, 'interviews', interviewId));
        
        if (interviewDoc.exists()) {
          const interviewData = interviewDoc.data() as Interview;
          
          // Security check: user can only access their own interviews or finalized public ones
          if (interviewData.userId === user.id || interviewData.finalized === true) {
            setInterview({ ...interviewData, id: interviewDoc.id });
          } else {
            setError('Access denied');
          }
        } else {
          setError('Interview not found');
        }
      } catch (err) {
        console.error('Error fetching interview:', err);
        setError('Failed to load interview');
      } finally {
        setLocalLoading(false);
      }
    };

    fetchInterview();
  }, [interviewId, user, authLoading]);

  return { interview, loading: authLoading || localLoading, error };
}

// Hook for fetching feedback for a specific interview
export function useFeedback(interviewId: string | null) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [localLoading, setLocalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const { user, loading: authLoading } = useAuth();

  // Wait for Firebase Auth to be ready
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setFirebaseReady(true);
      if (!firebaseUser && user) {
        // Firebase auth is not ready but we have a user from server context
        console.log('Firebase auth state not ready, but user exists from server');
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const fetchFeedback = async () => {
      if (!interviewId) {
        setFeedback(null);
        setLocalLoading(false);
        return;
      }
      
      if (authLoading || !firebaseReady) return; // Wait for both auth and Firebase to resolve
      
      if (!user) {
        setFeedback(null);
        setLocalLoading(false);
        return;
      }

      // Check if Firebase user is authenticated
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('Firebase Auth user not found, but user context exists');
        setError('Authentication required. Please sign in again.');
        setLocalLoading(false);
        return;
      }

      try {
        setLocalLoading(true);
        setError(null);

        console.log(`Fetching feedback for interview ${interviewId} by user ${user.id}`);

        const feedbackQuery = query(
          collection(db, 'feedback'),
          where('interviewId', '==', interviewId),
          where('userId', '==', user.id),
          limit(1)
        );

        const querySnapshot = await getDocs(feedbackQuery);
        
        if (!querySnapshot.empty) {
          const feedbackDoc = querySnapshot.docs[0];
          setFeedback({ id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback);
          console.log('Feedback fetched successfully');
        } else {
          setFeedback(null);
          console.log('No feedback found for this interview');
        }
      } catch (err) {
        console.error('Error fetching feedback:', err);
        
        // Check for specific Firebase errors
        if (err.code === 'permission-denied') {
          setError('Permission denied. Please check your authentication.');
        } else if (err.message?.includes('Missing or insufficient permissions')) {
          setError('Insufficient permissions to access feedback data.');
        } else {
          setError('Failed to load feedback');
        }
      } finally {
        setLocalLoading(false);
      }
    };

    fetchFeedback();
  }, [interviewId, user, authLoading, firebaseReady]);

  return { feedback, loading: authLoading || localLoading || !firebaseReady, error };
}
