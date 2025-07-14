// lib/dodo-webhook.ts
import { NextRequest } from 'next/server';
import crypto from 'crypto';

export function verifyDodoWebhook(
    request: NextRequest,
    body: string,
    webhookSecret: string
): boolean {
    const signature = request.headers.get('x-dodo-signature');
    if (!signature) return false;

    const hmac = crypto.createHmac('sha256', webhookSecret);
    const digest = hmac.update(body).digest('hex');

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(digest)
        );
    } catch {
        return false;
    }
}