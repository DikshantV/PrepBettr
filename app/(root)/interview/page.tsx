"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Agent from "@/components/Agent";
import CodeEditorToggle from "@/components/CodeEditorToggle";
import { getCurrentUser } from "@/lib/actions/auth.action";

const CodingSection = dynamic(() => import("@/components/CodingSection"), { ssr: false });

export default function InterviewPage() {
    const [open, setOpen] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        getCurrentUser().then(setUser);
    }, []);

    return (
        <>
            <div className="flex items-center justify-between p-0 m-0">
                <h3 className="py-0 my-0 leading-none">Interview generation</h3>
                <CodeEditorToggle open={open} setOpen={setOpen} />
            </div>
            <div className={`flex w-full transition-all duration-300 ${open ? "gap-4" : ""}`}>
                <div className={open ? "flex-1 min-w-0" : "w-full"}>
                    <div >
                        <Agent
                            userName={user?.name ?? ""}
                            userId={user?.id}
                            profileImage={user?.profileURL}
                            type="generate"
                        />
                    </div>
                </div>
                {open && (
                    <div className="w-[500px] max-w-full">
                        <CodingSection />
                    </div>
                )}
            </div>
        </>
    );
}