import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/actions/auth.action';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({}, { status: 401 });
  return NextResponse.json(user);
}
