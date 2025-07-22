"use client";
import React from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import dynamic from "next/dynamic";
const Globe = dynamic(() => import("@/components/ui/globe").then(m => m.Globe), { ssr:false });

export function BentoGridFeatures() {
  return (
    <section className="relative z-20 py-10 lg:py-40 max-w-7xl mx-auto bg-black">
      <div className="absolute inset-0 bg-black -z-10" />
      <div className="px-8">
        <h4 className="text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-medium text-white">
          Everything you need to ace your interview
        </h4>
        <p className="text-sm lg:text-base max-w-2xl my-4 mx-auto text-neutral-400 text-center font-normal">
          From AI-powered mock interviews to personalized feedback, our platform provides comprehensive tools to help you land your dream job.
        </p>
      </div>
      <div className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-6 mt-12 xl:border rounded-md dark:border-neutral-800">
          <div className="p-4 sm:p-8 relative overflow-hidden col-span-1 lg:col-span-4 border-b lg:border-r dark:border-neutral-800">
            <p className="max-w-5xl mx-auto text-left tracking-tight text-white text-xl md:text-2xl md:leading-snug">
              AI-powered mock interviews
            </p>
            <p className="text-sm text-neutral-400 font-normal text-left max-w-sm mx-0 md:text-sm my-2">
              Practice with our advanced AI that simulates real interview scenarios with instant, personalized feedback.
            </p>
            <div className="h-full w-full">
              <div className="relative flex py-8 px-2 gap-10 h-full">
                <div className="w-full p-5 mx-auto bg-white dark:bg-neutral-900 shadow-2xl group h-full">
                  <div className="flex flex-1 w-full h-full flex-col space-y-2">
                    {/* Placeholder for interview interface screenshot */}
                    <div className="h-full w-full aspect-square bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-sm flex items-center justify-center">
                      <div className="text-center p-8">
                        <div className="w-16 h-16 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Voice Interview Mode</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Natural conversation with AI interviewer</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-0 z-40 inset-x-0 h-60 bg-gradient-to-t from-white dark:from-black via-white dark:via-black to-transparent w-full pointer-events-none"></div>
                <div className="absolute top-0 z-40 inset-x-0 h-60 bg-gradient-to-b from-white dark:from-black via-transparent to-transparent w-full pointer-events-none"></div>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-8 relative overflow-hidden border-b col-span-1 lg:col-span-2 dark:border-neutral-800">
            <p className="max-w-5xl mx-auto text-left tracking-tight text-white text-xl md:text-2xl md:leading-snug">
              Real-time feedback
            </p>
            <p className="text-sm text-neutral-400 font-normal text-left max-w-sm mx-0 md:text-sm my-2">
              Get instant analysis of your performance with detailed insights and improvement suggestions.
            </p>
            <div className="h-full w-full">
              <div className="relative flex flex-col items-start p-8 gap-10 h-full overflow-hidden">
                <div className="flex flex-row -ml-20">
                  <div className="rounded-xl -mr-4 mt-4 p-1 bg-white dark:bg-neutral-800 dark:border-neutral-700 border border-neutral-100 shrink-0 overflow-hidden" tabIndex={0} style={{ transform: 'rotate(1.17deg)' }}>
                    <div className="rounded-lg h-20 w-20 md:h-40 md:w-40 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/20 dark:to-green-800/20 flex items-center justify-center">
                      <div className="text-2xl font-bold text-green-600">A+</div>
                    </div>
                  </div>
                  <div className="rounded-xl -mr-4 mt-4 p-1 bg-white dark:bg-neutral-800 dark:border-neutral-700 border border-neutral-100 shrink-0 overflow-hidden" tabIndex={0} style={{ transform: 'rotate(-4.79deg)' }}>
                    <div className="rounded-lg h-20 w-20 md:h-40 md:w-40 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 flex items-center justify-center">
                      <div className="text-sm font-semibold text-blue-600">Confidence</div>
                    </div>
                  </div>
                  <div className="rounded-xl -mr-4 mt-4 p-1 bg-white dark:bg-neutral-800 dark:border-neutral-700 border border-neutral-100 shrink-0 overflow-hidden" tabIndex={0} style={{ transform: 'rotate(6.46deg)' }}>
                    <div className="rounded-lg h-20 w-20 md:h-40 md:w-40 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/20 dark:to-purple-800/20 flex items-center justify-center">
                      <div className="text-sm font-semibold text-purple-600">Clarity</div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-row">
                  <div className="rounded-xl -mr-4 mt-4 p-1 bg-white dark:bg-neutral-800 dark:border-neutral-700 border border-neutral-100 shrink-0 overflow-hidden" tabIndex={0} style={{ transform: 'rotate(8.14deg)' }}>
                    <div className="rounded-lg h-20 w-20 md:h-40 md:w-40 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/20 dark:to-orange-800/20 flex items-center justify-center">
                      <div className="text-sm font-semibold text-orange-600">Technical</div>
                    </div>
                  </div>
                  <div className="rounded-xl -mr-4 mt-4 p-1 bg-white dark:bg-neutral-800 dark:border-neutral-700 border border-neutral-100 shrink-0 overflow-hidden" tabIndex={0} style={{ transform: 'rotate(-6.72deg)' }}>
                    <div className="rounded-lg h-20 w-20 md:h-40 md:w-40 bg-gradient-to-br from-pink-100 to-pink-200 dark:from-pink-900/20 dark:to-pink-800/20 flex items-center justify-center">
                      <div className="text-sm font-semibold text-pink-600">Speed</div>
                    </div>
                  </div>
                </div>
                <div className="absolute left-0 z-[100] inset-y-0 w-20 bg-gradient-to-r from-white dark:from-black to-transparent h-full pointer-events-none"></div>
                <div className="absolute right-0 z-[100] inset-y-0 w-20 bg-gradient-to-l from-white dark:from-black to-transparent h-full pointer-events-none"></div>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-8 relative overflow-hidden col-span-1 lg:col-span-3 lg:border-r dark:border-neutral-800">
            <p className="max-w-5xl mx-auto text-left tracking-tight text-white text-xl md:text-2xl md:leading-snug">
              Learn from the best
            </p>
            <p className="text-sm text-neutral-400 font-normal text-left max-w-sm mx-0 md:text-sm my-2">
              Access curated content and tips from successful candidates and industry experts.
            </p>
            <div className="h-full w-full">
              <div className="relative flex gap-10 h-full group/image">
                <div className="w-full mx-auto bg-transparent dark:bg-transparent group h-full">
                  <div className="flex flex-1 w-full h-full flex-col space-y-2 relative">
                    <div className="h-full w-full aspect-square bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-sm flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-sm"></div>
                      <div className="text-center p-8 relative z-10">
                        <div className="w-16 h-16 bg-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Expert Insights</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Learn from successful interviews</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-8 relative overflow-visible col-span-1 lg:col-span-3 border-b lg:border-none">
            <p className="max-w-5xl mx-auto text-left tracking-tight text-white text-xl md:text-2xl md:leading-snug">
              Track your progress
            </p>
            <p className="text-sm text-neutral-400 font-normal text-left max-w-sm mx-0 md:text-sm my-2">
              Monitor your improvement over time with detailed analytics and personalized recommendations.
            </p>
            <div className="h-full w-full flex flex-col">
              <div className="flex-1 flex items-center justify-center relative bg-transparent dark:bg-transparent mt-10">
                <div className="pointer-events-none flex items-center justify-center">
                  <Globe />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
