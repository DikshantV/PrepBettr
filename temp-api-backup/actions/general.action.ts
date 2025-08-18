"use server";

import { getDBService } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";
import { azureOpenAIService } from '@/lib/services/azure-openai-service';

export async function createFeedback(params: CreateFeedbackParams) {
    const { interviewId, userId, transcript, feedbackId } = params;

    try {
        const formattedTranscript = transcript
            .map(
                (sentence: { role: string; content: string }) =>
                    `- ${sentence.role}: ${sentence.content}\n`
            )
            .join("");

        // Initialize Azure OpenAI service
        await azureOpenAIService.initialize();
        
        const prompt = `
You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.

Transcript:
${formattedTranscript}

Please score the candidate from 0 to 100 in the following areas and provide feedback in JSON format:

{
  "totalScore": <average of all category scores>,
  "categoryScores": {
    "communicationSkills": <score 0-100>,
    "technicalKnowledge": <score 0-100>,
    "problemSolving": <score 0-100>,
    "culturalRoleFit": <score 0-100>,
    "confidenceClarity": <score 0-100>
  },
  "strengths": ["strength1", "strength2", "strength3"],
  "areasForImprovement": ["area1", "area2", "area3"],
  "finalAssessment": "Overall assessment of the candidate's performance"
}

Score categories:
- **Communication Skills**: Clarity, articulation, structured responses.
- **Technical Knowledge**: Understanding of key concepts for the role.
- **Problem-Solving**: Ability to analyze problems and propose solutions.
- **Cultural & Role Fit**: Alignment with company values and job role.
- **Confidence & Clarity**: Confidence in responses, engagement, and clarity.

Return only valid JSON, no additional text.
`;
        
        const response = await azureOpenAIService.generateCompletion(prompt);
        const object = JSON.parse(response);

        const feedback = {
            interviewId: interviewId,
            userId: userId,
            totalScore: object.totalScore,
            categoryScores: object.categoryScores,
            strengths: object.strengths,
            areasForImprovement: object.areasForImprovement,
            finalAssessment: object.finalAssessment,
            createdAt: new Date().toISOString(),
        };

        let feedbackRef;

        if (feedbackId) {
            const db = getDBService();
            feedbackRef = db.collection("feedback").doc(feedbackId);
        } else {
            const db = getDBService();
            feedbackRef = db.collection("feedback").doc();
        }

        await feedbackRef.set(feedback);

        return { success: true, feedbackId: feedbackRef.id };
    } catch (error) {
        console.error("Error saving feedback:", error);
        return { success: false };
    }
}


export async function getFeedbackByInterviewId(
    params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
    try {
        const { interviewId, userId } = params;

        try {
            const db = getDBService();
            const querySnapshot = await db
                .collection("feedback")
                .where("interviewId", "==", interviewId)
                .where("userId", "==", userId)
                .limit(1)
                .get();

            if (querySnapshot.empty) return null;

            const feedbackDoc = querySnapshot.docs[0];
            return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
        } catch (firestoreError) {
            console.error('Firestore error in getFeedbackByInterviewId:', firestoreError);
            return null;
        }
    } catch (error) {
        console.error('Error in getFeedbackByInterviewId:', error);
        return null;
    }
}

