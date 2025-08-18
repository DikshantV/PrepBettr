import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.set("session", "", {
      expires: new Date(0),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
    
    return NextResponse.json(
      { success: true, message: "Signed out successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error signing out:", error);
    return NextResponse.json(
      { success: false, message: "Failed to sign out" },
      { status: 500 }
    );
  }
}
