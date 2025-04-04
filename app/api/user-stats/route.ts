import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get all users
    const response = await fetch('https://api.clerk.com/v1/users?limit=100', {
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users from Clerk');
    }

    const users = await response.json();

    // Calculate statistics
    const totalUsers = users.length;
    
    // Get recent signups
    return NextResponse.json({ totalUsers });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch user statistics' }, { status: 500 });
  }
} 