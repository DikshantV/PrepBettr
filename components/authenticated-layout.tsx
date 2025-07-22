"use client";

import { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarProvider, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter,
  SidebarGroup
} from "@/components/ui/sidebar";
import { Home, MessageSquare, User, Settings, FileText, Bot, Shield, Users, BarChart3, CreditCard } from "lucide-react";
import { UsageIndicator } from "@/components/UsageIndicator";

const navItems = [
  {
    title: "Dashboard",
    icon: <Home className="h-4 w-4" />,
    href: "/dashboard",
  },
  {
    title: "Interviews",
    icon: <MessageSquare className="h-4 w-4" />,
    href: "/dashboard/interview",
  },
  {
    title: "Resume Tailor",
    icon: <FileText className="h-4 w-4" />,
    href: "/dashboard/resume-tailor",
  },
  {
    title: "Auto Apply",
    icon: <Bot className="h-4 w-4" />,
    href: "/dashboard/auto-apply",
  },
  {
    title: "Profile",
    icon: <User className="h-4 w-4" />,
    href: "/dashboard/profile",
  },
  {
    title: "Settings",
    icon: <Settings className="h-4 w-4" />,
    href: "/dashboard/settings",
  },
];

const adminNavItems = [
  {
    title: "Admin Dashboard",
    icon: <Shield className="h-4 w-4" />,
    href: "/admin",
  },
  {
    title: "Subscriptions",
    icon: <Users className="h-4 w-4" />,
    href: "/admin/subscriptions",
  },
];

const accountNavItems = [
  {
    title: "Billing",
    icon: <CreditCard className="h-4 w-4" />,
    href: "/account/billing",
  },
];

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export const AuthenticatedLayout = ({ children }: AuthenticatedLayoutProps) => {
  const pathname = usePathname();

  // Determine which navigation items to show based on the current route
  const isAdminRoute = pathname.startsWith('/admin');
  const isAccountRoute = pathname.startsWith('/account');
  
  const currentNavItems = isAdminRoute 
    ? [...navItems, ...adminNavItems]
    : isAccountRoute
    ? [...navItems, ...accountNavItems] 
    : navItems;

  return (
    <SidebarProvider className="font-mona-sans">
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2">
            <Image
              src="/logo.svg"
              alt="PrepBettr Logo"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            <span className="text-lg font-bold">PrepBettr</span>
          </div>
        </SidebarHeader>
        
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {currentNavItems.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      tooltip={item.title}
                      isActive={isActive}
                    >
                      <Link href={item.href}>
                        {item.icon}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        
        <SidebarFooter>
          <UsageIndicator variant="compact" />
        </SidebarFooter>
      </Sidebar>
      
      <SidebarInset className="relative pattern">
        {/* Background Gradient Effects - overlays on top of the pattern */}
        <div className="absolute inset-0 -z-10 h-full w-full">
          <div className="absolute inset-0 bg-[radial-gradient(circle_600px_at_50%_300px,rgba(201,235,255,0.1),transparent_70%)] dark:bg-[radial-gradient(circle_600px_at_50%_300px,rgba(26,26,46,0.3),transparent_70%)]"></div>
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/20 to-transparent dark:from-black/20"></div>
        </div>
        
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
        </header>
        
        {/* Main Content */}
        <main className="flex-1 relative z-10 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AuthenticatedLayout;

