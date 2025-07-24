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
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const { user } = useAuth();
  const [activeTeam, setActiveTeam] = React.useState(data.teams[0]);

  const handleLogout = async () => {
    try {
      await fetch("/api/profile/logout", { method: "POST" });
      router.push("/sign-in");
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

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
        "--sidebar-width-icon": "5.5rem", // Further increased collapsed width for better clarity
      } as React.CSSProperties}
    >
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="group-data-[collapsible=icon]:h-16 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center">
          <div className="flex items-center justify-center gap-3 px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg text-sidebar-primary-foreground group-data-[collapsible=icon]:size-12">
              <Image
                src="/logo.svg"
                alt="PrepBettr Logo"
                width={20}
                height={20}
                className="size-5 group-data-[collapsible=icon]:size-8"
              />
            </div>
            <span className="text-lg font-bold text-sidebar-foreground group-data-[collapsible=icon]:group-data-[state=collapsed]:hidden">
              PrepBettr
            </span>
          </div>
        </SidebarHeader>
        
        <SidebarContent className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:h-full">
          {/* Search - hidden when collapsed */}
          <SidebarGroup className="py-0 group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className="group relative">
              <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <SidebarInput
                placeholder="Search..."
                className="pl-8 focus-visible:ring-0"
              />
            </SidebarGroupLabel>
          </SidebarGroup>

          {/* Navigation */}
          <div className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-6 group-data-[collapsible=icon]:flex-1">
          {navMainWithAdmin.map((item) => (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive}
              className="group/collapsible"
            >
              <SidebarGroup className="mt-8"> {/* Increased spacing between icons and section titles */}
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="group/label text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center">
                    <item.icon className="size-5 mr-3 group-data-[collapsible=icon]:mr-0" /> {/* Added horizontal gap for expanded state */}
                    <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    <ChevronUp className="ml-auto size-4 transition-transform duration-200 group-data-[state=closed]/collapsible:rotate-180 group-data-[collapsible=icon]:hidden" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarMenu>
                    {item.items?.map((subItem) => {
                      const isActive = pathname === subItem.url || 
                        (subItem.url !== '/dashboard' && pathname?.startsWith(subItem.url));
                      
                      return (
                        <SidebarMenuItem key={subItem.title}>
                          <SidebarMenuButton asChild isActive={isActive} className="group-data-[collapsible=icon]:!h-12 group-data-[collapsible=icon]:!p-0">
                            <Link href={subItem.url} className="flex items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:w-full">
                              <subItem.icon className="size-5 mr-3 group-data-[collapsible=icon]:mr-0 group-data-[collapsible=icon]:mx-0" />
                              <span className="group-data-[collapsible=icon]:hidden">{subItem.title}</span>
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
          </div>

          {/* Secondary Navigation */}
          <SidebarGroup className="mt-auto group-data-[collapsible=icon]:mt-0">
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Support</SidebarGroupLabel>
            <SidebarMenu className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-4">
              {data.navSecondary.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="sm" className="group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!p-0">
                    <a href={item.url} className="flex items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-full">
                      <item.icon className="size-5 mr-3 group-data-[collapsible=icon]:mr-0 group-data-[collapsible=icon]:mx-0" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!items-center group-data-[collapsible=icon]:!h-12 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:!w-full group-data-[collapsible=icon]:!flex"
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
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-semibold">
                        {user?.name || data.user.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email || data.user.email}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
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
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
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
        
        <header className="flex h-16 shrink-0 items-center gap-2 px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-16">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="group-data-[collapsible=icon]:ml-0" />
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

