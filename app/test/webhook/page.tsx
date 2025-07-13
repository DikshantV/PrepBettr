// app/test/webhook/page.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface WebhookResponse {
    status: number;
    data?: {
        success?: boolean;
        message?: string;
        [key: string]: unknown;
    };
    error?: string;
    details?: string;
}

export default function WebhookTestPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<WebhookResponse | null>(null);

    const testWebhook = async () => {
        setLoading(true);
        try {
            // This is a test payload - adjust according to Dodo's webhook format
            const testPayload = {
                type: 'payment_intent.succeeded',
                data: {
                    object: {
                        id: 'test_pi_' + Math.random().toString(36).substring(2, 11),
                        amount: 1999, // $19.99
                        currency: 'usd',
                        status: 'succeeded',
                        metadata: {
                            userId: 'test_user_' + Math.random().toString(36).substring(2, 8),
                            plan: 'premium'
                        },
                        created: Math.floor(Date.now() / 1000)
                    }
                }
            };

            const response = await fetch('/api/webhooks/dodo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testPayload),
            });

            const data = await response.json();
            setResult({
                status: response.status,
                data: data
            });
        } catch (error) {
            console.error('Webhook test failed:', error);
            setResult({
                status: 500,
                error: 'Test failed',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-8 max-w-4xl">
            <h1 className="text-2xl font-bold mb-6">Dodo Webhook Test</h1>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Test Webhook</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                        Click the button below to send a test webhook to your endpoint.
                    </p>
                    <Button
                        onClick={testWebhook}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {loading ? 'Sending Test...' : 'Send Test Webhook'}
                    </Button>
                </div>

                {result && (
                    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                        <h3 className="font-medium mb-2">Test Result:</h3>
                        <pre className="text-sm bg-black/5 dark:bg-white/5 p-3 rounded overflow-auto max-h-80">
              {JSON.stringify(result, null, 2)}
            </pre>
                    </div>
                )}
            </div>

            <div className="mt-8 p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    Testing in Production
                </h2>
                <p className="text-yellow-700 dark:text-yellow-300">
                    For testing with real webhooks from Dodo, you&apos;ll need to:
                </p>
                <ol className="list-decimal list-inside mt-2 space-y-1 text-yellow-700 dark:text-yellow-300">
                    <li>Deploy your application</li>
                    <li>Set up the webhook URL in your Dodo dashboard</li>
                    <li>Make a real test payment</li>
                </ol>
            </div>
        </div>
    );
}