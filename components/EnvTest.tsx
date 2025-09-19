"use client";

export default function EnvTest() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  console.log('🔍 Environment Variables Test:');
  console.log('NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.substring(0, 10) + '...' || 'UNDEFINED');
  console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'UNDEFINED');
  console.log('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'UNDEFINED');
  console.log('NODE_ENV:', process.env.NODE_ENV);

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'black', 
      color: 'white', 
      padding: '10px', 
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div><strong>🔍 ENV TEST</strong></div>
      <div>API Key: {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Loaded' : '❌ Missing'}</div>
      <div>Project ID: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '❌ Missing'}</div>
      <div>Auth Domain: {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✅ Loaded' : '❌ Missing'}</div>
    </div>
  );
}