import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/actions/auth.action';

export default async function Home() {
  // This page will never render, it only redirects
  const isAuth = await isAuthenticated().catch(() => false);
  
  if (isAuth) {
    // Redirect to the dashboard page
    redirect('/dashboard');
  } else {
    redirect('/marketing');
  }
}
