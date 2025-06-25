"use client";
import { cn } from "@/lib/utils";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconMenu2, IconX } from "@tabler/icons-react";

interface Links {
    label: string;
    href: string;
    icon: React.JSX.Element | React.ReactNode;
}

interface SidebarLinkProps {
    link: Links;
    className?: string;
    onClick?: () => void;
}

interface SidebarContextProps {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
    undefined
);

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
};

export const SidebarProvider = ({
                                    children,
                                    open: openProp,
                                    setOpen: setOpenProp,
                                    animate = true,
                                }: {
    children: React.ReactNode;
    open?: boolean;
    setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
    animate?: boolean;
}) => {
    const [openState, setOpenState] = useState(false);

    const open = openProp !== undefined ? openProp : openState;
    const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

    return (
        <SidebarContext.Provider value={{ open, setOpen, animate: animate }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const Sidebar = ({
                            children,
                            open,
                            setOpen,
                            animate,
                        }: {
    children: React.ReactNode;
    open?: boolean;
    setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
    animate?: boolean;
}) => {
    return (
        <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
            {children}
        </SidebarProvider>
    );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
    return (
        <>
            <DesktopSidebar {...props} />
            <MobileSidebar {...(props as React.ComponentProps<"div">)} />
        </>
    );
};

export const DesktopSidebar = ({
    className,
    children,
    ...props
}: React.ComponentProps<typeof motion.div>) => {
    const { open, setOpen, animate } = useSidebar();
    return (
        <motion.div
            className={cn(
                "h-full hidden md:flex flex-col bg-neutral-100 dark:bg-neutral-800 rounded-r-3xl overflow-hidden",
                className
            )}
            animate={{
                width: animate ? (open ? "300px" : "64px") : "300px",
            }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            {...props}
        >
            <motion.div 
                className={cn("flex-1", open ? 'px-4' : 'px-0')}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}
            >
                {children}
            </motion.div>
        </motion.div>
    );
};

export const MobileSidebar = ({
                                  className,
                                  children,
                                  ...props
                              }: React.ComponentProps<"div">) => {
    const { open, setOpen } = useSidebar();
    return (
        <>
            <div
                className={cn(
                    "h-10 px-4 py-4 flex flex-row md:hidden  items-center justify-between bg-neutral-100 dark:bg-neutral-800 w-full"
                )}
                {...props}
            >
                <div className="flex justify-end z-20 w-full">
                    <IconMenu2
                        className="text-neutral-800 dark:text-neutral-200"
                        onClick={() => setOpen(!open)}
                    />
                </div>
                <AnimatePresence>
                    {open && (
                        <motion.div
                            initial={{ x: "-100%", opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: "-100%", opacity: 0 }}
                            transition={{
                                duration: 0.3,
                                ease: "easeInOut",
                            }}
                            className={cn(
                                "fixed h-full w-full inset-0 bg-white dark:bg-neutral-900 p-10 z-[100] flex flex-col justify-between",
                                className
                            )}
                        >
                            <div
                                className="absolute right-10 top-10 z-50 text-neutral-800 dark:text-neutral-200"
                                onClick={() => setOpen(!open)}
                            >
                                <IconX />
                            </div>
                            {children}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
};

export const SidebarLink = ({
    link,
    className,
    onClick,
    ...props
}: SidebarLinkProps) => {
    const { open, animate } = useSidebar();
    return (
        <a
            href={link.href}
            className={cn(
                "flex items-center w-full py-2.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors",
                !open ? 'justify-center px-0' : 'px-4',
                className
            )}
            onClick={onClick}
            {...props}
        >
            <div className="flex items-center justify-center w-8 h-8">
                {React.cloneElement(link.icon as React.ReactElement<{ className?: string }>, {
                    className: 'h-5 w-5'
                })}
            </div>
            <motion.span
                animate={{
                    display: animate ? (open ? "inline-block" : "none") : "inline-block",
                    opacity: animate ? (open ? 1 : 0) : 1,
                    width: open ? 'auto' : 0,
                }}
                className="text-sm whitespace-nowrap overflow-hidden"
                style={{
                    marginLeft: open ? '0.75rem' : 0
                }}
            >
                {link.label}
            </motion.span>
        </a>
    );
};
