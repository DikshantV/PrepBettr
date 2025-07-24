import { ReactNode } from 'react'

const AuthLayout = ({ children }: { children: ReactNode }) => {
    // Authentication redirect is now handled by middleware
    // This layout just provides the structure for auth pages
    
    return (
        <div className="min-h-screen flex items-center justify-center relative">
            {/* Pattern background with overlay */}
            <div 
                className="absolute inset-0" 
                style={{
                    backgroundColor: "#1f2937",
                    backgroundImage: "url('/pattern.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    opacity: 0.3
                }}
            />
            {/* Additional dark overlay for text readability */}
            <div className="absolute inset-0 bg-gray-900/70" />
            <div className="max-w-md w-full space-y-8 p-6 relative z-10">
                {children}
            </div>
        </div>
    );
};
export default AuthLayout;
