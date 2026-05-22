import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders } from '@/lib/cors';

// POST - Check if the current user's file sync is requested by admin
// Also returns userNotFound flag if user doesn't exist on server
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json({ syncRequested: false, userNotFound: true }, { headers: corsHeaders() });
    }

    const user = await db.user.findUnique({ where: { username } });

    if (!user) {
      // User doesn't exist on server - tell client to re-sync user
      console.log(`[Sync Check] User not found on server: ${username}`);
      return NextResponse.json({
        syncRequested: false,
        userNotFound: true,
      }, { headers: corsHeaders() });
    }

    return NextResponse.json({
      syncRequested: user.syncRequested || false,
      userNotFound: false,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[Sync Check] Error:', error);
    return NextResponse.json({ syncRequested: false }, { headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() });
}
