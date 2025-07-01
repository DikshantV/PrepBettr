import { redirect } from 'next/navigation';

export default function Home() {
  // Always redirect to the marketing page
  redirect('/marketing');
}
