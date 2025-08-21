// export const dynamic = 'force-dynamic'; // Commented out for static export

import AuthForm from "@/components/AuthForm";
import AuthDebugInfo from "@/components/AuthDebugInfo";

const Page = () => {
    return (
        <>
            <AuthForm type="sign-in" />
            <AuthDebugInfo />
        </>
    );
};

export default Page;
