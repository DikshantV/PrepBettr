import { NextRequest, NextResponse } from 'next/server';
import { gdprComplianceService } from '@/lib/services/gdpr-compliance-service';
import { withAuth, AuthenticatedUser } from '@/lib/middleware/authMiddleware';
import { azureFunctionsClient } from '@/lib/services/azure-functions-client';

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {

    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'record-consent':
        if (!data.consent) {
          return NextResponse.json(
            { error: 'Consent data is required' },
            { status: 400 }
          );
        }

        const consent = {
          ...data.consent,
          userId: user.uid
        };

        await gdprComplianceService.recordConsent(consent);
        return NextResponse.json({ success: true, message: 'Consent recorded successfully' });

      case 'get-consent':
        const userConsent = await gdprComplianceService.getConsent(user.uid);
        return NextResponse.json({ consent: userConsent });

      case 'update-consent':
        if (!data.updates) {
          return NextResponse.json(
            { error: 'Consent updates are required' },
            { status: 400 }
          );
        }

        await gdprComplianceService.updateConsent(user.uid, data.updates);
        return NextResponse.json({ success: true, message: 'Consent updated successfully' });

      case 'request-deletion':
        // Use Azure Functions for GDPR deletion if available
        try {
          const azureResult = await azureFunctionsClient.requestGDPRDeletion(
            user.uid,
            user.email || user.uid,
            data.reason || 'User requested account deletion'
          );
          
          if (azureResult.requestId) {
            return NextResponse.json({
              success: true,
              requestId: azureResult.requestId,
              status: azureResult.status,
              message: 'Data deletion request submitted via Azure Functions. Processing will begin within 30 days.',
              method: 'azure-functions'
            });
          } else {
            throw new Error('Azure Functions deletion failed: ' + azureResult.message);
          }
        } catch (azureError) {
          console.warn('Azure Functions deletion failed, using fallback:', azureError);
          
          // Fallback to original service
          const requestId = await gdprComplianceService.requestDataDeletion(
            user.uid,
            user.email || user.uid,
            data.reason
          );
          return NextResponse.json({
            success: true,
            requestId,
            message: 'Data deletion request submitted. Processing will begin within 30 days.',
            method: 'fallback'
          });
        }

      case 'deletion-status':
        if (!data.requestId) {
          return NextResponse.json(
            { error: 'Request ID is required' },
            { status: 400 }
          );
        }

        const status = await gdprComplianceService.getDeletionRequestStatus(data.requestId);
        return NextResponse.json({ status });

      case 'export-data':
        const exportData = await gdprComplianceService.exportUserData(user.uid);
        
        // Convert to JSON string for download
        const jsonData = JSON.stringify(exportData, null, 2);
        const buffer = Buffer.from(jsonData, 'utf-8');
        
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="user_data_export_${user.uid}.json"`,
            'Content-Length': buffer.length.toString(),
          },
        });

      case 'anonymize-analytics':
        if (!data.analyticsData) {
          return NextResponse.json(
            { error: 'Analytics data is required' },
            { status: 400 }
          );
        }

        const anonymizedData = gdprComplianceService.anonymizeAnalyticsData({
          ...data.analyticsData,
          userId: user.uid
        });

        return NextResponse.json({ anonymizedData });

      case 'mask-email':
        if (!data.email) {
          return NextResponse.json(
            { error: 'Email is required' },
            { status: 400 }
          );
        }

        const maskedEmail = gdprComplianceService.maskEmail(data.email);
        return NextResponse.json({ maskedEmail });

      case 'mask-phone':
        if (!data.phone) {
          return NextResponse.json(
            { error: 'Phone number is required' },
            { status: 400 }
          );
        }

        const maskedPhone = gdprComplianceService.maskPhoneNumber(data.phone);
        return NextResponse.json({ maskedPhone });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('GDPR compliance error for user:', user.uid, error);
    return NextResponse.json(
      { 
        error: 'GDPR operation failed',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
});
