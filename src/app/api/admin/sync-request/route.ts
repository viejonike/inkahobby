import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders } from '@/lib/cors';

export const runtime = 'nodejs';
export const maxDuration = 30;

// POST - Admin requests sync for a specific user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400, headers: corsHeaders() });
    }

    // Find user by id or username
    let user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await db.user.findUnique({ where: { username: userId } });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders() });
    }

    // Set syncRequested = true
    const updated = await db.user.update({
      where: { id: user.id },
      data: { syncRequested: true },
    });

    console.log(`[Admin] Sync requested for user: ${updated.username} (${updated.id})`);
    return NextResponse.json({
      message: `Sync requested for ${updated.username}`,
      user: updated,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[Admin] Error requesting sync:', error);
    return NextResponse.json({ error: 'Failed to request sync' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() });
}
