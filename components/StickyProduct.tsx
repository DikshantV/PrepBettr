import { CloudArrowUpIcon, CodeBracketIcon, SpeakerWaveIcon,  } from '@heroicons/react/20/solid';
import Image from 'next/image';

export default function StickyProduct() {
    return (
        <div className="bg-black w-full">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="flex flex-col lg:flex-row gap-12">
                    {/* Left Column - Text Content */}
                    <div className="lg:w-1/2">
                        <div className="max-w-lg">
                            <p className="text-base font-semibold text-indigo-400">Prep Smarter</p>
                            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                                Prep Like a Pro, With AI
                            </h1>
                            <p className="mt-6 text-lg leading-8 text-white/80">
                                Practice with AI, sharpen your coding skills, and improve your communication — so you walk into your next interview with confidence.
                            </p>

                            <div className="mt-12 space-y-8">
                                <div className="flex gap-x-4">
                                    <CloudArrowUpIcon className="h-6 w-6 text-indigo-400 flex-shrink-0" />
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">Upload Job Description or Resume</h3>
                                        <p className="mt-2 text-white/80">
                                            Tailors your interview experience by analyzing your resume or job description to simulate real-world interview rounds.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-x-4">
                                    <SpeakerWaveIcon className="h-6 w-6 text-indigo-400 flex-shrink-0" />
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">AI-Conducted Interview Rounds</h3>
                                        <p className="mt-2 text-white/80">
                                            Speak directly with an AI interviewer that simulates real interview rounds — from behavioral to technical — with follow-ups and instant feedback.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-x-4">
                                    <CodeBracketIcon className="h-6 w-6 text-indigo-400 flex-shrink-0" />
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">Solve & Explain Code</h3>
                                        <p className="mt-2 text-white/80">
                                            Use the built-in code editor to solve questions and explain your thought process — just like in real interviews.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Image */}
                    <div className="lg:w-1/2 flex items-center justify-center">
                        <div className="relative group w-full">
                            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl opacity-30 group-hover:opacity-50 blur-2xl transition-all duration-300"></div>
                            <Image
                                src="/stickyproduct.png"
                                alt="Sticky Product"
                                width={1000}
                                height={750}
                                className="relative w-full h-auto rounded-xl bg-gray-900/50 backdrop-blur-sm border border-gray-800/50 shadow-2xl shadow-indigo-500/10 hover:scale-105 transition-all duration-300"
                                priority
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
