"use client";

import { useCallback } from 'react';
import { useTelemetry } from '@/components/providers/TelemetryProvider';

interface UseTelemetryFormOptions {
  formName: string;
  onSubmit?: (data: any) => Promise<any> | any;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  telemetryProperties?: { [key: string]: string };
}

export function useTelemetryForm({
  formName,
  onSubmit,
  onSuccess,
  onError,
  telemetryProperties = {}
}: UseTelemetryFormOptions) {
  const { trackFormSubmission, trackError } = useTelemetry();

  const handleSubmit = useCallback(async (data: any) => {
    const startTime = Date.now();
    let success = false;
    let error: Error | null = null;

    try {
      if (onSubmit) {
        const result = await onSubmit(data);
        success = true;
        
        if (onSuccess) {
          onSuccess(result);
        }
        
        return result;
      }
      success = true;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err : new Error('Form submission failed');
      
      // Track the error
      await trackError(error, {
        formName,
        formData: JSON.stringify(data),
        ...telemetryProperties
      });
      
      if (onError) {
        onError(error);
      }
      
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      
      // Track form submission
      await trackFormSubmission(formName, success, {
        duration: duration.toString(),
        hasError: (!success).toString(),
        errorMessage: error?.message || 'none',
        ...telemetryProperties
      });
    }
  }, [formName, onSubmit, onSuccess, onError, trackFormSubmission, trackError, telemetryProperties]);

  return {
    handleSubmit
  };
}

export default useTelemetryForm;
