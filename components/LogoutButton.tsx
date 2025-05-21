"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/profile/logout", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <Button onClick={handleLogout} className="btn btn-destructive ml-2">
      Logout
    </Button>
  );
}

