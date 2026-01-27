// Static export stubs
async function startVoiceConversation() {
  return { error: 'Static mode' };
}

export async function createFeedback(params: any) {
  return { success: false, feedbackId: null, error: 'Static mode' };
}

async function getFeedbackByInterviewId(params: any) {
  // Return null for static mode - no feedback available
  return null as any;
}
