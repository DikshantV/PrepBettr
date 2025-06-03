"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Agent from "@/components/Agent";
import { getCurrentUser } from "@/lib/actions/auth.action";
import PdfUploadButton from "@/components/PdfUploadButton";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const Page = () => {
    const [showEditor, setShowEditor] = useState(false);
    const [code, setCode] = useState("// Start coding here\n");
    const [user, setUser] = useState<any>(null);
    const [language, setLanguage] = useState("javascript");
    const languageOptions = [
        { label: "JavaScript", value: "javascript" },
        { label: "TypeScript", value: "typescript" },
        { label: "Python", value: "python" },
        { label: "Java", value: "java" },
        { label: "C++", value: "cpp" },
        { label: "C#", value: "csharp" },
        { label: "Go", value: "go" },
        { label: "PHP", value: "php" },
        { label: "Ruby", value: "ruby" },
    ];

    useEffect(() => {
        (async () => {
            const userData = await getCurrentUser();
            setUser(userData);
        })();
    }, []);

    return (
        <>
            <div className="flex items-center justify-between mb-4">
                <h3 className="mr-2">Interview generation</h3>
                {showEditor ? (
                  <div className="flex items-center gap-3">
                    <select
                        value={language}
                        onChange={e => setLanguage(e.target.value)}
                        className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 bg-white dark:bg-gray-900 dark:text-white"
                        aria-label="Select language"
                    >
                        {languageOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <PdfUploadButton />
                    <button
                        type="button"
                        aria-label="Open code editor"
                        onClick={() => setShowEditor((v) => !v)}
                        className="p-2 rounded-full border border-gray-300 dark:border-gray-700 shadow hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <svg className="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m8 8-4 4 4 4m8 0 4-4-4-4m-2-3-4 14"/>
                        </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <PdfUploadButton />
                    <button
                        type="button"
                        aria-label="Open code editor"
                        onClick={() => setShowEditor((v) => !v)}
                        className="p-2 rounded-full border border-gray-300 dark:border-gray-700 shadow hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <svg className="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m8 8-4 4 4 4m8 0 4-4-4-4m-2-3-4 14"/>
                        </svg>
                    </button>
                  </div>
                )}
            </div>
            {showEditor && (
                <div className="mb-6 border rounded-lg overflow-hidden">
                    <MonacoEditor
                        height="400px"
                        defaultLanguage={language}
                        language={language}
                        value={code}
                        onChange={value => setCode(value || "")}
                        theme="vs-dark"
                        options={{ fontSize: 14, minimap: { enabled: false } }}
                    />
                </div>
            )}
            {user && (
                <Agent
                    userName={user?.name}
                    userId={user?.id}
                    profileImage={user?.profileURL}
                    type="generate"
                />
            )}
        </>
    );
};

export default Page;

