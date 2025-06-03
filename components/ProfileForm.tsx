"use client";

import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import Image from "next/image";
import { storage } from "@/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth } from "firebase/auth";

export default function ProfileForm({ user }: { user: any }) {
  const [name, setName] = useState(user?.name || "");
  const [email] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [profilePic, setProfilePic] = useState(user?.image || "/default-avatar.svg");
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Check if using default avatar
  const isDefaultAvatar = !user?.image || user.image === '/default-avatar.svg';

  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    
    // Only update if a new file is selected
    if (file) {
      setProfilePic(URL.createObjectURL(file));
      setProfilePicFile(file);
    }
  };
  const uploadProfilePic = async (file: File, userEmail: string) => {
    try {
      console.log('Starting file upload...');
      // Sanitize the filename
      const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${sanitizedEmail}_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `profile-pictures/${fileName}`);
      
      console.log('Uploading file to:', `profile-pictures/${fileName}`);
      const snapshot = await uploadBytes(storageRef, file);
      console.log('Upload completed, getting download URL...');
      
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('Download URL:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('Error in uploadProfilePic:', error);
      throw error; // Re-throw to be caught by the caller
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted');
    setLoading(true);
    
    // Log form data for debugging
    console.log('Form data:', { 
      name, 
      email, 
      hasPassword: !!password, 
      hasProfilePicFile: !!profilePicFile,
      currentProfilePic: profilePic
    });

    try {
      let profilePicUrl = null;

      // If we have a new profile picture file, upload it
      if (profilePicFile) {
        try {
          console.log('New profile picture selected, uploading...');
          profilePicUrl = await uploadProfilePic(profilePicFile, email);
          console.log('Profile picture uploaded successfully:', profilePicUrl);
        } catch (error) {
          console.error("Error uploading profile picture:", error);
          throw new Error("Failed to upload profile picture. Please try again.");
        }
      } else if (profilePic && profilePic !== '/default-avatar.svg') {
        // Keep the existing profile picture if no new file is selected
        profilePicUrl = profilePic;
        console.log('Using existing profile picture:', profilePicUrl);
      }

      // Get Firebase ID token for secure API call
      const auth = getAuth();
      const currentUser = auth.currentUser;
      console.log('Current user:', currentUser?.email);
      
      if (!currentUser) {
        console.error('No authenticated user found');
        throw new Error("User not authenticated. Please sign in again.");
      }
      
      let idToken;
      try {
        idToken = await currentUser.getIdToken(true); // Force token refresh
      } catch (error) {
        console.error("Error getting ID token:", error);
        throw new Error("Session expired. Please sign in again.");
      }

      // Prepare the request body
      const requestBody: any = {
        name,
        profilePic: profilePicUrl,
        idToken,
      };

      // Only include password if it's not empty
      if (password) {
        requestBody.password = password;
      }

      console.log('Sending request to update profile');
      
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', res.status);
      const data = await res.json();
      console.log('Response data:', data);

      if (!res.ok) {
        console.error('API Error:', data);
        throw new Error(data.error || "Failed to update profile. Please try again.");
      }

      // Show success message and reload after a short delay
      alert("Profile updated successfully!");
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      alert(error.message || "An unexpected error occurred. Please check the console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-border lg:min-w-[566px]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 card py-14 px-10 w-full form">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
            <svg className="w-16 h-16 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0a8.949 8.949 0 0 0 4.951-1.488A3.987 3.987 0 0 0 13 16h-2a3.987 3.987 0 0 0-3.951 3.512A8.948 8.948 0 0 0 12 21Zm3-11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
            </svg>
            {!isDefaultAvatar && (
              <Image
                src={profilePic}
                alt=""
                width={96}
                height={96}
                className="absolute inset-0 w-full h-full object-cover"
                aria-hidden="true"
              />
            )}
          </div>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            className="mt-2"
          >
            {isDefaultAvatar ? 'Add Photo' : 'Change Photo'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleProfilePicChange}
          />
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} disabled className="mt-1 bg-gray-100" />
        </div>
        <div>
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="New Password"
            className="mt-1"
          />
        </div>
        <div className="flex justify-center gap-4 mt-6">
          <Button 
          className="btn" 
          type="submit" 
          disabled={loading}
          onClick={(e) => {
            console.log('Button clicked');
            // Let the form handle the submission
          }}
        >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
