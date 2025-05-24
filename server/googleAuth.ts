/**
 * Custom Google OAuth 2.0 Authentication
 * Handles Google sign-in with our own session management
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { storage } from './storage';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

interface GoogleUserProfile {
  id: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

/**
 * Generate Google OAuth URL
 */
export function getGoogleAuthUrl(req: Request): string {
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  const scope = 'openid email profile';
  
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scope,
    access_type: 'offline',
    prompt: 'consent'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for access token and user info
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange code for tokens');
  }

  const tokens = await tokenResponse.json();
  
  // Get user profile using access token
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to fetch user profile');
  }

  const userProfile: GoogleUserProfile = await userResponse.json();
  return { tokens, userProfile };
}

/**
 * Generate JWT token for authenticated user
 */
export function generateJWT(userId: string): string {
  return jwt.sign(
    { userId, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verify JWT token
 */
export function verifyJWT(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware to protect routes requiring authentication
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.auth_token;
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const decoded = verifyJWT(token);
  if (!decoded) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  // Get user from database
  const user = await storage.getUser(decoded.userId);
  if (!user) {
    return res.status(401).json({ message: 'User not found' });
  }

  // Add user to request object
  (req as any).user = user;
  next();
};

/**
 * Create or update user from Google profile
 */
export async function upsertUserFromGoogle(googleProfile: GoogleUserProfile) {
  return await storage.upsertUser({
    id: googleProfile.id,
    email: googleProfile.email,
    firstName: googleProfile.given_name,
    lastName: googleProfile.family_name,
    profileImageUrl: googleProfile.picture,
  });
}