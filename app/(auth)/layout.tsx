import { ReactNode } from 'react'
import {isAuthenticated} from "@/lib/actions/auth.action";
import {redirect} from "next/navigation";
import { headers } from 'next/headers';

const AuthLayout = async ({ children }: { children: ReactNode }) => {
    // Only run auth check on the server
    if (typeof window === 'undefined') {
        try {
            const isUserAuthenticated = await isAuthenticated().catch(() => false);
            const pathname = (await headers()).get('x-invoke-path') || '';
            
            // Only redirect if we're sure the user is authenticated
            if (isUserAuthenticated && (pathname.endsWith('/sign-in') || pathname.endsWith('/sign-up'))) {
                // Redirect to the dashboard page
                redirect('/dashboard');
            }
        } catch (error) {
            // Silently handle any errors during auth check
            console.error('Error in AuthLayout:', error);
        }
    }
    
    // Always render children
    return (
        <div className="auth-layout">
            {children}
        </div>
    );
};
export default AuthLayout;
