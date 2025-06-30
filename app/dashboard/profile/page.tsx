import ProfileForm from '@/components/ProfileForm';
import { getCurrentUser } from '@/lib/actions/auth.action';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  return (
    <main className="max-w-4xl mx-auto py-10 px-4 relative min-h-screen">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
      </div>
      <ProfileForm user={user} />
    </main>
  );
}
