"use client";

import React, { useState } from 'react';
import { Upload, FileText, Zap, Download, Copy, Check, Link, AlertCircle } from 'lucide-react';
import BanterLoader from '@/components/ui/BanterLoader';

// Function to generate tailored resume using server-side API
async function generateTailoredResume(resumeText: string, jobDescription: string): Promise<string> {
  try {
    const response = await fetch('/api/resume/tailor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resumeText,
        jobDescription,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate tailored resume');
    }

    return data.tailoredResume;
  } catch (error) {
    console.error('Resume tailoring API Error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate tailored resume. Please try again.');
  }
}

// Function to parse PDF files (client-side with limited functionality)
async function parsePdfFile(file: File): Promise<string> {
  try {
    const text = await file.text();
    return text;
  } catch (error) {
    throw new Error('PDF parsing is not fully supported in browser. Please convert to text format or use the text input.');
  }
}

// Function to parse DOCX files (simplified version)
async function parseDocxFile(file: File): Promise<string> {
  try {
    const text = await file.text();
    return text;
  } catch (error) {
    throw new Error('DOCX parsing requires server-side processing. Please convert to text format or use the text input.');
  }
}

// Function to extract text from URL (basic web scraping)
async function extractTextFromUrl(url: string): Promise<string> {
  try {
    // This would need to be implemented with a backend API call
    // For now, return an error message
    throw new Error('URL extraction requires backend implementation. Please copy and paste the job description instead.');
  } catch (error) {
    throw new Error('Unable to extract content from URL. Please copy and paste the job description instead.');
  }
}

const ResumeTailorSection = () => {
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobDescriptionUrl, setJobDescriptionUrl] = useState('');
  const [tailoredResume, setTailoredResume] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inputMethod, setInputMethod] = useState<'paste' | 'url'>('paste');
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'resume' | 'job') => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    
    try {
      const file = files[0];
      let text = '';

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size exceeds 10MB limit. Please use a smaller file.');
      }

      if (file.type === 'text/plain') {
        text = await file.text();
      } else if (file.type === 'application/pdf') {
        // For now, ask users to convert to text
        throw new Error('PDF files require server-side processing. Please convert to text format and paste the content instead.');
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // For now, ask users to convert to text
        throw new Error('DOCX files require server-side processing. Please convert to text format and paste the content instead.');
      } else {
        throw new Error('Unsupported file type. Please use TXT files or paste the content directly.');
      }

      if (type === 'resume') {
        setResumeText(text);
      } else {
        setJobDescription(text);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process the file.';
      setError(errorMessage);
      console.error('Error parsing file:', error);
    }
  };

  const handleUrlExtraction = async () => {
    if (!jobDescriptionUrl.trim()) {
      setError('Please enter a valid URL.');
      return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const text = await extractTextFromUrl(jobDescriptionUrl);
      setJobDescription(text);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract content from URL.';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const tailorResume = async () => {
    if (!resumeText.trim()) {
      setError('Please provide your resume content.');
      return;
    }

    if (!jobDescription.trim()) {
      setError('Please provide the job description.');
      return;
    }

    setError(null);
    setIsProcessing(true);
    setTailoredResume('');

    try {
      const tailoredContent = await generateTailoredResume(resumeText, jobDescription);
      setTailoredResume(tailoredContent);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while tailoring your resume.';
      setError(errorMessage);
      
      // Fallback: Simple keyword highlighting
      const keywords = extractKeywords(jobDescription);
      const highlightedResume = highlightKeywords(resumeText, keywords);
      setTailoredResume(`${highlightedResume}\n\n--- KEYWORD ANALYSIS ---\nKey terms from job description: ${keywords.slice(0, 15).join(', ')}\n\nNote: AI tailoring failed, showing original resume with keyword highlights.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const extractKeywords = (text: string): string[] => {
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word));

    const wordCount: { [key: string]: number } = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    return Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  };

  const highlightKeywords = (resume: string, keywords: string[]): string => {
    let highlighted = resume;
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      highlighted = highlighted.replace(regex, `**${keyword.toUpperCase()}**`);
    });
    return highlighted;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(tailoredResume);
      setCopied(true);
      // Reset copy status after a brief moment without blocking UI
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      setError('Failed to copy to clipboard.');
    }
  };

  const downloadTailoredResume = () => {
    try {
      const blob = new Blob([tailoredResume], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tailored-resume.txt';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download file:', err);
      setError('Failed to download file.');
    }
  };

  return (
    <div className="w-full h-full p-6 mb-8">
      {isProcessing && <BanterLoader overlay text="Tailoring Resume with AI..." />}
      <div className="mb-6">
        <p className="text-gray-300">
          Upload your resume and provide a job description to get an AI-tailored version optimized for ATS systems and maximum job relevance.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-500/60 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
        {/* Left Column - Inputs */}
        <div className="space-y-6">
          {/* Resume Input Section - Enhanced dark theme consistency */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-4">
              <FileText className="w-5 h-5 text-blue-400 mr-2" />
              <h3 className="text-xl font-semibold text-white">Your Resume</h3>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Upload Resume File (TXT format recommended)
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:border-blue-500 hover:bg-gray-750 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-4 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-300">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-400">TXT files (PDF/DOCX coming soon)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".txt"
                    onChange={(e) => handleFileUpload(e, 'resume')}
                  />
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Or paste your resume text
              </label>
              <textarea
                value={resumeText}
                onChange={(e) => {
                  setResumeText(e.target.value);
                  setError(null);
                }}
                placeholder="Paste your resume content here..."
                className="w-full h-40 p-3 bg-gray-800 border border-gray-600 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Job Description Section - Enhanced dark theme consistency */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-4">
              <FileText className="w-5 h-5 text-green-400 mr-2" />
              <h3 className="text-xl font-semibold text-white">Job Description</h3>
            </div>

            {/* Input Method Toggle - Consistent with Auto-apply styling */}
            <div className="flex mb-4 bg-gray-800 border border-gray-600 rounded-lg p-1">
              <button
                onClick={() => setInputMethod('paste')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  inputMethod === 'paste'
                    ? 'bg-blue-600 text-white border border-blue-500'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }`}
              >
                Paste Text
              </button>
              <button
                onClick={() => setInputMethod('url')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  inputMethod === 'url'
                    ? 'bg-blue-600 text-white border border-blue-500'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                }`}
              >
                From URL
              </button>
            </div>

            {inputMethod === 'paste' ? (
              <div className="mb-4">
                <label htmlFor="job-description" className="block text-sm font-medium text-gray-200 mb-2">
                  Paste the job description here
                </label>
                <textarea
                  id="job-description"
                  rows={8}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white placeholder-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Paste the job description here..."
                  value={jobDescription}
                  onChange={(e) => {
                    setJobDescription(e.target.value);
                    setError(null);
                  }}
                />
              </div>
            ) : (
              <div className="mb-4">
                <label htmlFor="job-url" className="block text-sm font-medium text-gray-200 mb-2">
                  Enter job posting URL
                </label>
                <div className="flex">
                  <input
                    id="job-url"
                    type="url"
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 text-white placeholder-gray-400 rounded-l-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://company.com/job-posting"
                    value={jobDescriptionUrl}
                    onChange={(e) => {
                      setJobDescriptionUrl(e.target.value);
                      setError(null);
                    }}
                  />
                  <button
                    onClick={handleUrlExtraction}
                    disabled={!jobDescriptionUrl.trim() || isProcessing}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-r-md border-l-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <Link className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Note: URL extraction requires backend implementation. Please use paste method for now.
                </p>
              </div>
            )}
          </div>

          {/* Tailor Button - Consistent with Auto-apply button styling */}
          <button
            onClick={tailorResume}
            disabled={!resumeText || !jobDescription || isProcessing}
            className={`w-full flex items-center justify-center px-6 py-3 text-base font-medium rounded-md transition-colors ${
              !resumeText || !jobDescription || isProcessing
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-600'
                : 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-600'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            {isProcessing ? (
              <>
                <BanterLoader />
                <span className="ml-3">Tailoring Resume with AI...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Tailor My Resume
              </>
            )}
          </button>
        </div>

        {/* Right Column - Results - Enhanced dark theme consistency */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 shadow-md flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">ATS-Optimized Resume</h2>
            {tailoredResume && (
              <div className="flex space-x-2">
                <button
                  onClick={copyToClipboard}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 mr-1 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1" />
                  )}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={downloadTailoredResume}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </button>
              </div>
            )}
          </div>

          {isProcessing ? (
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center flex-1 flex items-center justify-center flex-col space-y-4">
              <BanterLoader />
              <p className="text-gray-300">Tailoring your resume with AI...</p>
              <p className="text-sm text-gray-400">Analyzing job requirements and optimizing for ATS compatibility</p>
            </div>
          ) : tailoredResume ? (
            <div className="border border-gray-600 rounded-md p-4 flex-1 overflow-y-auto bg-gray-800">
              <pre className="whitespace-pre-wrap font-sans text-white text-sm leading-relaxed">
                {tailoredResume}
              </pre>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center flex-1 flex items-center justify-center">
              <div>
                <FileText className="w-12 h-12 mx-auto text-gray-500 mb-4" />
                <p className="text-gray-400">Your ATS-optimized resume will appear here</p>
                <p className="text-sm text-gray-500 mt-2">
                  Provide your resume and job description, then click "Tailor My Resume"
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResumeTailorSection;
