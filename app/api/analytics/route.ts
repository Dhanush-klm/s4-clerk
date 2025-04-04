import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    // Fetch users directly from Clerk's API
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

    // Set up date filtering
    const filterStart = startDate ? new Date(startDate) : null;
    const filterEnd = endDate ? new Date(endDate) : null;
    if (filterEnd) filterEnd.setHours(23, 59, 59, 999);

    // Filter users based on date range if provided
    const filteredUsers = users.filter((user: any) => {
      const userDate = new Date(user.created_at);
      return (!filterStart || userDate >= filterStart) && 
             (!filterEnd || userDate <= filterEnd);
    });

    // Calculate statistics for the filtered period
    const totalUsers = users.length;
    const activeUsers = filteredUsers.filter((user: any) => 
      user.last_sign_in_at && 
      (!filterStart || new Date(user.last_sign_in_at) >= filterStart) &&
      (!filterEnd || new Date(user.last_sign_in_at) <= filterEnd)
    ).length;

    const signUps = filteredUsers.length;

    const signIns = filteredUsers.filter((user: any) => 
      user.last_sign_in_at &&
      (!filterStart || new Date(user.last_sign_in_at) >= filterStart) &&
      (!filterEnd || new Date(user.last_sign_in_at) <= filterEnd)
    ).length;

    // Get all signups from filtered users
    const recentSignups = filteredUsers
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((user: any) => ({
        name: user.first_name || user.username || 'Anonymous',
        email: user.email_addresses?.[0]?.email_address || 'No email',
        timestamp: user.created_at
      }));

    // Get all sign-ins from filtered users
    const recentSignIns = filteredUsers
      .filter((user: any) => user.last_sign_in_at)
      .sort((a: any, b: any) => new Date(b.last_sign_in_at).getTime() - new Date(a.last_sign_in_at).getTime())
      .map((user: any) => ({
        name: user.first_name || user.username || 'Anonymous',
        email: user.email_addresses?.[0]?.email_address || 'No email',
        timestamp: user.last_sign_in_at
      }));

    return NextResponse.json({
      totalUsers,
      activeUsers,
      signUps,
      signIns,
      recentSignups,
      recentSignIns
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
} 