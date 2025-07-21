"use client";
import Image from 'next/image';
import { motion } from "motion/react";
import { useSidebar } from "@/components/ui/sidebar";

export const SidebarLogo = () => {
  const { open, animate } = useSidebar();
  
  return (
    <div className="flex items-center justify-center h-12 w-full mb-4">
      <div className="flex items-center">
        <Image 
          src="/logo.svg" 
          alt="Logo" 
          width={32}
          height={32}
          className="h-8 w-8 shrink-0"
        />
        <motion.span
          animate={{
            display: animate ? (open ? "inline-block" : "none") : "inline-block",
            opacity: animate ? (open ? 1 : 0) : 1,
          }}
          className="ml-3 text-lg font-semibold whitespace-nowrap text-neutral-800 dark:text-neutral-200"
        >
          PrepBettr
        </motion.span>
      </div>
    </div>
  );
};
