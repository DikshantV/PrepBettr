"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import Image from "next/image";

export default function Navbar() {
  const [user, setUser] = useState<{ image?: string } | null>(null);

  useEffect(() => {
    fetch("/api/profile/me").then(async (res) => {
      if (res.ok) setUser(await res.json());
    });
  }, []);

  return (
    <nav className="flex items-center justify-between px-6 py-4">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/logo.svg" alt="MockMate Logo" width={38} height={32} />
        <h2 className="text-primary-100">PrepBettr</h2>
      </Link>
      <div className="flex items-center gap-2">
        <Link href="/profile" className="focus:outline-none">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-primary-100 flex items-center justify-center bg-gray-100">
            <Image
              src={user?.image || "/user-avatar.svg"}
              alt="Profile"
              width={40}
              height={40}
              className="object-cover w-full h-full"
            />
          </div>
        </Link>
        <LogoutButton />
      </div>
    </nav>
  );
}

