import { redirect } from 'next/navigation';

export default function MarketingRedirect() {
  // Redirect to root since marketing page is now at /
  redirect('/');
}
