"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
  Home,
  MessageSquare,
  User,
  Settings,
  FileText,
  Shield,
  Users,
  BarChart3,
  CreditCard,
  Search,
  ChevronUp,
  User2,
  ChevronsUpDown,
  LogOut,
  Sparkles
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  SidebarInput
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { UsageIndicator } from "@/components/UsageIndicator";
import { useAuth } from "@/contexts/AuthContext";

// This is sample data.
const data = {
  user: {
    name: "PrepBettr User",
    email: "user@prepbettr.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "PrepBettr",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Core Features",
      url: "#",
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: Home,
        },
        {
          title: "Interviews",
          url: "/dashboard/interview",
          icon: MessageSquare,
        },
        {
          title: "Resume Tailor",
          url: "/dashboard/resume-tailor",
          icon: FileText,
        },
        {
          title: "Auto Apply",
          url: "/dashboard/auto-apply",
          icon: Bot,
        },
      ],
    },
    {
      title: "Account",
      url: "#",
      icon: User2,
      items: [
        {
          title: "Profile",
          url: "/dashboard/profile",
          icon: User,
        },
        {
          title: "Settings",
          url: "/dashboard/settings",
          icon: Settings,
        },
        {
          title: "Billing",
          url: "/account/billing",
          icon: CreditCard,
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "#",
      icon: BookOpen,
    },
    {
      title: "Feedback",
      url: "#",
      icon: PieChart,
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
    },
  ],
};

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export const AuthenticatedLayout = ({ children }: AuthenticatedLayoutProps) => {
  const pathname = usePathname();
  const { user } = useAuth();
  const [activeTeam, setActiveTeam] = React.useState(data.teams[0]);

  // Check if current route is admin or account
  const isAdminRoute = pathname?.startsWith('/admin') ?? false;
  
  // Add admin items to navigation if on admin route
  const navMainWithAdmin = isAdminRoute ? [
    ...data.navMain,
    {
      title: "Administration",
      url: "#",
      icon: Shield,
      items: [
        {
          title: "Admin Dashboard",
          url: "/admin",
          icon: Shield,
        },
        {
          title: "Subscriptions",
          url: "/admin/subscriptions",
          icon: Users,
        },
      ],
    }
  ] : data.navMain;

  return (
    <SidebarProvider 
      style={{
        "--sidebar-width": "20rem", // 320px - larger than default 16rem
        "--sidebar-width-mobile": "22rem", // 352px for mobile
      } as React.CSSProperties}
    >
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center justify-center gap-3 px-2 py-2 group-data-[collapsible=icon]:justify-center">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg text-sidebar-primary-foreground">
              <Image
                src="/logo.svg"
                alt="PrepBettr Logo"
                width={20}
                height={20}
                className="size-5"
              />
            </div>
            <span className="text-lg font-bold text-sidebar-foreground group-data-[collapsible=icon]:group-data-[state=collapsed]:hidden">
              PrepBettr
            </span>
          </div>
        </SidebarHeader>
        
        <SidebarContent>
          {/* Search */}
          <SidebarGroup className="py-0">
            <SidebarGroupLabel className="group relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <SidebarInput
                placeholder="Search..."
                className="pl-8 focus-visible:ring-0"
              />
            </SidebarGroupLabel>
          </SidebarGroup>

          {/* Navigation */}
          {navMainWithAdmin.map((item) => (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive}
              className="group/collapsible"
            >
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="group/label text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                    <item.icon className="size-5" />
                    <span>{item.title}</span>
                    <ChevronUp className="ml-auto size-4 transition-transform duration-200 group-data-[state=closed]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarMenu>
                    {item.items?.map((subItem) => {
                      const isActive = pathname === subItem.url || 
                        (subItem.url !== '/dashboard' && pathname?.startsWith(subItem.url));
                      
                      return (
                        <SidebarMenuItem key={subItem.title}>
                          <SidebarMenuButton asChild isActive={isActive}>
                            <Link href={subItem.url}>
                              <subItem.icon className="size-5 mx-1" />
                              <span>{subItem.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          ))}

          {/* Secondary Navigation */}
          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel>Support</SidebarGroupLabel>
            <SidebarMenu>
              {data.navSecondary.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="sm">
                    <a href={item.url}>
                      <item.icon className="size-5 mx-1" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        
        <SidebarFooter>
          <div className="p-1">
            <UsageIndicator variant="compact" />
          </div>
          
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage
                        src={user?.image || data.user.avatar}
                        alt={user?.name || data.user.name}
                      />
                      <AvatarFallback className="rounded-lg">
                        {(user?.name || user?.email || data.user.name).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.name || data.user.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email || data.user.email}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side="bottom"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage
                          src={user?.image || data.user.avatar}
                          alt={user?.name || data.user.name}
                        />
                        <AvatarFallback className="rounded-lg">
                          {(user?.name || user?.email || data.user.name).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {user?.name || data.user.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user?.email || data.user.email}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/profile">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/account/billing">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Billing
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      
      <SidebarInset>
        {/* Background Pattern */}
        <div className="absolute inset-0 -z-10" style={{
          backgroundImage: "url('/pattern.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.1
        }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_600px_at_50%_300px,rgba(201,235,255,0.1),transparent_70%)] dark:bg-[radial-gradient(circle_600px_at_50%_300px,rgba(26,26,46,0.3),transparent_70%)]"></div>
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/20 to-transparent dark:from-black/20"></div>
        </div>
        
        <header className="flex h-16 shrink-0 items-center gap-2 px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="group-data-[collapsible=icon]:ml-0" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            {/* Dynamic Breadcrumb based on current path */}
            <Breadcrumb>
              <BreadcrumbList>
                {(pathname || '').split('/').filter(Boolean).map((segment, index, array) => {
                  const href = '/' + array.slice(0, index + 1).join('/');
                  const isLast = index === array.length - 1;
                  const title = segment.charAt(0).toUpperCase() + segment.slice(1);
                  
                  return (
                    <React.Fragment key={segment}>
                      <BreadcrumbItem className="hidden md:block">
                        {isLast ? (
                          <BreadcrumbPage>{title}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={href}>{title}</BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
                    </React.Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AuthenticatedLayout;

