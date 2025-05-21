import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db, auth } from '@/firebase/admin';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, password, profilePic } = await req.json();
  const uid = session.user.id;

  try {
    // Update name and profilePic in Firestore
    await db.collection('users').doc(uid).update({
      name,
      image: profilePic,
    });
    // Update password if provided
    if (password) {
      await auth.updateUser(uid, { password });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

