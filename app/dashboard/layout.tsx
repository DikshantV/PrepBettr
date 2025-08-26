import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated, getCurrentUser } from "@/lib/actions/auth.action";
import { getUserInterviews, getPublicInterviews } from "@/lib/actions/dashboard.action";
import AuthenticatedLayout from "@/components/authenticated-layout";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthSync } from "@/components/AuthSync";
import DashboardClient from "./DashboardClient";

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'; // Required for cookie access
export const revalidate = 0; // Disable caching for auth

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function Layout({ children }: DashboardLayoutProps) {
  console.log('🏠 Dashboard layout: Starting authentication check...');
  
  // Check authentication
  const isAuth = await isAuthenticated();
  console.log('🏠 Dashboard layout: Authentication result:', isAuth);
  
  if (!isAuth) {
    console.log('🏠 Dashboard layout: User not authenticated, redirecting to sign-in');
    redirect('/sign-in');
  }

  // Get the current user to pass to the context
  console.log('🏠 Dashboard layout: Getting current user...');
  const user = await getCurrentUser();
  console.log('🏠 Dashboard layout: Current user:', user ? { uid: user.uid, email: user.email } : null);
  
  return (
    <AuthProvider initialUser={user}>
      <AuthSync />
      <AuthenticatedLayout>
        {children}
      </AuthenticatedLayout>
    </AuthProvider>
  );
}
