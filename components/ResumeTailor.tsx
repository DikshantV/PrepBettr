"use client";

import React, { useState } from 'react';
import { Upload, FileText, Zap, Download, Copy, Check, Loader2 } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GOOGLE_AI_API_KEY || '');

// Function to generate tailored resume using Gemini
async function generateTailoredResume(resumeText: string, jobDescription: string): Promise<string> {
  try {
    // Get the Gemini Pro model
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const prompt = `You are an expert resume writer and career coach. Please tailor this resume to better match the following job description.
    
    JOB DESCRIPTION:
    ${jobDescription}
    
    RESUME:
    ${resumeText}
    
    Please provide a tailored version of the resume that:
    1. Highlights relevant skills and experiences that match the job requirements
    2. Uses keywords from the job description
    3. Maintains the original format and sections
    4. Keeps the same length as the original resume
    5. Focuses on quantifiable achievements
    
    Return ONLY the tailored resume content, with no additional commentary or explanations.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating tailored resume:', error);
    throw new Error('Failed to generate tailored resume. Please try again.');
  }
}

const ResumeTailorSection = () => {
    const [resumeText, setResumeText] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [tailoredResume, setTailoredResume] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'resume' | 'job') => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        
        const file = files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (type === 'resume') {
                setResumeText(text);
            } else {
                setJobDescription(text);
            }
        };
        
        reader.readAsText(file);
    };

    const extractKeywords = (text: string) => {
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those']);

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

    const tailorResume = async () => {
        if (!resumeText.trim() || !jobDescription.trim()) {
            alert('Please provide both resume and job description');
            return;
        }

        setIsProcessing(true);
        setTailoredResume('');

        try {
            const tailoredContent = await generateTailoredResume(resumeText, jobDescription);
            setTailoredResume(tailoredContent);
        } catch (error) {
            console.error('Error:', error);
            alert(error instanceof Error ? error.message : 'An error occurred while tailoring your resume');
            
            // Fallback to simple keyword matching if Gemini fails
            const jobKeywords = extractKeywords(jobDescription);
            const resumeLines = resumeText.split('\n');
            const tailoredLines = resumeLines.map(line => {
                let tailoredLine = line;
                jobKeywords.forEach(keyword => {
                    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                    if (regex.test(line)) {
                        tailoredLine = line.replace(regex, (match) => `**${match}**`);
                    }
                });
                return tailoredLine;
            });
            
            const skillsSection = `\n\nKEY SKILLS MATCHING THIS ROLE (generated from keywords):\n${jobKeywords.slice(0, 10).join(' • ')}\n`;
            setTailoredResume(tailoredLines.join('\n') + skillsSection);
        } finally {
            setIsProcessing(false);
        }
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(tailoredResume);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    const downloadTailoredResume = () => {
        const blob = new Blob([tailoredResume], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tailored-resume.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="w-full h-full p-6 mb-8">
            <div className="mb-6">
                <p className="text-gray-400">Upload your resume and job description to get a tailored version that matches the role</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                {/* Left Column - Inputs */}
                <div className="space-y-6">
                    {/* Resume Input Section */}
                    <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800">
                        <div className="flex items-center mb-4">
                            <FileText className="w-5 h-5 text-blue-400 mr-2" />
                            <h3 className="text-xl font-semibold text-white">Your Resume</h3>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Upload Resume File
                            </label>
                            <div className="flex items-center justify-center w-full">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-800/50 hover:border-blue-500 transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload className="w-8 h-8 mb-4 text-gray-500" />
                                        <p className="mb-2 text-sm text-gray-400">
                                            <span className="font-semibold">Click to upload</span> or drag and drop
                                        </p>
                                        <p className="text-xs text-gray-500">TXT, PDF, DOC files</p>
                                    </div>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept=".txt,.pdf,.doc,.docx"
                                        onChange={(e) => handleFileUpload(e, 'resume')}
                                    />
                                </label>
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Or paste your resume text
                            </label>
                            <textarea
                                value={resumeText}
                                onChange={(e) => setResumeText(e.target.value)}
                                placeholder="Paste your resume content here..."
                                className="w-full h-40 p-3 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            />
                        </div>
                    </div>

                    {/* Job Description */}
                    <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800">
                        <h2 className="text-xl font-semibold mb-4 text-white">Job Description</h2>
                        <div className="mb-4">
                            <label htmlFor="job-description" className="block text-sm font-medium text-gray-300 mb-1">
                                Paste the job description here
                            </label>
                            <textarea
                                id="job-description"
                                rows={8}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Paste the job description here..."
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Tailor Button */}
                    <button
                        onClick={tailorResume}
                        disabled={!resumeText || !jobDescription || isProcessing}
                        className={`w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white ${!resumeText || !jobDescription || isProcessing
                            ? 'bg-blue-900/50 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors`}
                    >
                        {isProcessing ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </>
                        ) : (
                            <>
                                <Zap className="w-5 h-5 mr-2" />
                                Tailor My Resume
                            </>
                        )}
                    </button>
                </div>

                {/* Right Column - Results */}
                <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-white">Tailored Resume</h2>
                        {tailoredResume && (
                            <div className="flex space-x-2">
                                <button
                                    onClick={copyToClipboard}
                                    className="inline-flex items-center px-3 py-1.5 border border-gray-700 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
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
                                    className="inline-flex items-center px-3 py-1.5 border border-gray-700 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                >
                                    <Download className="w-4 h-4 mr-1" />
                                    Download
                                </button>
                            </div>
                        )}
                    </div>

                    {isProcessing ? (
                        <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center flex-1 flex items-center justify-center flex-col space-y-4">
                            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                            <p className="text-gray-400">Tailoring your resume with AI. This may take a moment...</p>
                            <p className="text-sm text-gray-500">Analyzing job requirements and optimizing your resume</p>
                        </div>
                    ) : tailoredResume ? (
                        <div className="border border-gray-700 rounded-md p-4 flex-1 overflow-y-auto bg-gray-800/30">
                            <pre className="whitespace-pre-wrap font-sans text-gray-200">{tailoredResume}</pre>
                        </div>
                    ) : (
                        <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center flex-1 flex items-center justify-center">
                            <div>
                                <FileText className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                                <p className="text-gray-500">Your tailored resume will appear here</p>
                                <p className="text-sm text-gray-600 mt-2">Paste your resume and job description, then click &quot;Tailor My Resume&quot;</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResumeTailorSection;