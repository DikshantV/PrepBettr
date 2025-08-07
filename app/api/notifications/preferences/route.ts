// app/api/notifications/preferences/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    
    // Default notification preferences
    const defaultPreferences = {
      jobDiscovered: true,
      applicationSubmitted: true,
      followUpReminder: true,
      dailySummary: true,
      weeklyReport: false,
      emailFrequency: 'immediate'
    };

    const preferences = {
      ...defaultPreferences,
      ...userData?.notificationPreferences
    };

    return NextResponse.json({
      success: true,
      preferences,
      emailVerified: userData?.emailVerified || false
    });

  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to get notification preferences' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, preferences } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!preferences) {
      return NextResponse.json(
        { error: 'Preferences are required' },
        { status: 400 }
      );
    }

    // Validate preferences structure
    const validKeys = ['jobDiscovered', 'applicationSubmitted', 'followUpReminder', 'dailySummary', 'weeklyReport', 'emailFrequency'];
    const validFrequencies = ['immediate', 'hourly', 'daily'];

    for (const key in preferences) {
      if (!validKeys.includes(key)) {
        return NextResponse.json(
          { error: `Invalid preference key: ${key}` },
          { status: 400 }
        );
      }
    }

    if (preferences.emailFrequency && !validFrequencies.includes(preferences.emailFrequency)) {
      return NextResponse.json(
        { error: 'Invalid email frequency. Must be one of: immediate, hourly, daily' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    
    // Update user document with new preferences
    await db.collection('users').doc(userId).update({
      notificationPreferences: preferences,
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log(`Updated notification preferences for user ${userId}:`, preferences);

    return NextResponse.json({
      success: true,
      message: 'Notification preferences updated successfully',
      preferences
    });

  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}
