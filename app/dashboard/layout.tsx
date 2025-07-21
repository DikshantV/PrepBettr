import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated, getCurrentUser } from "@/lib/actions/auth.action";
import { DashboardLayout } from "@/components/dashboard-layout";
import { AuthProvider } from "@/contexts/AuthContext";

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
    <AuthProvider user={user}>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </AuthProvider>
  );
}
