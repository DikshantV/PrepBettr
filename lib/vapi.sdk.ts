import Vapi from '@vapi-ai/web'

const webToken = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;

if (!webToken) {
    console.error('❌ NEXT_PUBLIC_VAPI_WEB_TOKEN is not set in environment variables');
    throw new Error('NEXT_PUBLIC_VAPI_WEB_TOKEN is required');
}

console.log('🔑 VAPI Web Token configured:', webToken ? 'YES' : 'NO');
console.log('🔑 VAPI Web Token length:', webToken?.length || 0);

export const vapi = new Vapi(webToken);
