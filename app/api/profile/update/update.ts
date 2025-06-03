import { NextApiRequest, NextApiResponse } from "next";
import { auth as adminAuth } from "@/firebase/admin";
import { getFirestore, setDoc } from "firebase-admin/firestore";

export interface UpdateProfileRequest {
    name: string;
    password?: string;
    profilePic: string;
    idToken: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { name, password, profilePic, idToken } = req.body as UpdateProfileRequest;

    if (!name || !profilePic || !idToken) {
        return res.status(400).json({ 
            error: "Name, profile picture, and idToken are required." 
        });
    }

    try {
        // Verify ID token and get UID
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const db = getFirestore();
        
        // Update Firestore user document
        const userRef = db.collection("users").doc(uid);
        await setDoc(
            userRef,
            { 
                name, 
                profilePic,
                updatedAt: new Date().toISOString() 
            },
            { merge: true }
        );

        // Update Firebase Auth profile
        const updateData: any = {
            displayName: name,
            photoURL: profilePic
        };
        
        if (password) {
            updateData.password = password;
        }

        await adminAuth.updateUser(uid, updateData);

        return res.status(200).json({ 
            success: true,
            message: "Profile updated successfully." 
        });
        
    } catch (error) {
        console.error("Error updating profile:", error);
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        return res.status(500).json({ 
            success: false,
            error: errorMessage 
        });
    }
}

