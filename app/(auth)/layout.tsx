import { ReactNode } from 'react'

const AuthLayout = ({ children }: { children: ReactNode }) => {
    // Authentication redirect is now handled by middleware
    // This layout just provides the structure for auth pages
    
    return (
        <div className="min-h-screen flex items-center justify-center relative bg-gray-900">
            {/* Background pattern with proper opacity */}
            <div 
                className="absolute inset-0 -z-10" 
                style={{
                    backgroundImage: "url('/pattern.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    opacity: 0.1
                }}
            />
            <div className="max-w-md w-full space-y-8 p-6">
                {children}
            </div>
        </div>
    );
};
export default AuthLayout;
