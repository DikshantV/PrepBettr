'use client';

import React, { createContext, useContext, useState, ReactNode, useRef } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  loadingText: string;
  showLoader: (text?: string, minDuration?: number) => void;
  hideLoader: (force?: boolean) => void;
  setMinimumDuration: (duration: number) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);


