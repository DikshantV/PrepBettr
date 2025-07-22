"use client";

import dynamic from 'next/dynamic';

const ResumeTailor = dynamic(
  () => import('../ResumeTailor'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full p-6 mb-8 bg-gray-900 border border-gray-700 rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-3/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="h-6 bg-gray-700 rounded mb-4"></div>
                <div className="h-32 bg-gray-700 rounded mb-4"></div>
                <div className="h-40 bg-gray-700 rounded"></div>
              </div>
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="h-6 bg-gray-700 rounded mb-4"></div>
                <div className="h-8 bg-gray-700 rounded mb-4"></div>
                <div className="h-32 bg-gray-700 rounded"></div>
              </div>
              <div className="h-12 bg-blue-700 rounded"></div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
              <div className="h-6 bg-gray-700 rounded mb-4"></div>
              <div className="flex-1 bg-gray-700 rounded h-96"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }
);

export default ResumeTailor;
