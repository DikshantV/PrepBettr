import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
  cookieStore.delete('session_type');
  return NextResponse.json({ success: true });
}
