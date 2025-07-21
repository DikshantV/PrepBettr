"use client";
import { ReactNode } from "react";
import { FloatingDock } from "@/components/ui/floating-dock";
import { Home, MessageSquare, User, Settings, FileText, Bot } from "lucide-react";

// Define navigation items for the floating dock
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

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation with Floating Dock */}
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto py-4">
          <FloatingDock
            items={navItems}
            desktopClassName="w-fit mx-auto my-3"
            mobileClassName="absolute right-4 top-4 my-2"
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none z-0"
          style={{ 
            backgroundImage: 'url(/pattern.png)',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
          }}
        />
        <div className="relative z-10 bg-background/80 p-4 md:p-6 min-h-[calc(100vh-5rem)]">
          {children}
        </div>
      </main>
    </div>
  );
};
