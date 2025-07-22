import DashboardClient from "./DashboardClient";
import { getUserInterviews, getPublicInterviews, getUserUsage } from "@/lib/actions/dashboard.action";

// The user is now provided via AuthContext from the layout
async function Home() {
    // Fetch data using server actions
    const userInterviews = await getUserInterviews();
    const publicInterviews = await getPublicInterviews();
    const usage = await getUserUsage();

    return (
        <DashboardClient 
            userInterviews={userInterviews} 
            publicInterviews={publicInterviews}
            usage={usage}
        />
    );
}

export default Home;
