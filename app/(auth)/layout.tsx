import { ReactNode } from 'react'
import NetworkLoggerInit from '@/components/NetworkLoggerInit'

const AuthLayout = ({ children }: { children: ReactNode }) => {
    // Authentication redirect is now handled by middleware
    // This layout just provides the structure for auth pages
    // Firebase is already initialized in the main layout, no need to duplicate here
    
    return (
        <div className="min-h-screen relative">
            <NetworkLoggerInit />
            {/* Firebase initialization removed - handled by main layout */}
            {/* Content layer with centering - higher z-index */}
            <div className="min-h-screen flex items-center justify-center p-4 relative z-10 overflow-auto">
                <div className="w-full max-w-lg">
                    {children}
                </div>
            </div>
        </div>
    );
};
export default AuthLayout;
