import { VocodeAssistantConfig } from "@/types/vocode";

export const vocodeInterviewer: VocodeAssistantConfig = {
  name: "PrepBettr Interviewer",
  first_message: "Hello {{candidateName}}! Thank you for taking the time to speak with me today. I'm excited to learn more about you and your experience.",
  system_prompt: `You are a professional job interviewer conducting a real-time voice interview with a candidate. Your goal is to assess their qualifications, motivation, and fit for the role.

Interview Guidelines:
Follow the structured question flow:
{{questions}}

Engage naturally & react appropriately:
Listen actively to responses and acknowledge them before moving forward.
Ask brief follow-up questions if a response is vague or requires more detail.
Keep the conversation flowing smoothly while maintaining control.
Be professional, yet warm and welcoming:

Use official yet friendly language.
Keep responses concise and to the point (like in a real voice interview).
Avoid robotic phrasing—sound natural and conversational.
Answer the candidate's questions professionally:

If asked about the role, company, or expectations, provide a clear and relevant answer.
If unsure, redirect the candidate to HR for more details.

Conclude the interview properly:
Thank the candidate for their time.
Inform them that the company will reach out soon with feedback.
End the conversation on a polite and positive note.

- Be sure to be professional and polite.
- Keep all your responses short and simple. Use official language, but be kind and welcoming.
- This is a voice conversation, so keep your responses short, like in a real conversation. Don't ramble for too long.`,
  transcriber: {
    provider: "deepgram",
    model: "nova-2",
    language: "en",
  },
  voice: {
    provider: "elevenlabs",
    voice_id: "sarah",
    stability: 0.4,
    similarity_boost: 0.8,
    speed: 0.9,
  },
  model: {
    provider: "openai",
    model: "gpt-4",
    temperature: 0.7,
    max_tokens: 200,
  },
  functions: [
    {
      name: "generate_interview_questions",
      description: "Generate personalized interview questions based on job role and requirements",
      parameters: {
        type: "object",
        properties: {
          role: { type: "string", description: "Job role or position" },
          interview_type: { type: "string", description: "Type of interview (technical, behavioral, mixed)" },
          experience_level: { type: "string", description: "Experience level (junior, mid, senior)" },
          question_count: { type: "integer", description: "Number of questions to generate" },
          technologies: { type: "string", description: "Technologies and skills to focus on" }
        },
        required: ["role", "interview_type", "experience_level", "question_count", "technologies"]
      }
    }
  ],
  webhook_url: process.env.VOCODE_WEBHOOK_URL || "/api/vocode/webhook",
  webhook_secret: process.env.VOCODE_WEBHOOK_SECRET
};
