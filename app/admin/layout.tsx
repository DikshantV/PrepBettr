import { ReactNode } from 'react';
import { redirect } from "next/navigation";
import { isAuthenticated, getCurrentUser } from "@/lib/actions/auth.action";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthenticatedLayout from "@/components/authenticated-layout";

// Force dynamic rendering since we use cookies
// export const dynamic = 'force-dynamic'; // Commented out for static export
// export const revalidate = 0; // Commented out for static export

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // Check authentication
  if (!(await isAuthenticated())) {
    redirect('/sign-in');
  }

  // Get the current user to pass to the context
  const user = await getCurrentUser();
  
  return (
    <AuthProvider initialUser={user}>
      <AuthenticatedLayout>
        {children}
      </AuthenticatedLayout>
    </AuthProvider>
  );
}
