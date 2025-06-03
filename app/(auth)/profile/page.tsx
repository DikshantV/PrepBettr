import ProfileForm from '../../../components/ProfileForm';
import { getCurrentUser } from '@/lib/actions/auth.action';
import { redirect } from 'next/navigation';
import Link from "next/link";
import LogoutButton from '../../../components/LogoutButton';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  return (
    <>
      <div className="fixed left-0 top-0 p-4 z-10">
        <Link href="/" className="text-primary-100 font-semibold text-2xl hover:bg-primary-100/10 dark:hover:bg-white/10 p-2 rounded-full transition-colors inline-flex items-center justify-center w-10 h-10" aria-label="Back to Home">
          ←
        </Link>
      </div>
      <div className="fixed right-0 top-0 p-4 z-10">
        <LogoutButton />
      </div>
      <main className="max-w-4xl mx-auto py-10 px-4 relative min-h-screen">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
        </div>
        <ProfileForm user={user} />
      </main>
    </>
  );
}

