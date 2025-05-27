"use client";

import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import Image from "next/image";

export default function ProfileForm({ user }: { user: any }) {
  const [name, setName] = useState(user?.name || "");
  const [email] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [profilePic, setProfilePic] = useState(user?.image || "/user-avatar.svg");
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setProfilePic(URL.createObjectURL(file));
    setProfilePicFile(file);
  };

  async function toBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let profilePicData = profilePic;
    if (profilePicFile) {
      profilePicData = await toBase64(profilePicFile);
    }
    const res = await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password: password || undefined, profilePic: profilePicData }),
    });
    setLoading(false);
    if (res.ok) {
      alert("Profile updated!");
    } else {
      const data = await res.json();
      alert(data.error || "Failed to update profile");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card-border max-w-[420px] mx-auto mt-8">
      <div className="flex flex-col gap-6 card py-14 px-10">
        <div className="flex flex-row gap-2 justify-center">
          <Image src="/logo.svg" alt="logo" height={32} width={38} />
          <h2 className="text-primary-100">PrepBettr</h2>
        </div>
        <h3 className="text-center">Update your profile details</h3>
        <div className="flex flex-col items-center gap-4">
          <Image
            src={profilePic}
            alt="Profile Picture"
            width={96}
            height={96}
            className="rounded-full object-cover border"
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Change Picture
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
          <Button type="submit" disabled={loading} className="btn">
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
