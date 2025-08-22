import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated, getCurrentUser } from "@/lib/actions/auth.action";
import { getUserInterviews, getPublicInterviews } from "@/lib/actions/dashboard.action";
import AuthenticatedLayout from "@/components/authenticated-layout";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthSync } from "@/components/AuthSync";
import DashboardClient from "./DashboardClient";

// Force dynamic rendering since we use cookies
// export const dynamic = 'force-dynamic'; // Commented out for static export
// export const revalidate = 0; // Commented out for static export

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function Layout({ children }: DashboardLayoutProps) {
  // Check authentication
  if (!(await isAuthenticated())) {
    redirect('/sign-in');
  }

  // Get the current user to pass to the context
  const user = await getCurrentUser();
  
  return (
    <AuthProvider initialUser={user}>
      <AuthSync />
      <AuthenticatedLayout>
        {children}
      </AuthenticatedLayout>
    </AuthProvider>
  );
}
