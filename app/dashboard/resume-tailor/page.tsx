"use client";

import dynamic from "next/dynamic";

// Dynamic import for ResumeTailor component that requires DOM APIs
const ResumeTailor = dynamic(() => import("@/components/dynamic/ResumeTailorDynamic"), {
  ssr: false
});

export default function ResumeTailorPage() {
  return (
    <div className="w-full min-h-screen flex flex-col">
      <div className="flex-1 p-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">AI-Powered Resume Tailor</h1>
        </div>
        <ResumeTailor />
      </div>
    </div>
  );
}
