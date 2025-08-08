import DashboardClientRealtime from "./DashboardClientRealtime";

// The user is now provided via AuthContext from the layout
// Real-time hooks handle all data fetching directly
function Home() {
    return <DashboardClientRealtime />;
}

export default Home;
