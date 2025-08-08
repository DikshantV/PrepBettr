import { NextRequest, NextResponse } from 'next/server';
import { gdprComplianceService } from '@/lib/services/gdpr-compliance-service';
import { verifySession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
          userId: session.userId
        };

        await gdprComplianceService.recordConsent(consent);
        return NextResponse.json({ success: true, message: 'Consent recorded successfully' });

      case 'get-consent':
        const userConsent = await gdprComplianceService.getConsent(session.userId);
        return NextResponse.json({ consent: userConsent });

      case 'update-consent':
        if (!data.updates) {
          return NextResponse.json(
            { error: 'Consent updates are required' },
            { status: 400 }
          );
        }

        await gdprComplianceService.updateConsent(session.userId, data.updates);
        return NextResponse.json({ success: true, message: 'Consent updated successfully' });

      case 'request-deletion':
        const requestId = await gdprComplianceService.requestDataDeletion(
          session.userId,
          session.email || session.userId,
          data.reason
        );
        return NextResponse.json({
          success: true,
          requestId,
          message: 'Data deletion request submitted. Processing will begin within 30 days.'
        });

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
        const exportData = await gdprComplianceService.exportUserData(session.userId);
        
        // Convert to JSON string for download
        const jsonData = JSON.stringify(exportData, null, 2);
        const buffer = Buffer.from(jsonData, 'utf-8');
        
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="user_data_export_${session.userId}.json"`,
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
          userId: session.userId
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
    console.error('GDPR compliance error:', error);
    return NextResponse.json(
      { 
        error: 'GDPR operation failed',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
