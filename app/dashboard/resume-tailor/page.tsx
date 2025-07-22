"use client";

import dynamic from "next/dynamic";
import { LuBrainCircuit } from "react-icons/lu";
import { PremiumBadge } from "@/components/PremiumBadge";

// Dynamic import for ResumeTailor component that requires DOM APIs
const ResumeTailor = dynamic(() => import("@/components/dynamic/ResumeTailorDynamic"), {
  ssr: false
});

export default function ResumeTailorPage() {
  return (
    <div className="w-full min-h-screen flex flex-col">
      <div className="flex-1 p-6 pb-24">
        <div className="flex items-center mb-6">
          <LuBrainCircuit className="text-3xl text-blue-400 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI-Powered Resume Tailor</h1>
          <PremiumBadge 
            feature="resumeTailor" 
            className="ml-3" 
            onClick={() => window.location.href = "/api/payments/create-checkout"}
          />
        </div>
        <ResumeTailor />
      </div>
    </div>
  );
}
