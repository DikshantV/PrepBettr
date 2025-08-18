"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResumePromptToastProps {
  show?: boolean;
  onDismiss?: () => void;
  className?: string;
  message?: string;
}

const ResumePromptToast: React.FC<ResumePromptToastProps> = ({
  show = false,
  onDismiss,
  className,
  message = "Upload your resume for better questions"
}) => {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
  }, [show]);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "absolute top-full left-0 right-0 mt-2 z-50 mx-auto max-w-sm",
            className
          )}
        >
          <div className="relative bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-800 rounded-lg shadow-lg backdrop-blur-sm">
            {/* Animated sparkle effect */}
            <div className="absolute -top-1 -right-1">
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 180, 360]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Sparkles className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              </motion.div>
            </div>

            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                    <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    💡 Pro Tip
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                    {message}
                  </p>
                </div>

                <button
                  onClick={handleDismiss}
                  className="flex-shrink-0 p-1 text-blue-400 dark:text-blue-500 hover:text-blue-600 dark:hover:text-blue-300 transition-colors rounded"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Subtle gradient border */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-200/50 via-indigo-200/50 to-blue-200/50 dark:from-blue-800/50 dark:via-indigo-800/50 dark:to-blue-800/50 -z-10" style={{ padding: '1px' }}>
              <div className="w-full h-full rounded-lg bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/30" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Hook for managing toast state
export const useResumePromptToast = (initialShow: boolean = false) => {
  const [show, setShow] = useState(initialShow);

  const showToast = () => setShow(true);
  const hideToast = () => setShow(false);
  const toggleToast = () => setShow(prev => !prev);

  return {
    show,
    showToast,
    hideToast,
    toggleToast,
    setShow
  };
};

export { ResumePromptToast };
