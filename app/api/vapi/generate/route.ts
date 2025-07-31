import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";
import { withQuota } from "@/lib/middleware/quota-middleware";
import { NextRequest, NextResponse } from "next/server";

async function handleInterviewGeneration(request: NextRequest, context?: { userId: string }) {
    const { type, role, level, techstack, amount, userid: bodyUserId } = await request.json();

    // Get user ID from context (passed by middleware) or fallback to body in dev mode
    let userid = context?.userId || bodyUserId;
    
    // In development mode, allow passing userId in request body as fallback
    if (!userid && process.env.NODE_ENV !== 'production') {
        console.log('[DEV MODE] No userId in context, using body or generating mock ID');
        userid = bodyUserId || 'dev-user-' + Date.now();
    }
    
    if (!userid) {
        return NextResponse.json({ success: false, error: "User ID not available" }, { status: 401 });
    }

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

// Apply quota middleware to the POST handler
export const POST = withQuota({
  featureKey: 'interviews',
  limitFree: 3, // Free users can generate 3 interviews
  usageDocId: undefined // Use the authenticated user's ID
})(handleInterviewGeneration);

export async function GET() {
    return NextResponse.json({ success: true, data: "Thank you!" }, { status: 200 });
}
