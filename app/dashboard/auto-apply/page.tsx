"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function AutoApplyPage() {
  const router = useRouter();

  const handleNavigateToDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <>
      {/* Background content that will be blurred */}
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 rounded-full mb-6">
              <svg 
                className="w-8 h-8 text-blue-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m0 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" 
                />
              </svg>
            </div>
            
            <h1 className="text-4xl font-bold text-white mb-4">
              Auto Apply
            </h1>
            
            <p className="text-xl text-gray-400 mb-8">
              Coming Soon
            </p>
            
            <p className="text-gray-500 max-w-md mx-auto mb-8">
              This feature is currently being developed. We&apos;re working on bringing you an amazing 
              automated job application experience.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => window.history.back()} 
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200"
            >
              Go Back
            </button>
            
            <a 
              href="/dashboard" 
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      </div>

      {/* Modal Dialog with blur overlay */}
      <Dialog 
        defaultOpen 
        onOpenChange={(open) => {
          if (!open) {
            handleNavigateToDashboard();
          }
        }}
      >
        <DialogContent className="max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white">
              Our wizards are brewing the potion
            </DialogTitle>
            <DialogDescription className="mt-2 text-gray-400">
              Auto-Apply is on the roadmap. Check back soon!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex justify-center">
            <Button 
              onClick={handleNavigateToDashboard}
              className="w-full sm:w-auto"
            >
              Back to Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}