"use client";

import { useEffect, useState } from 'react';
import { auth } from '@/firebase/client';
import { useAuth } from '@/contexts/AuthContext';
import { User } from 'firebase/auth';

export function AuthDebug() {
  const { user, loading } = useAuth();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth?.currentUser || null);

  useEffect(() => {
    if (!auth) {
      console.log('Firebase auth not available for debug');
      return;
    }

    const unsubscribe = auth.onAuthStateChanged((fbUser: User | null) => {
      setFirebaseUser(fbUser);
    });

    return () => unsubscribe();
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
      <h3 className="font-bold">Auth Debug Info</h3>
      <div className="text-sm mt-2">
        <p><strong>Auth Context Loading:</strong> {loading ? 'Yes' : 'No'}</p>
        <p><strong>User from Context:</strong> {user ? `${user.name} (${user.id})` : 'None'}</p>
        <p><strong>Firebase User:</strong> {firebaseUser ? `${firebaseUser.email} (${firebaseUser.uid})` : 'None'}</p>
        <p><strong>Auth Match:</strong> {user && firebaseUser && user.id === firebaseUser.uid ? '✅ Match' : '❌ Mismatch'}</p>
      </div>
    </div>
  );
}
