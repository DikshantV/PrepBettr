import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/actions/auth.action";
import { DashboardLayout } from "@/components/dashboard-layout";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function Layout({ children }: DashboardLayoutProps) {
  if (!(await isAuthenticated())) {
    redirect('/sign-in');
  }
  
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  );
}

