"use server";

import { getCurrentUser } from "@/lib/actions/auth.action";
import { db } from "@/firebase/admin";
import { dummyInterviews } from "@/constants";

// Get user's interviews
export async function getUserInterviews(): Promise<Interview[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const interviewsRef = db.collection('interviews');
    const query = interviewsRef
      .where('userId', '==', user.id)
      .orderBy('createdAt', 'desc');
    
    const snapshot = await query.get();
    
    return snapshot.docs.map((doc: FirebaseFirestore.DocumentData) => ({
      id: doc.id,
      ...doc.data()
    })) as Interview[];
    
  } catch (error) {
    console.error('Error fetching user interviews:', error);
    return [];
  }
}

// Generate random mock interviews for dashboard display
function generateMockInterviews(): Interview[] {
  const roles = [
    "Frontend Developer", "Backend Developer", "Full Stack Developer", 
    "Software Engineer", "DevOps Engineer", "Data Scientist", 
    "Mobile Developer", "UI/UX Designer", "Product Manager", "QA Engineer"
  ];
  
  const types = ["Technical", "Behavioral", "Mixed"];
  const levels = ["Junior", "Mid", "Senior"];
  
  const techStacks = [
    ["React", "TypeScript", "Next.js", "Tailwind CSS"],
    ["Node.js", "Express", "MongoDB", "JavaScript"],
    ["Python", "Django", "PostgreSQL", "Redis"],
    ["Vue.js", "Nuxt.js", "Vuex", "SCSS"],
    ["Angular", "TypeScript", "RxJS", "Material UI"],
    ["React Native", "JavaScript", "Firebase", "Redux"],
    ["Flutter", "Dart", "SQLite", "Provider"],
    ["Java", "Spring Boot", "MySQL", "Docker"],
    ["Go", "Gin", "PostgreSQL", "AWS"],
    ["C#", "ASP.NET", "SQL Server", "Azure"]
  ];
  
  const mockInterviews: Interview[] = [];
  
  for (let i = 0; i < 8; i++) {
    const roleIndex = i % roles.length;
    const typeIndex = i % types.length;
    const levelIndex = i % levels.length;
    const techStackIndex = i % techStacks.length;
    
    mockInterviews.push({
      id: `mock-interview-${i + 1}`,
      userId: "public",
      role: roles[roleIndex],
      type: types[typeIndex],
      level: levels[levelIndex],
      techstack: techStacks[techStackIndex],
      questions: ["Sample question for this interview"],
      finalized: true,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  
  return mockInterviews;
}

// Get public/finalized interviews (excluding user's own)
export async function getPublicInterviews(): Promise<Interview[]> {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const interviewsRef = db.collection('interviews');
    const query = interviewsRef
      .where('finalized', '==', true)
      .where('userId', '!=', user.id)
      .orderBy('createdAt', 'desc')
      .limit(20);
    
    const snapshot = await query.get();
    
    const interviews = snapshot.docs.map((doc: FirebaseFirestore.DocumentData) => ({
      id: doc.id,
      ...doc.data()
    })) as Interview[];
    
    // Use mock data if no interviews found
    if (interviews.length === 0) {
      return generateMockInterviews();
    }
    return interviews;
    
  } catch (error) {
    console.error('Error fetching public interviews:', error);
    // Return mock data on error as fallback
    return generateMockInterviews();
  }
}

