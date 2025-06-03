// components/CodeEditorToggle.tsx
"use client";
import { Dispatch, SetStateAction } from "react";

export default function CodeEditorToggle({
                                             open,
                                             setOpen,
                                         }: {
    open: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;
}) {
    return (
        <button
            type="button"
            aria-label="Toggle code editor"
            onClick={() => setOpen((v) => !v)}
            className="p-0 rounded-full border-2 border-gray-400 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
            <svg className="w-8 h-8 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m8 8-4 4 4 4m8 0 4-4-4-4m-2-3-4 14"/>
            </svg>
        </button>
    );
}