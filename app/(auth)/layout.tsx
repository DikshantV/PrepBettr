import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/actions/auth.action";

const AuthLayout = async ({ children }: { children: ReactNode }) => {
    // Only redirect on sign-in and sign-up pages
    const isUserAuthenticated = await isAuthenticated();
    const pathname = typeof window === 'undefined' ? '' : window.location.pathname;
    if (isUserAuthenticated && (pathname === '/auth/sign-in' || pathname === '/auth/sign-up')) {
        redirect("/");
    }
    return <div className="auth-layout">{children}</div>;
};

export default AuthLayout;

