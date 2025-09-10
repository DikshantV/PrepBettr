"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const roles = [
  { value: "software-engineer", label: "Software Engineer" },
  { value: "senior-software-engineer", label: "Senior Software Engineer" },
  { value: "junior-developer", label: "Junior Developer" },
  { value: "quantitative-analyst", label: "Quantitative Analyst" },
  { value: "health-informatics-specialist", label: "Health Informatics Specialist" },
];

const experienceLevels = [
  { value: "entry", label: "Entry Level" },
  { value: "mid", label: "Mid Level" },
  { value: "senior", label: "Senior Level" },
];

const industries = [
  { value: "tech", label: "Technology" },
  { value: "finance", label: "Finance" },
  { value: "healthcare", label: "Healthcare" },
];

export default function InterviewStartPage() {
  const [role, setRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [industry, setIndustry] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const router = useRouter();

  const handleStartInterview = async () => {
    if (!role || !experienceLevel || !industry) {
      alert("Please fill in all fields");
      return;
    }

    setIsStarting(true);
    
    try {
      // Create a mock interview session
      const sessionId = `session_${Date.now()}`;
      
      // Store session data
      sessionStorage.setItem('interviewSession', JSON.stringify({
        id: sessionId,
        role,
        experienceLevel,
        industry,
        voiceMode,
        startTime: Date.now()
      }));
      
      // Redirect to interview session
      router.push(`/dashboard/interview/${sessionId}`);
    } catch (error) {
      console.error("Failed to start interview:", error);
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Start Your Interview
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Configure your interview settings
          </p>
        </div>

        <form className="space-y-4">
          {/* Role Selection */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              data-testid="role-select"
            >
              <option value="">Select a role</option>
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Experience Level */}
          <div>
            <label htmlFor="experience" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Experience Level
            </label>
            <select
              id="experience"
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              data-testid="experience-level"
            >
              <option value="">Select experience level</option>
              {experienceLevels.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          {/* Industry */}
          <div>
            <label htmlFor="industry" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Industry
            </label>
            <select
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              data-testid="industry"
            >
              <option value="">Select industry</option>
              {industries.map((ind) => (
                <option key={ind.value} value={ind.value}>
                  {ind.label}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Mode Toggle */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="voiceMode"
              checked={voiceMode}
              onChange={(e) => setVoiceMode(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              data-testid="voice-mode-toggle"
            />
            <label htmlFor="voiceMode" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable Voice Interview
            </label>
          </div>

          {/* Voice Ready Indicator */}
          {voiceMode && (
            <div className="flex items-center space-x-2 text-green-600" data-testid="voice-ready-indicator">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">Voice mode ready</span>
            </div>
          )}

          {/* Start Button */}
          <Button
            type="button"
            onClick={handleStartInterview}
            disabled={isStarting || !role || !experienceLevel || !industry}
            className="w-full"
            data-testid="start-interview-btn"
          >
            {isStarting ? "Starting Interview..." : "Start Interview"}
          </Button>
        </form>
      </div>
    </div>
  );
}
