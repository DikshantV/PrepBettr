import { NextApiRequest, NextApiResponse } from 'next';
import { 
  createFeedback,
  getInterviewById,
  getFeedbackByInterviewId,
  getLatestInterviews,
  getInterviewsByUserId
} from '../../lib/actions/general.action';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const testMode = (req.query.mode as string) || 'read';
  const results = { errors: [], results: [] };

  try {
    // Test write operation (createFeedback)
    if (testMode === 'write' || testMode === 'all') {
      try {
        console.log('Testing createFeedback...');
        const result = await createFeedback({
          interviewId: 'test-interview-id',
          userId: 'test-user-id',
          transcript: [
            { role: 'interviewer', content: 'Tell me about yourself.' },
            { role: 'candidate', content: 'I am a software engineer with 5 years of experience.' }
          ],
          feedbackId: undefined
        });
        results.results.push({ method: 'createFeedback', result });
      } catch (error) {
        console.error('Error in createFeedback:', error);
        const errorType = categorizeError(error);
        results.errors.push({ method: 'createFeedback', error: errorType, message: error.message, stack: error.stack });
      }
    }

    // Test read operations
    if (testMode === 'read' || testMode === 'all') {
      // Test getInterviewById
      try {
        console.log('Testing getInterviewById...');
        const result = await getInterviewById('test-interview-id');
        results.results.push({ method: 'getInterviewById', result });
      } catch (error) {
        console.error('Error in getInterviewById:', error);
        const errorType = categorizeError(error);
        results.errors.push({ method: 'getInterviewById', error: errorType, message: error.message, stack: error.stack });
      }

      // Test getFeedbackByInterviewId
      try {
        console.log('Testing getFeedbackByInterviewId...');
        const result = await getFeedbackByInterviewId({
          interviewId: 'test-interview-id',
          userId: 'test-user-id'
        });
        results.results.push({ method: 'getFeedbackByInterviewId', result });
      } catch (error) {
        console.error('Error in getFeedbackByInterviewId:', error);
        const errorType = categorizeError(error);
        results.errors.push({ method: 'getFeedbackByInterviewId', error: errorType, message: error.message, stack: error.stack });
      }

      // Test getLatestInterviews
      try {
        console.log('Testing getLatestInterviews...');
        const result = await getLatestInterviews({
          userId: 'test-user-id',
          limit: 5
        });
        results.results.push({ method: 'getLatestInterviews', result });
      } catch (error) {
        console.error('Error in getLatestInterviews:', error);
        const errorType = categorizeError(error);
        results.errors.push({ method: 'getLatestInterviews', error: errorType, message: error.message, stack: error.stack });
      }

      // Test getInterviewsByUserId
      try {
        console.log('Testing getInterviewsByUserId...');
        const result = await getInterviewsByUserId('test-user-id');
        results.results.push({ method: 'getInterviewsByUserId', result });
      } catch (error) {
        console.error('Error in getInterviewsByUserId:', error);
        const errorType = categorizeError(error);
        results.errors.push({ method: 'getInterviewsByUserId', error: errorType, message: error.message, stack: error.stack });
      }
    }

    res.status(200).json({ 
      mode: process.env.NODE_ENV,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in API handler:', error);
    res.status(500).json({ 
      error: 'An error occurred during testing',
      message: error.message,
      stack: error.stack,
      mode: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  }
}

function categorizeError(error: any) {
  if (!error) return 'UNKNOWN';
  
  // Convert error to string to handle different error formats
  const errorStr = typeof error === 'object' ? 
    JSON.stringify(error) || error.toString() : 
    String(error);
  const errorMessage = error.message || errorStr;
  
  // Look for specific patterns in the error message
  if (errorMessage.includes('Missing or insufficient permissions')) {
    return 'PERMISSIONS';
  } else if (errorMessage.includes('UNAVAILABLE: Metadata is empty')) {
    return 'METADATA_EMPTY';
  } else if (errorMessage.includes('Getting metadata from plugin failed')) {
    return 'METADATA_PLUGIN';
  } else if (errorMessage.includes('DECODER routines')) {
    return 'SSL_DECODER';
  } else if (errorMessage.includes('SSL') || errorMessage.includes('network')) {
    return 'SSL_NETWORK';
  } else {
    return 'OTHER';
  }
}
