"use strict";
"use server";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFeedback = createFeedback;
exports.getInterviewById = getInterviewById;
exports.getFeedbackByInterviewId = getFeedbackByInterviewId;
exports.getLatestInterviews = getLatestInterviews;
exports.getInterviewsByUserId = getInterviewsByUserId;
const ai_1 = require("ai");
const google_1 = require("@ai-sdk/google");
const admin_1 = require("@/firebase/admin");
const constants_1 = require("@/constants");
async function createFeedback(params) {
    const { interviewId, userId, transcript, feedbackId } = params;
    try {
        const formattedTranscript = transcript
            .map((sentence) => `- ${sentence.role}: ${sentence.content}\n`)
            .join("");
        const { object } = await (0, ai_1.generateObject)({
            model: (0, google_1.google)("gemini-2.0-flash-001", {
                structuredOutputs: false,
            }),
            schema: constants_1.feedbackSchema,
            prompt: `
        You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.
        Transcript:
        ${formattedTranscript}

        Please score the candidate from 0 to 100 in the following areas. Do not add categories other than the ones provided:
        - **Communication Skills**: Clarity, articulation, structured responses.
        - **Technical Knowledge**: Understanding of key concepts for the role.
        - **Problem-Solving**: Ability to analyze problems and propose solutions.
        - **Cultural & Role Fit**: Alignment with company values and job role.
        - **Confidence & Clarity**: Confidence in responses, engagement, and clarity.
        `,
            system: "You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories",
        });
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
            feedbackRef = admin_1.db.collection("feedback").doc(feedbackId);
        }
        else {
            feedbackRef = admin_1.db.collection("feedback").doc();
        }
        await feedbackRef.set(feedback);
        return { success: true, feedbackId: feedbackRef.id };
    }
    catch (error) {
        console.error("Error saving feedback:", error);
        return { success: false };
    }
}
async function getInterviewById(id) {
    try {
        try {
            const interview = await admin_1.db.collection("interviews").doc(id).get();
            return interview.data();
        }
        catch (firestoreError) {
            console.error('Firestore error in getInterviewById:', firestoreError);
            return null;
        }
    }
    catch (error) {
        console.error('Error in getInterviewById:', error);
        return null;
    }
}
async function getFeedbackByInterviewId(params) {
    try {
        const { interviewId, userId } = params;
        try {
            const querySnapshot = await admin_1.db
                .collection("feedback")
                .where("interviewId", "==", interviewId)
                .where("userId", "==", userId)
                .limit(1)
                .get();
            if (querySnapshot.empty)
                return null;
            const feedbackDoc = querySnapshot.docs[0];
            return { id: feedbackDoc.id, ...feedbackDoc.data() };
        }
        catch (firestoreError) {
            console.error('Firestore error in getFeedbackByInterviewId:', firestoreError);
            return null;
        }
    }
    catch (error) {
        console.error('Error in getFeedbackByInterviewId:', error);
        return null;
    }
}
async function getLatestInterviews(params) {
    try {
        const { userId, limit = 20 } = params;
        let query = admin_1.db
            .collection("interviews")
            .where("finalized", "==", true)
            .orderBy("createdAt", "desc")
            .limit(limit);
        // Only add the userId filter if userId is provided
        if (userId) {
            query = query.where("userId", "!=", userId);
        }
        try {
            const interviews = await query.get();
            return interviews.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
        }
        catch (firestoreError) {
            console.error('Firestore error in getLatestInterviews:', firestoreError);
            // Return empty array on Firestore errors
            return [];
        }
    }
    catch (error) {
        console.error('Error in getLatestInterviews:', error);
        return [];
    }
}
async function getInterviewsByUserId(userId) {
    if (!userId) {
        return [];
    }
    try {
        try {
            const interviews = await admin_1.db
                .collection("interviews")
                .where("userId", "==", userId)
                .orderBy("createdAt", "desc")
                .get();
            return interviews.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
        }
        catch (firestoreError) {
            console.error('Firestore error in getInterviewsByUserId:', firestoreError);
            // Return empty array on Firestore errors
            return [];
        }
    }
    catch (error) {
        console.error('Error in getInterviewsByUserId:', error);
        return [];
    }
}
