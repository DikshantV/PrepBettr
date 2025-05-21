import ProfileForm from '../../../components/ProfileForm';
import { getCurrentUser } from '@/lib/actions/auth.action';
import { redirect } from 'next/navigation';
import Link from "next/link";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/sign-in');

  return (
    <main className="max-w-4xl mx-auto py-10 px-4 relative min-h-screen">
      <Link href="/" className="fixed left-8 top-8 z-50 text-primary-100 font-semibold text-2xl hover:underline px-0 py-0 rounded transition-colors bg-transparent" aria-label="Back to Home">
        ←
      </Link>
      <h1 className="text-3xl font-bold mb-8 text-center">My Profile</h1>
      <ProfileForm user={user} />
    </main>
  );
}

