"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/actions/auth.action";
import { Sidebar, SidebarBody, SidebarLink, DesktopSidebar, MobileSidebar, useSidebar } from "@/components/ui/sidebar";
import { Home, MessageSquare, User, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

// Define navigation links
const navLinks = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <Home className="w-5 h-5" />,
  },
  {
    label: "Interviews",
    href: "/dashboard/interview",
    icon: <MessageSquare className="w-5 h-5" />,
  },
  {
    label: "Profile",
    href: "/dashboard/profile",
    icon: <User className="w-5 h-5" />,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: <Settings className="w-5 h-5" />,
  },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayoutWrapper = ({ children }: DashboardLayoutProps) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const { setOpen } = useSidebar();
  const pathname = usePathname();

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
          router.push("/sign-in");
        } else {
          setIsAuth(true);
        }
      } catch (error) {
        console.error("Authentication error:", error);
        router.push("/sign-in");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Close mobile sidebar when route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuth) {
    return null; // Will redirect in useEffect
  }

  const Logo = () => {
    const { open } = useSidebar();
    
    return (
      <div className={`flex items-center h-12 ${open ? 'pl-4' : 'w-[68px] justify-center'}`}>
        <div className="flex items-center">
          <img 
            src="/logo.svg" 
            alt="Logo" 
            className="h-8 w-8"
          />
          {open && (
            <span className="ml-3 text-lg font-semibold whitespace-nowrap">
              PrepBettr
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <SidebarBody className="h-full">
        <div className="flex flex-col h-full bg-neutral-100 dark:bg-neutral-800">
          {/* Desktop Sidebar */}
          <DesktopSidebar className="!p-0">
            <div className="space-y-6 py-4">
              <Logo />
              <div className="space-y-1 px-2">
                {navLinks.map((link) => (
                  <SidebarLink key={link.href} link={link} />
                ))}
              </div>
            </div>
            <div className="px-4 py-2 mt-auto">
              <Button 
                variant="ghost" 
                className="w-full justify-start"
                onClick={() => {
                  // Handle sign out
                  router.push("/sign-in");
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </Button>
            </div>
          </DesktopSidebar>

          {/* Mobile Sidebar */}
          <MobileSidebar>
            <div className="space-y-6 py-4">
              <Logo />
              <div className="space-y-1 px-2">
                {navLinks.map((link) => (
                  <SidebarLink key={link.href} link={link} />
                ))}
              </div>
            </div>
            <div className="px-4 py-2 mt-auto">
              <Button 
                variant="ghost" 
                className="w-full justify-start"
                onClick={() => {
                  // Handle sign out
                  router.push("/sign-in");
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </Button>
            </div>
          </MobileSidebar>
        </div>
      </SidebarBody>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <Sidebar>
      <DashboardLayoutWrapper>{children}</DashboardLayoutWrapper>
    </Sidebar>
  );
};

export default DashboardLayout;
