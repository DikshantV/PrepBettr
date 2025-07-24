import { ReactNode } from 'react'

const AuthLayout = ({ children }: { children: ReactNode }) => {
    // Authentication redirect is now handled by middleware
    // This layout just provides the structure for auth pages
    
    return (
        <div className="min-h-screen flex items-center justify-center relative">
            {/* Test with highly visible pattern first */}
            <div 
                className="absolute inset-0"
                style={{
                    backgroundColor: "#1f2937",
                    backgroundImage: "url('/pattern.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    opacity: 0.8
                }}
            ></div>
            {/* Minimal overlay for readability */}
            <div className="absolute inset-0 bg-black/30"></div>
            <div className="max-w-md w-full space-y-8 p-6 relative z-10">
                {children}
            </div>
        </div>
    );
};
export default AuthLayout;
