import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/actions/auth.action";
import { Sidebar, SidebarBody, SidebarLink, DesktopSidebar, MobileSidebar } from "@/components/ui/sidebar";
import { Home, MessageSquare, User, Settings, LogOut, FileText, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from 'next/image';

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
    label: "Resume Tailor",
    href: "/dashboard/resume-tailor",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: "Profile",
    href: "/dashboard/profile",
    icon: <User className="w-5 h-5" />,
  },
  {
    label: "Auto Apply",
    href: "/dashboard/auto-apply",
    icon: <Bot className="w-5 h-5" />,
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

const Logo = () => {
  return (
    <div className="flex items-center justify-center h-12 w-full">
      <div className="flex items-center">
        <Image 
          src="/logo.svg" 
          alt="Logo" 
          width={32}
          height={32}
          className="h-8 w-8"
        />
        <span className="ml-3 text-lg font-semibold whitespace-nowrap">
          PrepBettr
        </span>
      </div>
    </div>
  );
};

export default async function Layout({ children }: DashboardLayoutProps) {
  if (!(await isAuthenticated())) {
    redirect('/sign-in');
  }
  
  return (
    <Sidebar>
      <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <SidebarBody className="h-full">
        <div className="flex flex-col h-full">
          {/* Desktop Sidebar */}
          <DesktopSidebar>
            <div className="flex flex-col h-full">
              <div className="space-y-4 pt-4 pb-2">
                <Logo />
                <div className="space-y-1 px-2">
                  {navLinks.map((link) => (
                    <SidebarLink key={link.href} link={link} />
                  ))}
                </div>
              </div>
              <div className="w-full mt-auto">
                <div className="w-full py-2">
                  <SidebarLink
                    link={{
                      href: "/sign-in",
                      icon: <LogOut className="h-5 w-5" />,
                      label: "Sign out"
                    }}
                  />
                </div>
              </div>
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
              <form action="/sign-in">
                <Button 
                  type="submit"
                  variant="ghost" 
                  className="w-full justify-start"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </Button>
              </form>
            </div>
          </MobileSidebar>
        </div>
      </SidebarBody>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6 relative z-10 bg-background/80">
          {children}
        </main>
        </div>
      </div>
    </Sidebar>
  );
}

