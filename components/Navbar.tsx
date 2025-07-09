"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Navbar() {
  const [user, setUser] = useState<{ image?: string } | null>(null);

  useEffect(() => {
    fetch("/api/profile/me").then(async (res) => {
      if (res.ok) setUser(await res.json());
    });
  }, []);

  return (
    <nav className="flex items-center justify-between px-6 pt-16 pb-4">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/logo.svg" alt="MockMate Logo" width={38} height={32} />
        <h2 className="text-primary-100">PrepBettr</h2>
      </Link>
      <div className="flex items-center gap-2">
        <Link href="/profile" className="focus:outline-none">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-primary-100 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            {user?.image ? (
              <Image
                src={user.image}
                alt="Profile"
                width={40}
                height={40}
                className="object-cover w-full h-full"
              />
            ) : (
              <svg 
                className="w-6 h-6 text-gray-800 dark:text-white" 
                aria-hidden="true" 
                xmlns="http://www.w3.org/2000/svg" 
                width="24" 
                height="24" 
                fill="none" 
                viewBox="0 0 24 24"
              >
                <path 
                  stroke="currentColor" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0a8.949 8.949 0 0 0 4.951-1.488A3.987 3.987 0 0 0 13 16h-2a3.987 3.987 0 0 0-3.951 3.512A8.948 8.948 0 0 0 12 21Zm3-11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </svg>
            )}
          </div>
        </Link>
      </div>
    </nav>
  );
}

