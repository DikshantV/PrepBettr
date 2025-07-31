"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface StickyBannerProps {
  showBanner: boolean;
  message: string;
  hideOnScroll?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const StickyBanner = ({
  showBanner,
  message,
  hideOnScroll = false,
  className,
  children,
}: StickyBannerProps) => {
  const [isVisible, setIsVisible] = useState(showBanner);
  const [isScrollHidden, setIsScrollHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    setIsVisible(showBanner);
  }, [showBanner]);

  useEffect(() => {
    if (!hideOnScroll || !isVisible) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        // Scrolling down
        setIsScrollHidden(true);
      } else {
        // Scrolling up
        setIsScrollHidden(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY, hideOnScroll, isVisible]);

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out",
        isScrollHidden ? "-translate-y-full" : "translate-y-0",
        className
      )}
    >
      <div className="bg-black text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center justify-center flex-1">
          <span className="text-sm font-medium">{message}</span>
          {children}
        </div>
        <button
          onClick={handleClose}
          className="ml-4 p-1 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Close banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
