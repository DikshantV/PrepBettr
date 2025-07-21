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
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/firebase/client';

// Hook for fetching user's own interviews
export function useUserInterviews() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setInterviews([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const interviewsQuery = query(
          collection(db, 'interviews'),
          where('userId', '==', user.uid),
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
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { interviews, loading, error };
}

// Hook for fetching public/finalized interviews (excluding user's own)
export function usePublicInterviews() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setInterviews([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const publicQuery = query(
          collection(db, 'interviews'),
          where('finalized', '==', true),
          where('userId', '!=', user.uid), // Exclude user's own interviews
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
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { interviews, loading, error };
}

// Hook for fetching a specific interview (with auth check)
export function useInterview(interviewId: string | null) {
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!interviewId) {
      setInterview(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setInterview(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const interviewDoc = await getDoc(doc(db, 'interviews', interviewId));
        
        if (interviewDoc.exists()) {
          const interviewData = interviewDoc.data() as Interview;
          
          // Security check: user can only access their own interviews or finalized public ones
          if (interviewData.userId === user.uid || interviewData.finalized === true) {
            setInterview({ id: interviewDoc.id, ...interviewData });
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
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [interviewId]);

  return { interview, loading, error };
}

// Hook for fetching feedback for a specific interview
export function useFeedback(interviewId: string | null) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!interviewId) {
      setFeedback(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFeedback(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const feedbackQuery = query(
          collection(db, 'feedback'),
          where('interviewId', '==', interviewId),
          where('userId', '==', user.uid),
          limit(1)
        );

        const querySnapshot = await getDocs(feedbackQuery);
        
        if (!querySnapshot.empty) {
          const feedbackDoc = querySnapshot.docs[0];
          setFeedback({ id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback);
        } else {
          setFeedback(null);
        }
      } catch (err) {
        console.error('Error fetching feedback:', err);
        setError('Failed to load feedback');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [interviewId]);

  return { feedback, loading, error };
}
