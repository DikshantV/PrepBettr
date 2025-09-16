// app/api/webhooks/sendgrid/route.ts
// SendGrid webhook endpoint for tracking email events

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface SendGridEvent {
  email: string;
  timestamp: number;
  event: 'processed' | 'delivered' | 'open' | 'click' | 'bounce' | 'dropped' | 'deferred' | 'unsubscribe' | 'group_unsubscribe' | 'group_resubscribe' | 'spam_report';
  sg_event_id: string;
  sg_message_id: string;
  useragent?: string;
  ip?: string;
  url?: string;
  reason?: string;
  status?: string;
  response?: string;
  attempt?: string;
  category?: string[];
  asm_group_id?: number;
}

/**
 * Verify SendGrid webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string, timestamp: string): boolean {
  const webhookSecret = process.env.SENDGRID_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.warn('SENDGRID_WEBHOOK_SECRET not configured - skipping signature verification');
    return true; // Allow for development
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(timestamp + payload)
      .digest('base64');
    
    return signature === expectedSignature;
  } catch (error) {
    console.error('Error verifying SendGrid webhook signature:', error);
    return false;
  }
}

/**
 * Log email event to monitoring system
 */
async function logEmailEvent(event: SendGridEvent): Promise<void> {
  try {
    // Log to console for development
    console.log(`📧 SendGrid Event: ${event.event} for ${event.email}`, {
      messageId: event.sg_message_id,
      timestamp: new Date(event.timestamp * 1000).toISOString(),
      event: event.event,
      email: event.email,
      reason: event.reason,
      status: event.status
    });

    // TODO: Store events in database for production monitoring
    // Example: Store in Cosmos DB or Firebase for analytics
    /*
    await storeEmailEvent({
      messageId: event.sg_message_id,
      eventId: event.sg_event_id,
      email: event.email,
      event: event.event,
      timestamp: new Date(event.timestamp * 1000),
      metadata: {
        reason: event.reason,
        status: event.status,
        response: event.response,
        userAgent: event.useragent,
        ip: event.ip,
        url: event.url,
        categories: event.category
      }
    });
    */

  } catch (error) {
    console.error('Error logging email event:', error);
  }
}

/**
 * Handle different types of SendGrid events
 */
async function handleEmailEvent(event: SendGridEvent): Promise<void> {
  switch (event.event) {
    case 'delivered':
      // Email successfully delivered
      console.log(`✅ Email delivered to ${event.email}`);
      break;
      
    case 'bounce':
      // Email bounced - handle bounce processing
      console.warn(`⚠️ Email bounced for ${event.email}: ${event.reason}`);
      // TODO: Update user email status, implement bounce handling
      break;
      
    case 'dropped':
      // Email was dropped before sending
      console.error(`❌ Email dropped for ${event.email}: ${event.reason}`);
      break;
      
    case 'spam_report':
      // User marked email as spam
      console.warn(`🚫 Spam report from ${event.email}`);
      // TODO: Automatically unsubscribe user or mark as spam
      break;
      
    case 'unsubscribe':
      // User unsubscribed
      console.log(`📋 Unsubscribe request from ${event.email}`);
      // TODO: Update user preferences in database
      break;
      
    case 'open':
      // Email was opened
      console.log(`👁️ Email opened by ${event.email}`);
      break;
      
    case 'click':
      // Link in email was clicked
      console.log(`🖱️ Email link clicked by ${event.email}: ${event.url}`);
      break;
      
    default:
      console.log(`📨 Email event '${event.event}' for ${event.email}`);
  }
  
  // Log all events for monitoring
  await logEmailEvent(event);
}

/**
 * POST /api/webhooks/sendgrid
 * Handle SendGrid webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('X-Twilio-Email-Event-Webhook-Signature') || '';
    const timestamp = request.headers.get('X-Twilio-Email-Event-Webhook-Timestamp') || '';

    // Verify webhook signature in production
    if (process.env.NODE_ENV === 'production') {
      if (!verifyWebhookSignature(body, signature, timestamp)) {
        console.error('Invalid SendGrid webhook signature');
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        );
      }
    }

    // Parse SendGrid events
    let events: SendGridEvent[];
    try {
      events = JSON.parse(body);
    } catch (error) {
      console.error('Failed to parse SendGrid webhook payload:', error);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Process each event
    for (const event of events) {
      await handleEmailEvent(event);
    }

    // Return success response
    return NextResponse.json(
      { 
        success: true, 
        processed: events.length,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error processing SendGrid webhook:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/sendgrid
 * Health check endpoint for webhook
 */
export async function GET() {
  return NextResponse.json({
    service: 'SendGrid Webhook Endpoint',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    webhookSecretConfigured: !!process.env.SENDGRID_WEBHOOK_SECRET
  });
}