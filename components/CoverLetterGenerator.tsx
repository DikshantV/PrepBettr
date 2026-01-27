
"use client";

import React, { useState } from 'react';
import { Upload, FileText, Zap, Download, Copy, Check, AlertCircle, Link } from 'lucide-react';
import BanterLoader from '@/components/ui/BanterLoader';
import { jsPDF } from "jspdf";

// Function to parse PDF files on the client side
async function parsePdfFile(file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/parse-pdf', {
      method: 'POST',
      body: formData,
      credentials: 'include', // Include cookies for session authentication
    });

    if (!response.ok) {
      // Check if response is JSON or HTML error page
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to parse PDF');
      } else {
        // HTML error page returned
        console.error('Server returned HTML error page instead of JSON');
        throw new Error('Server error while parsing PDF. Please try again.');
      }
    }

    const data = await response.json();
    return data.text || '';
  } catch (error) {
    console.error('Error parsing PDF:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to parse PDF file. Please try converting to text format.');
  }
}

// Function to scrape job description from URL
async function scrapeJobUrl(jobUrl: string): Promise<string> {
  try {
    // Note: Authentication via session cookies (no need for localStorage token)
    const response = await fetch('/api/scrape-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for session authentication
      body: JSON.stringify({ jobUrl }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 401) {
        throw new Error('Please sign in to use this feature');
      }
      if (response.status === 429) {
        throw new Error('Too many requests. Please try again later.');
      }
      if (response.status === 500) {
        throw new Error('Failed to extract job description. Please try manual entry.');
      }
      throw new Error(data.error || 'Failed to extract job description');
    }

    return data.jobDescription || '';
  } catch (error) {
    console.error('Job scraping API Error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to extract job description from URL.');
  }
}

// Function to generate cover letter using server-side API
async function generateCoverLetter(resumeText: string, jobDescription: string): Promise<string> {
  try {
    // Note: Authentication via session cookies (no need for localStorage token)
    const response = await fetch('/api/cover-letter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for session authentication
      body: JSON.stringify({
        resumeText,
        jobDescription,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate cover letter');
    }

    return data.coverLetter;
  } catch (error) {
    console.error('Cover letter generation API Error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate cover letter. Please try again.');
  }
}

const CoverLetterGeneratorSection = () => {
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScrapingJob, setIsScrapingJob] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Computed property - explicitly track if generation is ready
  const canGenerate = Boolean(resumeText.trim() && jobDescription.trim() && !isProcessing && !isScrapingJob && !isParsingResume);
  

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'resume' | 'job') => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setIsParsingResume(true);
    
    try {
      const file = files[0];
      let text = '';

      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size exceeds 10MB limit. Please use a smaller file.');
      }

      if (file.type === 'text/plain') {
        text = await file.text();
      } else if (file.type === 'application/pdf') {
        text = await parsePdfFile(file);
      } else {
        throw new Error('Unsupported file type. Please use PDF or TXT files.');
      }

      if (type === 'resume') {
        setResumeText(text);
        console.log('✅ Resume uploaded successfully - ready to paste job description or URL');
      } else {
        setJobDescription(text);
        console.log('✅ Job description uploaded successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process the file.';
      setError(errorMessage);
      console.error('Error parsing file:', error);
    } finally {
      setIsParsingResume(false);
      // Note: We do NOT auto-generate here - user must explicitly click Generate button
    }
  };

  const handleExtractJobUrl = async () => {
    if (!jobUrl.trim()) {
      setError('Please enter a job posting URL.');
      return;
    }

    // Basic URL validation
    try {
      new URL(jobUrl);
    } catch {
      setError('Please enter a valid URL (e.g., https://example.com/job)');
      return;
    }

    setError(null);
    setIsScrapingJob(true);

    try {
      const extractedText = await scrapeJobUrl(jobUrl);
      setJobDescription(extractedText);
      setJobUrl(''); // Clear URL input after successful extraction
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract job description from URL.';
      setError(errorMessage);
      console.error('Error extracting job URL:', error);
    } finally {
      setIsScrapingJob(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
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
    setGeneratedCoverLetter('');

    try {
      const coverLetter = await generateCoverLetter(resumeText, jobDescription);
      setGeneratedCoverLetter(coverLetter);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while generating the cover letter.';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedCoverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      setError('Failed to copy to clipboard.');
    }
  };

  const downloadAsPdf = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxLineWidth = pageWidth - 2 * margin;
      const footerMargin = 10;
      
      let y = margin;
      
      // Helper function to add footer
      const addFooter = () => {
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128); // Gray color
        doc.setFont('helvetica', 'normal');
        const footerText = 'Generated by PrepBettr';
        const footerWidth = doc.getTextWidth(footerText);
        doc.text(footerText, (pageWidth - footerWidth) / 2, pageHeight - footerMargin);
        doc.setTextColor(0, 0, 0); // Reset to black
      };
      
      // Extract user name from resume (first line or first occurrence of name pattern)
      let userName = '';
      const resumeLines = resumeText.split('\n');
      const firstLine = resumeLines[0]?.trim();
      if (firstLine && firstLine.length < 50 && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+/.test(firstLine)) {
        userName = firstLine;
      }
      
      // Extract email and phone from resume
      const emailMatch = resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const phoneMatch = resumeText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
      const userEmail = emailMatch ? emailMatch[0] : '';
      const userPhone = phoneMatch ? phoneMatch[0] : '';
      
      // Add user header if available
      if (userName || userEmail || userPhone) {
        // User name
        if (userName) {
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(userName, margin, y);
          y += 8;
        }
        
        // Contact info
        if (userEmail || userPhone) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          const contactInfo = [userEmail, userPhone].filter(Boolean).join(' | ');
          doc.text(contactInfo, margin, y);
          y += 6;
        }
        
        y += 4; // Extra spacing after header
      }
      
      // Add date (right-aligned)
      const today = new Date();
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
      const dateStr = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const dateWidth = doc.getTextWidth(dateStr);
      doc.text(dateStr, pageWidth - margin - dateWidth, userName || userEmail || userPhone ? margin : margin);
      
      // Add blank line after date
      y = Math.max(y, margin + 10);
      y += 6;
      
      // Set font for cover letter content
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      
      // Split text into lines that fit within the page width
      const lines = doc.splitTextToSize(generatedCoverLetter, maxLineWidth);
      const lineHeight = 6;
      const bottomMargin = margin + 15; // Extra space for footer
      
      for (let i = 0; i < lines.length; i++) {
        // Check if we need a new page
        if (y + lineHeight > pageHeight - bottomMargin) {
          addFooter();
          doc.addPage();
          y = margin;
        }
        
        doc.text(lines[i], margin, y);
        y += lineHeight;
      }
      
      // Add footer to last page
      addFooter();
      
      // Generate dynamic filename
      const sanitizeFilename = (text: string): string => {
        return text
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .substring(0, 30) // Limit length
          .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
      };
      
      // Extract job title from job description (first line or common patterns)
      let jobTitle = 'position';
      const jobLines = jobDescription.split('\n');
      const firstJobLine = jobLines[0]?.trim();
      
      // Try to extract job title from common patterns
      const titlePatterns = [
        /(?:job title|position|role)\s*:?\s*([^\n]+)/i,
        /^([A-Z][^\n]{5,50})$/m, // Capitalized line, 5-50 chars
      ];
      
      for (const pattern of titlePatterns) {
        const match = jobDescription.match(pattern);
        if (match && match[1]) {
          jobTitle = match[1].trim();
          break;
        }
      }
      
      // Fallback to first line if it looks like a title
      if (jobTitle === 'position' && firstJobLine && firstJobLine.length < 50 && firstJobLine.length > 5) {
        jobTitle = firstJobLine;
      }
      
      const sanitizedJobTitle = sanitizeFilename(jobTitle);
      const timestamp = Date.now();
      const filename = `cover-letter-${sanitizedJobTitle}-${timestamp}.pdf`;
      
      doc.save(filename);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      setError('Failed to download PDF.');
    }
  };

  return (
    <div className="w-full h-full p-6 mb-8">
      {isProcessing && <BanterLoader overlay text="Generating Cover Letter..." />}
      {isScrapingJob && <BanterLoader overlay text="Extracting job description..." />}
      {isParsingResume && <BanterLoader overlay text="Processing resume..." />}
      <div className="mb-6">
        <p className="text-gray-300">
          Upload your resume and a job description to generate a compelling, AI-powered cover letter tailored to the role.
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
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-4">
              <FileText className="w-5 h-5 text-blue-400 mr-2" />
              <h3 className="text-xl font-semibold text-white">Your Resume</h3>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Upload Resume File (PDF or TXT format)
              </label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:border-blue-500 hover:bg-gray-750 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-4 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-300">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-400">PDF or TXT files</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.txt"
                    onChange={(e) => handleFileUpload(e, 'resume')}
                  />
                </label>
              </div>
            </div>

          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 shadow-md">
            <div className="flex items-center mb-4">
              <FileText className="w-5 h-5 text-green-400 mr-2" />
              <h3 className="text-xl font-semibold text-white">Job Description</h3>
            </div>

            {/* Job URL Input */}
            <div className="mb-4">
              <label htmlFor="job-url" className="block text-sm font-medium text-gray-200 mb-2">
                Job Posting URL (Optional)
              </label>
              <p className="text-xs text-gray-400 mb-2">
                Paste a job posting URL to auto-extract the description
              </p>
              <div className="flex gap-2">
                <input
                  id="job-url"
                  type="text"
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 text-white placeholder-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com/job-posting"
                  value={jobUrl}
                  onChange={(e) => {
                    setJobUrl(e.target.value);
                    setError(null);
                  }}
                  disabled={isScrapingJob}
                />
                <button
                  onClick={handleExtractJobUrl}
                  disabled={!jobUrl.trim() || isScrapingJob}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    !jobUrl.trim() || isScrapingJob
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-600'
                      : 'bg-green-600 hover:bg-green-700 text-white border border-green-600'
                  } focus:outline-none focus:ring-2 focus:ring-green-500`}
                >
                  {isScrapingJob ? (
                    <>
                      <BanterLoader />
                      <span className="ml-2">Extracting...</span>
                    </>
                  ) : (
                    <>
                      <Link className="w-4 h-4 mr-2" />
                      Extract from URL
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Manual Job Description Textarea */}
            <div className="mb-4">
              <label htmlFor="job-description" className="block text-sm font-medium text-gray-200 mb-2">
                Or paste the job description here
              </label>
              <textarea
                id="job-description"
                rows={6}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white placeholder-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Paste the job description here..."
                value={jobDescription}
                onChange={(e) => {
                  setJobDescription(e.target.value);
                  setError(null);
                }}
                disabled={isScrapingJob}
              />
            </div>
          </div>

          <button
            onClick={handleGenerateCoverLetter}
            disabled={!canGenerate}
            aria-disabled={!canGenerate}
            className={`w-full flex items-center justify-center px-6 py-3 text-base font-medium rounded-md transition-colors ${
              !canGenerate
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed border border-gray-600'
                : 'bg-blue-600 hover:bg-blue-700 text-white border border-blue-600'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            {isProcessing ? (
              <>
                <BanterLoader />
                <span className="ml-3">Generating Cover Letter...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Generate Cover Letter
              </>
            )}
          </button>
          {!canGenerate && !isProcessing && (
            <p className="text-sm text-gray-400 text-center mt-2">
              {!resumeText && !jobDescription
                ? 'Upload your resume and provide a job description to get started'
                : !resumeText
                ? 'Please upload your resume first'
                : !jobDescription
                ? 'Please provide a job description or paste a job URL'
                : 'Processing... please wait'}
            </p>
          )}
        </div>

        {/* Right Column - Results */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 shadow-md flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Generated Cover Letter</h2>
            {generatedCoverLetter && (
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
                  onClick={downloadAsPdf}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download PDF
                </button>
              </div>
            )}
          </div>

          {isProcessing ? (
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center flex-1 flex items-center justify-center flex-col space-y-4">
              <BanterLoader />
              <p className="text-gray-300">Generating your cover letter with AI...</p>
              <p className="text-sm text-gray-400">This may take a few moments.</p>
            </div>
          ) : generatedCoverLetter ? (
            <div className="border border-gray-600 rounded-md p-4 flex-1 overflow-y-auto bg-gray-800">
              <pre className="whitespace-pre-wrap font-sans text-white text-sm leading-relaxed">
                {generatedCoverLetter}
              </pre>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center flex-1 flex items-center justify-center">
              <div>
                <FileText className="w-12 h-12 mx-auto text-gray-500 mb-4" />
                <p className="text-gray-400">Your generated cover letter will appear here.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoverLetterGeneratorSection;

