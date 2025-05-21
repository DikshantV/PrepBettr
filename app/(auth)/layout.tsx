import { ReactNode } from 'react'
import {isAuthenticated} from "@/lib/actions/auth.action";
import {redirect} from "next/navigation";
import { headers } from 'next/headers';

const AuthLayout = async ({ children }: { children: ReactNode }) => {
    const isUserAuthenticated = await isAuthenticated();
    const pathname = (await headers()).get('x-invoke-path') || '';
    if (
      isUserAuthenticated &&
      (pathname.endsWith('/sign-in') || pathname.endsWith('/sign-up'))
    ) {
      redirect("/");
    }
    return (
        <div className="auth-layout">{children}</div>
    );
};
export default AuthLayout;
