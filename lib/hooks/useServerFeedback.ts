"use client";

import { useEffect, useState } from 'react';
import { getFeedbackByInterviewId } from '@/lib/actions/feedback.action';
import type { Feedback } from '@/types';

export function useServerFeedback(interviewId: string | null) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFeedback() {
      if (!interviewId) {
        setFeedback(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const result = await getFeedbackByInterviewId(interviewId);

        if (result.success) {
          setFeedback(result.feedback || null);
        } else {
          setError(result.error || 'Failed to load feedback');
          console.error('Server feedback fetch failed:', result.error, result.details);
        }
      } catch (err) {
        setError('Failed to load feedback');
        console.error('Error in useServerFeedback:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchFeedback();
  }, [interviewId]);

  return { feedback, loading, error };
}
