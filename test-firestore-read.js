"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Mock the "use server" directive that's used in general.action.ts
global.jest = { hoisted: true };
// Import the functions directly from the source file
// Note: This bypasses the "use server" directive which is not applicable in our test environment
const general_action_1 = require("./lib/actions/general.action");
async function runReadTests() {
    console.log('Starting Firestore read operation tests...');
    // Test getInterviewById
    try {
        console.log('\nTesting getInterviewById...');
        const interview = await (0, general_action_1.getInterviewById)('test-interview-id');
        console.log('Result:', interview);
    }
    catch (error) {
        logError('getInterviewById', error);
    }
    // Test getFeedbackByInterviewId
    try {
        console.log('\nTesting getFeedbackByInterviewId...');
        const feedback = await (0, general_action_1.getFeedbackByInterviewId)({
            interviewId: 'test-interview-id',
            userId: 'test-user-id'
        });
        console.log('Result:', feedback);
    }
    catch (error) {
        logError('getFeedbackByInterviewId', error);
    }
    // Test getLatestInterviews
    try {
        console.log('\nTesting getLatestInterviews...');
        const interviews = await (0, general_action_1.getLatestInterviews)({
            userId: 'test-user-id',
            limit: 5
        });
        console.log('Result:', interviews);
    }
    catch (error) {
        logError('getLatestInterviews', error);
    }
    // Test getInterviewsByUserId
    try {
        console.log('\nTesting getInterviewsByUserId...');
        const interviews = await (0, general_action_1.getInterviewsByUserId)('test-user-id');
        console.log('Result:', interviews);
    }
    catch (error) {
        logError('getInterviewsByUserId', error);
    }
}
function logError(functionName, error) {
    console.error(`Error in ${functionName}:`);
    console.error(error);
    // Check for specific error types
    if (error.message && error.message.includes('Missing or insufficient permissions')) {
        console.log('ERROR TYPE: FirebaseError: Missing or insufficient permissions');
    }
    else if (error.message && error.message.includes('UNAVAILABLE: Metadata is empty')) {
        console.log('ERROR TYPE: UNAVAILABLE: Metadata is empty');
    }
    else if (error.message && (error.message.includes('SSL') || error.message.includes('network'))) {
        console.log('ERROR TYPE: SSL / network plugin related message');
    }
    // Print stack trace
    console.error('Stack trace:', error.stack);
}
runReadTests();
