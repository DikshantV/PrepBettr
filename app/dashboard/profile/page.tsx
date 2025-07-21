export const dynamic = 'force-dynamic';

import ProfileForm from '@/components/ProfileForm';
import { getCurrentUser } from '@/lib/actions/auth.action';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  return (
    <main className="max-w-4xl mx-auto py-10 px-4 relative min-h-screen bg-gray-950">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white">My Profile</h1>
        <p className="text-gray-300 mt-2">Manage your account settings and preferences</p>
      </div>
      <ProfileForm user={user} />
    </main>
  );
}
