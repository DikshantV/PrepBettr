import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { firebaseVerification } from "@/lib/services/firebase-verification";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json(null, { status: 400 });
  }

  // Find user by email in Firestore
  const userQuery = await db.collection("users").where("email", "==", email).limit(1).get();
  if (userQuery.empty) {
    return NextResponse.json(null, { status: 401 });
  }
  const userDoc = userQuery.docs[0];
  const user = userDoc.data();

  // If you store hashed passwords, compare them here
  // For demo: compare plain text (not secure, but matches your current logic)
  // If you use bcrypt, uncomment the following lines:
  // const isValid = await bcrypt.compare(password, user.password);
  // if (!isValid) {
  //   return NextResponse.json(null, { status: 401 });
  // }
  if (user.password !== password) {
    return NextResponse.json(null, { status: 401 });
  }

  // Return user object for NextAuth session
  return NextResponse.json({
    id: userDoc.id,
    name: user.name,
    email: user.email,
    image: user.image || null,
  });
}

