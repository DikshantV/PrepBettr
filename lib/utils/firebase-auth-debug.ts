"use client";

import { auth } from '@/firebase/client';
import { User } from 'firebase/auth';

export function debugFirebaseAuth() {
  const currentUser = auth.currentUser;
  
  console.log('=== Firebase Auth Debug ===');
  console.log('Current User:', currentUser);
  console.log('User ID:', currentUser?.uid);
  console.log('Email:', currentUser?.email);
  console.log('Email Verified:', currentUser?.emailVerified);
  console.log('Auth Ready:', !!currentUser);
  
  if (currentUser) {
    // Get the ID token to check claims
    currentUser.getIdToken(false).then(token => {
      console.log('ID Token (first 50 chars):', token.substring(0, 50) + '...');
      
      // Decode and show token claims
      currentUser.getIdTokenResult().then(result => {
        console.log('Token Claims:', result.claims);
        console.log('Token Expiration:', new Date(result.expirationTime));
        console.log('Token Issued At:', new Date(result.issuedAtTime));
      }).catch(err => {
        console.error('Error getting token result:', err);
      });
    }).catch(err => {
      console.error('Error getting ID token:', err);
    });
  } else {
    console.log('No Firebase user authenticated');
  }
  console.log('=== End Debug ===');
}

export function waitForFirebaseAuth(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
}
