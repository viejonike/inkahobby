import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders } from '@/lib/cors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, username, email, pin, role, blocked, createdAt, deviceId } = body;

    if (!username || !pin) {
      return NextResponse.json({ error: 'Username and PIN are required' }, { status: 400, headers: corsHeaders() });
    }

    // Try to find existing user by username first
    const existingUser = await db.user.findUnique({ where: { username } });

    if (existingUser) {
      // Update existing user - preserve the server's id to maintain file relationships
      const user = await db.user.update({
        where: { username },
        data: {
          pin,
          role: role || 'user',
          ...(email !== undefined && { email }),
          ...(blocked !== undefined && { blocked }),
        },
      });
      return NextResponse.json(user, { headers: corsHeaders() });
    }

    // Try to find by id (in case username changed but id matches)
    if (id) {
      const existingById = await db.user.findUnique({ where: { id } });
      if (existingById) {
        const user = await db.user.update({
          where: { id },
          data: {
            username,
            pin,
            role: role || 'user',
            ...(email !== undefined && { email }),
            ...(blocked !== undefined && { blocked }),
          },
        });
        return NextResponse.json(user, { headers: corsHeaders() });
      }
    }

    // Create new user - this handles users who registered offline
    // IMPORTANT: Use the client's id to maintain file relationships
    const user = await db.user.create({
      data: {
        id: id || undefined,
        username,
        email: email || null,
        pin,
        role: role || 'user',
        blocked: blocked || false,
        createdAt: createdAt ? new Date(createdAt) : undefined,
      },
    });

    console.log(`[Sync] User synced: ${username} (id: ${user.id}, role: ${user.role})`);
    return NextResponse.json(user, { headers: corsHeaders() });
  } catch (error) {
    console.error('[Sync] Error syncing user:', error);
    return NextResponse.json({ error: 'Failed to sync user' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
}
