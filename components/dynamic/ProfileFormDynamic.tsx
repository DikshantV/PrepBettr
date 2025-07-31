"use client";

import dynamic from 'next/dynamic';

interface ProfileUser {
  name?: string;
  email?: string;
  emailVerified?: boolean;
  image?: string;
  about?: string;
  phone?: string;
  workplace?: string;
  skills?: string[];
  experience?: string;
  dateOfBirth?: string;
}

interface ProfileFormProps {
  user: ProfileUser;
}

const ProfileForm = dynamic(
  () => import('../ProfileForm'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full max-w-lg mx-auto space-y-6 p-8 bg-gray-900 border border-gray-700 rounded-2xl shadow-lg">
        <div className="animate-pulse">
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="rounded-full bg-gray-700 w-32 h-32"></div>
            <div className="h-4 bg-gray-700 rounded w-48"></div>
          </div>
          
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-700 rounded w-24"></div>
                <div className="h-10 bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
          
          <div className="mt-6">
            <div className="h-12 bg-blue-700 rounded opacity-50"></div>
          </div>
        </div>
      </div>
    )
  }
);

export default function ProfileFormDynamic(props: ProfileFormProps) {
  return <ProfileForm {...props} />;
}
