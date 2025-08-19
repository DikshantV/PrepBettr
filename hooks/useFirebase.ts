import { useEffect, useState } from 'react';
import { ensureFirebaseInitialized } from '@/firebase/client';

export function useFirebase() {
  const [firebase, setFirebase] = useState<{
    app: any;
    auth: any;
    db: any;
    isInitialized: boolean;
    error?: string;
  }>({
    app: null,
    auth: null,
    db: null,
    isInitialized: false
  });

  useEffect(() => {
    let mounted = true;

    const initFirebase = async () => {
      try {
        const { app, auth, db } = await ensureFirebaseInitialized();
        
        if (mounted) {
          setFirebase({
            app,
            auth,
            db,
            isInitialized: true
          });
        }
      } catch (error) {
        console.error('Firebase initialization error:', error);
        if (mounted) {
          setFirebase(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Firebase initialization failed'
          }));
        }
      }
    };

    initFirebase();

    return () => {
      mounted = false;
    };
  }, []);

  return firebase;
}
