// app/api/subscription/migrate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { subscriptionService } from '@/lib/services/subscription-service';

export async function POST(req: NextRequest) {
  try {
    const db = getAdminFirestore();
    console.log('Starting migration...');

    const usersSnapshot = await db.collection('users').get();

    const migrationPromises = usersSnapshot.docs.map(async (userDoc) => {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const email = userData.email || 'unknown@example.com';
      const name = userData.name || 'User';

      await subscriptionService.initializeUserSubscription(userId, email, name);
    });

    await Promise.all(migrationPromises);

    console.log('Migration completed successfully.');
    return NextResponse.json({ success: true, message: 'Migration completed.' });
  } catch (error: unknown) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { success: false, error: 'Migration failed.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

