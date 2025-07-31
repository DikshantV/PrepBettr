import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { firebaseVerification } from '@/lib/services/firebase-verification';

async function handleInterviewGeneration(request: NextRequest) {
    const { type, role, level, techstack, amount, userid: bodyUserId } = await request.json();

    // Extract session cookie and verify user authentication
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
        return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }
    
    // Verify the session token
    const verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);
    
    if (!verificationResult.success || !verificationResult.decodedToken) {
        return NextResponse.json({ success: false, error: "Invalid session" }, { status: 401 });
    }
    
    const userid = verificationResult.decodedToken.uid;

    try {
        const { text: questions } = await generateText({
            model: google("gemini-2.0-flash-001"),
            prompt: `Prepare questions for a job interview.
        The job role is ${role}.
        The job experience level is ${level}.
        The tech stack used in the job is: ${techstack}.
        The focus between behavioural and technical questions should lean towards: ${type}.
        The amount of questions required is: ${amount}.
        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
        Return the questions formatted like this:
        ["Question 1", "Question 2", "Question 3"]
        
        Thank you! <3
    `,
        });

        const interview = {
            role: role,
            type: type,
            level: level,
            techstack: techstack.split(","),
            questions: JSON.parse(questions),
            userId: userid,
            finalized: true,
            coverImage: getRandomInterviewCover(),
            createdAt: new Date().toISOString(),
        };

        await db.collection("interviews").add(interview);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Error generating interview:", error);
        console.error("Error details:", {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : undefined,
            userid,
            type,
            role,
            level,
            techstack,
            amount
        });
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ 
            success: false, 
            error: errorMessage,
            details: error instanceof Error ? error.name : 'Unknown error type'
        }, { status: 500 });
    }
}

// POST handler without quota restrictions
export const POST = handleInterviewGeneration;

export async function GET() {
    return NextResponse.json({ success: true, data: "Thank you!" }, { status: 200 });
}
