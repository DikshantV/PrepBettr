
"use client";

import React, { useState } from 'react';
import { Upload, FileText, Zap, Download, Copy, Check, AlertCircle } from 'lucide-react';
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
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to parse PDF');
    }

    const data = await response.json();
    return data.text || '';
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file. Please try converting to text format.');
  }
}

// Function to generate cover letter using server-side API
async function generateCoverLetter(resumeText: string, jobDescription: string): Promise<string> {
  try {
    const response = await fetch('/api/cover-letter', {
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
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'resume' | 'job') => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setIsProcessing(true);
    
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
      } else {
        setJobDescription(text);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process the file.';
      setError(errorMessage);
      console.error('Error parsing file:', error);
    } finally {
      setIsProcessing(false);
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
      
      // Split text into lines that fit within the page width
      const lines = doc.splitTextToSize(generatedCoverLetter, maxLineWidth);
      
      let y = margin;
      const lineHeight = 7;
      
      for (let i = 0; i < lines.length; i++) {
        if (y + lineHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(lines[i], margin, y);
        y += lineHeight;
      }
      
      doc.save("cover-letter.pdf");
    } catch (err) {
      console.error('Failed to download PDF:', err);
      setError('Failed to download PDF.');
    }
  };

  return (
    <div className="w-full h-full p-6 mb-8">
      {isProcessing && <BanterLoader overlay text="Generating Cover Letter..." />}
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
          </div>

          <button
            onClick={handleGenerateCoverLetter}
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
                <span className="ml-3">Generating Cover Letter...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Generate Cover Letter
              </>
            )}
          </button>
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

