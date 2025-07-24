import { ReactNode } from 'react'

const AuthLayout = ({ children }: { children: ReactNode }) => {
    // Authentication redirect is now handled by middleware
    // This layout just provides the structure for auth pages
    
    return (
        <div className="min-h-screen flex items-center justify-center relative bg-gray-900">
            {/* Pattern background - same as DashboardLayout */}
            <div 
                className="absolute inset-0 -z-10" 
                style={{
                    backgroundImage: "url('/pattern.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    opacity: 0.1
                }}
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_600px_at_50%_300px,rgba(201,235,255,0.1),transparent_70%)] dark:bg-[radial-gradient(circle_600px_at_50%_300px,rgba(26,26,46,0.3),transparent_70%)]"></div>
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/20 to-transparent dark:from-black/20"></div>
            </div>
            <div className="max-w-md w-full space-y-8 p-6 relative z-10">
                {children}
            </div>
        </div>
    );
};
export default AuthLayout;
