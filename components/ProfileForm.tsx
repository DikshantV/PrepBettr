"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import Image from "next/image";
import { auth } from "@/firebase/client";
import { onAuthStateChanged, User } from "firebase/auth";
import { toast } from "sonner";

interface ProfileUser {
  name?: string;
  email?: string;
  image?: string;
  about?: string;
  phone?: string;
  workplace?: string;
  skills?: string[];
  experience?: string;
  dateOfBirth?: string;
}

export default function ProfileForm({ user }: { user: ProfileUser }) {
  const [name, setName] = useState(user?.name || "");
  const [email] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [about, setAbout] = useState(user?.about || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [workplace, setWorkplace] = useState(user?.workplace || "");
  const [skills, setSkills] = useState<string[]>(user?.skills || []);
  const [skillInput, setSkillInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [experience, setExperience] = useState(user?.experience || "");
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || "");
  const defaultProfilePic = (
    <svg 
      className="w-full h-full text-gray-800 dark:text-white" 
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
  );
  
  const [profilePic, setProfilePic] = useState<string | null>(user?.image || null);
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setProfilePic(URL.createObjectURL(file));
    setProfilePicFile(file);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Get the current user's ID token with force refresh
    let idToken = '';
    try {
      if (!currentUser) {
        throw new Error("User not authenticated");
      }
      idToken = await currentUser.getIdToken(true); // Force token refresh
    } catch (error) {
      console.error('Error getting ID token:', error);
      toast.error("Authentication Error", {
        description: error instanceof Error ? error.message : "Your session has expired. Please sign in again.",
        duration: 5000,
      });
      // Redirect to the sign-in page after showing the error
      setTimeout(() => {
        window.location.href = '/sign-in';
      }, 2000);
      return;
    }

    try {
      let profilePicUrl = profilePic;
      
      // If there's a new profile picture file selected
      if (profilePicFile) {
        // Create form data for file upload
        const formData = new FormData();
        formData.append('file', profilePicFile);
        formData.append('idToken', idToken);
        
        // Upload the file to the server
        const uploadRes = await fetch('/api/upload-profile-pic', {
          method: 'POST',
          body: formData,
        });
        
        if (!uploadRes.ok) {
          const errorData = await uploadRes.json();
          throw new Error(errorData.error || 'Failed to upload profile picture');
        }
        
        const { url } = await uploadRes.json();
        profilePicUrl = url;
      }

      // Update the profile with the new data
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          password: password || undefined, 
          profilePic: profilePicUrl,
          about,
          phone,
          workplace,
          skills,
          experience,
          dateOfBirth,
          idToken
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }
      
      // Show success toast
      toast.success("Profile Updated", {
        description: "Your changes have been saved successfully.",
        duration: 3000,
        position: "top-center",
        style: {
          background: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '0.5rem',
          padding: '1rem',
        },
      });
      
      // If the password was changed, redirect to the sign-in page to get a fresh session
      if (password) {
        toast.success("Password Updated", {
          description: "Please sign in again with your new password.",
          duration: 3000,
        });
        // Sign out and redirect to the sign-in page
        await fetch('/api/auth/signout', { method: 'POST' });
        window.location.href = '/sign-in';
      } else {
        // For non-password updates, just reload the page
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error("Update Failed", {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        duration: 5000,
        position: "top-center",
        style: {
          background: 'hsl(var(--destructive))',
          color: 'hsl(var(--destructive-foreground))',
          border: '1px solid hsl(var(--destructive))',
          borderRadius: '0.5rem',
          padding: '1rem',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto space-y-6 p-8 bg-dark-200 rounded-2xl shadow-lg">
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="relative group">
          <div className="rounded-full border-4 border-primary-200 w-32 h-32 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            {profilePic ? (
              <Image
                src={profilePic}
                alt="Profile Picture"
                width={120}
                height={120}
                className="rounded-full object-cover w-full h-full"
              />
            ) : (
              <div className="w-3/4 h-3/4 text-gray-400">
                {defaultProfilePic}
              </div>
            )}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              type="button" 
              variant="ghost" 
              size="icon"
              className="text-white hover:bg-primary-200/20"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                <line x1="16" x2="22" y1="5" y2="5" />
                <line x1="19" x2="19" y1="2" y2="8" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.1-3.1a2 2 0 0 0-2.814.014L6 21" />
              </svg>
              <span className="sr-only">Change profile picture</span>
            </Button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleProfilePicChange}
        />
      </div>
      
      <div className="space-y-5">
        <div className="space-y-1.5 pb-3">
          <Label htmlFor="name" className="text-light-100">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="bg-dark-100 border-light-600 text-light-100 placeholder-light-400 focus-visible:ring-primary-200 focus-visible:ring-offset-0"
          />
        </div>
        
        <div className="space-y-1.5 pb-3">
          <Label htmlFor="email" className="text-light-100">Email</Label>
          <Input 
            id="email" 
            value={email} 
            disabled 
            className="bg-dark-100/50 border-light-600 text-light-400 cursor-not-allowed" 
          />
        </div>

        <div className="space-y-1.5 pb-3">
          <Label htmlFor="password" className="text-light-100">New Password (leave blank to keep current)</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-dark-100 border-light-600 text-light-100 placeholder-light-400 focus-visible:ring-primary-200 focus-visible:ring-offset-0"
          />
        </div>
        
        <div className="space-y-1.5 pb-3">
          <Label htmlFor="about" className="text-light-100">About Me</Label>
          <Textarea
            id="about"
            value={about}
            onChange={e => setAbout(e.target.value)}
            placeholder="Tell us about yourself..."
            rows={3}
            style={{ backgroundColor: '#0D1117' }}
            className="border-light-600 text-light-100 placeholder-light-400 focus-visible:ring-primary-200 w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3">
          <div className="space-y-1.5 pb-3">
            <Label htmlFor="phone" className="text-light-100">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="bg-dark-100 border-light-600 text-light-100 placeholder-light-400 focus-visible:ring-primary-200 focus-visible:ring-offset-0"
            />
          </div>

          <div className="space-y-1.5 pb-3">
            <Label htmlFor="dateOfBirth" className="text-light-100">Date of Birth</Label>
            <div className="relative">
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={e => setDateOfBirth(e.target.value)}
                className="appearance-none bg-dark-100 border-light-600 text-light-100 placeholder-light-400 focus-visible:ring-primary-200 focus-visible:ring-offset-0 pr-10 [&::-webkit-calendar-picker-indicator]:hidden"
              />
              <button 
                type="button"
                onClick={() => (document.getElementById('dateOfBirth') as HTMLInputElement)?.showPicker()}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-light-400 hover:text-light-100 transition-colors"
                aria-label="Open date picker"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-1.5 pb-3">
          <Label htmlFor="workplace" className="text-light-100">Current Workplace</Label>
          <Input
            id="workplace"
            type="text"
            value={workplace}
            onChange={e => setWorkplace(e.target.value)}
            placeholder="Company Name"
            className="bg-dark-100 border-light-600 text-light-100 placeholder-light-400 focus-visible:ring-primary-200 focus-visible:ring-offset-0"
          />
        </div>

        <div className="space-y-1.5 pb-3">
          <Label htmlFor="skills" className="text-light-100">Skills & Tools</Label>
          <div className="relative">
            <div className="flex flex-wrap gap-2 mb-2">
              {skills.map((skill, index) => (
                <div key={index} className="flex items-center bg-primary-200/20 text-primary-100 px-3 py-1 rounded-full text-sm">
                  {skill}
                  <button
                    type="button"
                    onClick={() => setSkills(skills.filter((_, i) => i !== index))}
                    className="ml-2 text-primary-300 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="relative">
              <Input
                id="skills"
                type="text"
                value={skillInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setSkillInput(value);
                  if (value) {
                    // Simple autocomplete suggestions
                    const techStack = [
                      'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C#', 'C++', 'Ruby', 'PHP',
                      'Go', 'Rust', 'Swift', 'Kotlin', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Git',
                      'HTML', 'CSS', 'SASS', 'Tailwind CSS', 'Bootstrap', 'jQuery', 'Angular', 'Vue.js', 'Next.js',
                      'Express', 'Django', 'Flask', 'Spring', 'Ruby on Rails', 'Laravel', 'ASP.NET', 'GraphQL',
                      'REST API', 'MongoDB', 'PostgreSQL', 'MySQL', 'SQL Server', 'SQLite', 'Firebase', 'Redis',
                      'Machine Learning', 'Data Science', 'Artificial Intelligence', 'Blockchain', 'Cybersecurity',
                      'DevOps', 'CI/CD', 'Agile', 'Scrum', 'Project Management'
                    ];
                    const filtered = techStack.filter(tech => 
                      tech.toLowerCase().includes(value.toLowerCase())
                    );
                    setSuggestions(filtered);
                  } else {
                    setSuggestions([]);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && skillInput.trim() && !skills.includes(skillInput.trim())) {
                    e.preventDefault();
                    setSkills([...skills, skillInput.trim()]);
                    setSkillInput('');
                    setSuggestions([]);
                  } else if (e.key === 'Backspace' && !skillInput && skills.length > 0) {
                    e.preventDefault();
                    setSkills(skills.slice(0, -1));
                  }
                }}
                placeholder="Add skills (e.g., JavaScript, Python, Project Management)"
                className="bg-dark-100 border-light-600 text-light-100 placeholder-light-400 focus-visible:ring-primary-200 focus-visible:ring-offset-0"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-dark-200 border border-light-600 rounded-md shadow-lg max-h-60 overflow-auto">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="px-4 py-2 text-light-100 hover:bg-dark-300 cursor-pointer"
                      onClick={() => {
                        if (!skills.includes(suggestion)) {
                          setSkills([...skills, suggestion]);
                          setSkillInput('');
                          setSuggestions([]);
                        }
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-light-400">Press Enter to add a skill</p>
          </div>
        </div>

        <div className="space-y-1.5 pb-3">
          <Label htmlFor="experience" className="text-light-100">Professional Experience</Label>
          <Textarea
            id="experience"
            value={experience}
            onChange={e => setExperience(e.target.value)}
            placeholder="Describe your professional background and experience..."
            rows={4}
            style={{ backgroundColor: '#0D1117' }}
            className="border-light-600 text-light-100 placeholder-light-400 focus-visible:ring-primary-200 w-full"
          />
        </div>

      </div>
      
      <div className="flex justify-center pt-4">
        <Button 
          type="submit" 
          disabled={loading}
          className="btn-primary w-full max-w-xs py-6 text-lg font-semibold"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
