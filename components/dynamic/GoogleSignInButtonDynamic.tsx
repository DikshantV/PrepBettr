"use client";

import dynamic from 'next/dynamic';
import { Button } from '../ui/button';

const GoogleSignInButton = dynamic(
  () => import('../GoogleSignInButton'),
  { 
    ssr: false,
    loading: () => (
      <Button 
        variant="outline" 
        type="button" 
        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-foreground border-gray-300 hover:border-gray-400 opacity-50 cursor-not-allowed"
        disabled
      >
        <div className="animate-pulse rounded-full h-5 w-5 bg-gray-300"></div>
        <span>Loading...</span>
      </Button>
    )
  }
);

export default GoogleSignInButton;
