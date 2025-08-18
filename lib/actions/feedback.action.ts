// Static export stubs
export async function generateFeedback() {
  return { error: 'Static mode' };
}

export async function getFeedbackByInterviewId(interviewId: string) {
  return { success: false, feedback: null, error: 'Static mode', details: 'Auth disabled in static mode' };
}
