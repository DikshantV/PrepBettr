const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * GDPR Data Deletion Function - Deletes all user data within 30 days
 */
exports.deleteUserData = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Request must be authenticated'
    );
  }

  const { requestId, userId, reason } = data;
  const requestingUserId = context.auth.uid;

  // Users can only delete their own data (unless admin)
  if (userId !== requestingUserId && !context.auth.token?.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Users can only delete their own data'
    );
  }

  let requestRef;
  
  try {
    const db = admin.firestore();
    const storage = admin.storage();
    requestRef = db.collection('dataDeletionRequests').doc();
    
    // Create deletion request
    const deletionRequest = {
      userId: userId || requestingUserId,
      requestedBy: context.auth.email || requestingUserId,
      requestDate: admin.firestore.FieldValue.serverTimestamp(),
      reason: reason || 'User requested account deletion',
      status: 'processing',
      deletedData: []
    };

    await requestRef.set(deletionRequest);
    const generatedRequestId = requestRef.id;

    console.log(`Processing data deletion request: ${generatedRequestId} for user: ${userId || requestingUserId}`);
    
    const userIdToDelete = userId || requestingUserId;
    const deletedCollections = [];

    // Collections to delete from
    const collectionsToDelete = [
      'users',
      'userProfiles', 
      'resumes',
      'interviews',
      'analytics',
      'userConsents',
      'usage'
    ];

    // Delete from Firestore collections
    for (const collectionName of collectionsToDelete) {
      try {
        const batch = db.batch();
        const snapshot = await db.collection(collectionName)
          .where('userId', '==', userIdToDelete)
          .get();
        
        if (!snapshot.empty) {
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          await batch.commit();
          deletedCollections.push(collectionName);
          console.log(`Deleted ${snapshot.docs.length} documents from ${collectionName}`);
        }
      } catch (error) {
        console.error(`Error deleting from ${collectionName}:`, error);
      }
    }

    // Delete from Firebase Storage
    try {
      const bucket = storage.bucket();
      const [files] = await bucket.getFiles({
        prefix: `users/${userIdToDelete}/`
      });
      
      if (files.length > 0) {
        const deletePromises = files.map(file => file.delete());
        await Promise.all(deletePromises);
        deletedCollections.push('storage');
        console.log(`Deleted ${files.length} files from storage`);
      }
    } catch (error) {
      console.error('Error deleting from storage:', error);
    }

    // Delete the user's authentication record
    try {
      await admin.auth().deleteUser(userIdToDelete);
      deletedCollections.push('auth');
      console.log(`Deleted authentication record for user: ${userIdToDelete}`);
    } catch (error) {
      console.error('Error deleting auth record:', error);
    }

    // Update deletion request status
    await requestRef.update({
      status: 'completed',
      completedDate: admin.firestore.FieldValue.serverTimestamp(),
      deletedData: deletedCollections
    });

    // Log the deletion for audit trail
    await db.collection('dataProtectionAuditLog').add({
      userId: userIdToDelete,
      action: 'data_deletion_completed',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      deletedCollections: deletedCollections,
      requestId: generatedRequestId,
      requestedBy: context.auth.email || requestingUserId
    });

    console.log(`Data deletion completed for user: ${userIdToDelete}`);

    return {
      success: true,
      requestId: generatedRequestId,
      deletedCollections,
      message: 'User data has been permanently deleted'
    };
    
  } catch (error) {
    console.error('Error in deleteUserData function:', error);
    
    // Update request status to failed if we have a request ID
    if (requestRef) {
      try {
        await requestRef.update({
          status: 'failed',
          error: error.message,
          failedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (updateError) {
        console.error('Error updating failed status:', updateError);
      }
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'Failed to delete user data: ' + error.message
    );
  }
});

/**
 * Scheduled function to process data deletion requests (runs daily)
 */
exports.processScheduledDeletions = functions.pubsub
  .schedule('0 2 * * *') // Run at 2 AM UTC daily
  .onRun(async (context) => {
    const db = admin.firestore();
    
    try {
      // Find deletion requests that are 30 days old and still pending
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const pendingRequests = await db.collection('dataDeletionRequests')
        .where('status', '==', 'pending')
        .where('requestDate', '<=', thirtyDaysAgo)
        .get();
      
      console.log(`Found ${pendingRequests.docs.length} deletion requests to process`);
      
      // Process each pending request
      for (const doc of pendingRequests.docs) {
        const request = doc.data();
        
        try {
          // Call the deletion function for each pending request
          await exports.deleteUserData.run({
            userId: request.userId,
            requestId: doc.id,
            reason: 'Automatic 30-day deletion process'
          }, {
            auth: { uid: 'system', email: 'system@prepbettr.com' }
          });
          
          console.log(`Processed scheduled deletion for request: ${doc.id}`);
        } catch (error) {
          console.error(`Error processing deletion request ${doc.id}:`, error);
          
          // Mark as failed
          await doc.ref.update({
            status: 'failed',
            error: error.message,
            failedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error in processScheduledDeletions:', error);
      throw error;
    }
  });

/**
 * Export user data for GDPR compliance (Subject Access Request)
 */
exports.exportUserData = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Request must be authenticated'
    );
  }

  const { userId } = data;
  const requestingUserId = context.auth.uid;

  // Users can only export their own data (unless admin)
  if (userId && userId !== requestingUserId && !context.auth.token?.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Users can only export their own data'
    );
  }

  try {
    const db = admin.firestore();
    const userIdToExport = userId || requestingUserId;
    
    const exportData = {
      userId: userIdToExport,
      exportDate: admin.firestore.FieldValue.serverTimestamp(),
      requestedBy: context.auth.email || requestingUserId,
      data: {}
    };

    // Collections to export
    const collectionsToExport = [
      'users',
      'userProfiles',
      'resumes', 
      'interviews',
      'userConsents',
      'usage'
    ];

    // Export data from each collection
    for (const collectionName of collectionsToExport) {
      try {
        const snapshot = await db.collection(collectionName)
          .where('userId', '==', userIdToExport)
          .get();
        
        exportData.data[collectionName] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.error(`Error exporting ${collectionName}:`, error);
        exportData.data[collectionName] = [];
      }
    }

    // Log the export for audit trail
    await db.collection('dataProtectionAuditLog').add({
      userId: userIdToExport,
      action: 'data_export',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      requestedBy: context.auth.email || requestingUserId
    });

    console.log(`Data export completed for user: ${userIdToExport}`);

    return {
      success: true,
      exportData,
      message: 'User data exported successfully'
    };
    
  } catch (error) {
    console.error('Error in exportUserData function:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to export user data: ' + error.message
    );
  }
});
