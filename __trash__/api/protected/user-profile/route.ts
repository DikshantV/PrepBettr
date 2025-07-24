import { NextRequest, NextResponse } from 'next/server';
import { firebaseVerification } from '@/lib/services/firebase-verification';
import { getDBService } from '@/firebase/admin';
import { subscriptionService } from '@/lib/services/subscription-service';

export async function GET(request: NextRequest) {
  try {
    // Get session cookie from request
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the session token
    const verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);
    
    if (!verificationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid session',
          details: verificationResult.error 
        },
        { status: 401 }
      );
    }

    const decodedToken = verificationResult.decodedToken;
    
    // Additional server-side validation
    const validationResult = await firebaseVerification.validateTokenClaims(decodedToken);
    if (!validationResult.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid token claims',
          details: validationResult.errors 
        },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    console.log(`Fetching profile for user: ${userId} (verified via ${verificationResult.method})`);

    // Fetch user profile from database (example)
    try {
      const db = getDBService();
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        // Create basic user profile if it doesn't exist
        const basicProfile = {
          uid: userId,
          email: decodedToken.email,
          name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        };
        
        await db.collection('users').doc(userId).set(basicProfile);
        
        // Initialize subscription and usage counters for new user
        try {
          await subscriptionService.initializeUserSubscription(
            userId,
            decodedToken.email || '',
            basicProfile.name
          );
          console.log(`Subscription initialized for new user: ${userId}`);
        } catch (subscriptionError) {
          console.error('Failed to initialize subscription for new user:', subscriptionError);
          // Don't fail the request if subscription initialization fails
        }
        
        return NextResponse.json({
          success: true,
          user: basicProfile,
          isNewUser: true
        });
      }

      const userData = userDoc.data();
      
      // Update last login
      await db.collection('users').doc(userId).update({
        lastLogin: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        user: {
          uid: userId,
          email: decodedToken.email,
          name: userData?.name || decodedToken.name,
          ...userData
        },
        isNewUser: false
      });
      
    } catch (dbError) {
      console.error('Database error:', dbError);
      
      // Return basic user info from token if database fails
      return NextResponse.json({
        success: true,
        user: {
          uid: userId,
          email: decodedToken.email,
          name: decodedToken.name || decodedToken.email?.split('@')[0] || 'User'
        },
        isNewUser: false,
        warning: 'Profile loaded from token (database unavailable)'
      });
    }

  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get session cookie from request
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify the session token
    const verificationResult = await firebaseVerification.verifyIdToken(sessionCookie);
    
    if (!verificationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid session',
          details: verificationResult.error 
        },
        { status: 401 }
      );
    }

    const decodedToken = verificationResult.decodedToken;
    const userId = decodedToken.uid;
    
    // Get update data from request body
    const updateData = await request.json();
    
    // Validate update data (basic example)
    const allowedFields = ['name', 'bio', 'preferences'];
    const filteredData = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateData[key];
        return obj;
      }, {} as Record<string, any>);

    if (Object.keys(filteredData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update user profile in database
    try {
      const db = getDBService();
      await db.collection('users').doc(userId).update({
        ...filteredData,
        updatedAt: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        message: 'Profile updated successfully',
        updatedFields: Object.keys(filteredData)
      });
      
    } catch (dbError) {
      console.error('Database update error:', dbError);
      return NextResponse.json(
        { 
          error: 'Failed to update profile',
          details: 'Database unavailable'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Profile update API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
