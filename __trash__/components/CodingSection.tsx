"use client";
import { useState } from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function CodingSection() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");

  return (
    <div className="bg-dark-100 rounded-lg p-4 shadow w-full h-[400px] flex flex-col">
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor="language" className="text-sm font-semibold">Language:</label>
        <select
          id="language"
          value={language}
          onChange={e => setLanguage(e.target.value)}
          className="border rounded px-2 py-1 bg-dark-200 text-white"
        >
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="sql">SQL</option>
        </select>
      </div>
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          width="100%"
          language={language}
          value={code}
          onChange={value => setCode(value || "")}
          theme="vs-dark"
          options={{ fontSize: 16, minimap: { enabled: false } }}
        />
      </div>
    </div>
  );
}

