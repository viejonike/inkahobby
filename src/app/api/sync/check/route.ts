import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders } from '@/lib/cors';

// POST - Check if the current user's file sync is requested by admin
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json({ syncRequested: false }, { headers: corsHeaders() });
    }

    const user = await db.user.findUnique({ where: { username } });

    return NextResponse.json({
      syncRequested: user?.syncRequested || false,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[Sync Check] Error:', error);
    return NextResponse.json({ syncRequested: false }, { headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() });
}
