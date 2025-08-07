import DashboardClientRealtime from "./DashboardClientRealtime";
import { getUserInterviews, getPublicInterviews } from "@/lib/actions/dashboard.action";

// The user is now provided via AuthContext from the layout
async function Home() {
    // Fetch initial data as fallback for faster initial load
    // Real-time listeners will take over after hydration
    try {
        const [userInterviews, publicInterviews] = await Promise.all([
            getUserInterviews(),
            getPublicInterviews()
        ]);

        return (
            <DashboardClientRealtime 
                initialUserInterviews={userInterviews} 
                initialPublicInterviews={publicInterviews}
            />
        );
    } catch (error) {
        console.error('Error fetching initial data:', error);
        // Still render the component, real-time hooks will handle the data fetching
        return <DashboardClientRealtime />;
    }
}

export default Home;
