"use client";

import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Example component demonstrating how to use the useAuth context
 * This component can be used anywhere within the AuthProvider tree
 * to access the current user information without additional API calls
 */
export default function UserProfile() {
  const { user, isAuthenticated, loading } = useAuth();

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center space-x-4 p-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[150px]" />
          <Skeleton className="h-4 w-[120px]" />
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Please sign in to view your profile.</p>
      </div>
    );
  }

  // Authenticated user
  return (
    <div className="flex items-center space-x-4 p-4 bg-background rounded-lg border">
      <div className="relative">
        {user.picture ? (
          <Image
            src={user.picture}
            alt={user.name || user.email || 'User'}
            width={48}
            height={48}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <span className="text-lg font-semibold text-muted-foreground">
              {(user.name || user.email || '?').charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-foreground truncate">
          {user.name || user.email || 'User'}
        </h3>
        <p className="text-sm text-muted-foreground truncate">
          {user.email}
        </p>
      </div>
    </div>
  );
}
