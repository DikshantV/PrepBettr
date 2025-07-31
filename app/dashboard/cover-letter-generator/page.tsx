"use client";

import dynamic from "next/dynamic";

// Dynamic import for CoverLetterGenerator component that requires DOM APIs
const CoverLetterGenerator = dynamic(() => import("@/components/dynamic/CoverLetterGeneratorDynamic"), {
  ssr: false
});

export default function CoverLetterGeneratorPage() {
  return (
    <div className="w-full min-h-screen flex flex-col">
      <div className="flex-1 p-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">AI-Powered Cover Letter Generator</h1>
        </div>
        <CoverLetterGenerator />
      </div>
    </div>
  );
}
