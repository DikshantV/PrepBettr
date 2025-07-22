import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated, getCurrentUser } from "@/lib/actions/auth.action";
import { DashboardLayout } from "@/components/dashboard-layout";
import { AuthProvider } from "@/contexts/AuthContext";

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    <AuthProvider>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </AuthProvider>
  );
}
