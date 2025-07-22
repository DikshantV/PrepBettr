import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/actions/auth.action";
import AuthenticatedLayout from "@/components/authenticated-layout";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function Layout({ children }: DashboardLayoutProps) {
  if (!(await isAuthenticated())) {
    redirect('/sign-in');
  }
  
  return (
    <AuthenticatedLayout>
      {children}
    </AuthenticatedLayout>
  );
}
