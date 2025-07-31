import DashboardClient from "./DashboardClient";
import { getUserInterviews, getPublicInterviews } from "@/lib/actions/dashboard.action";

// The user is now provided via AuthContext from the layout
async function Home() {
    // Fetch data using server actions
    const userInterviews = await getUserInterviews();
    const publicInterviews = await getPublicInterviews();

    return (
        <DashboardClient 
            userInterviews={userInterviews} 
            publicInterviews={publicInterviews}
        />
    );
}

export default Home;
