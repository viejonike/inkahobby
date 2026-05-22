import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Increase body size limit for large base64 file uploads (photos/videos can be 10-50MB)
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, userId, type, data, thumbnail, createdAt, username } = body;

    if (!userId || !type || !data) {
      return NextResponse.json({ error: 'userId, type, and data are required' }, { status: 400 });
    }

    // Check if the user exists first - try by id first, then by username
    let userExists = await db.user.findUnique({ where: { id: userId } });

    // If user not found by id, it might be because the server assigned a different id
    // Check if there's a user with the same username (device binding case)
    if (!userExists && username) {
      userExists = await db.user.findUnique({ where: { username } });
      if (userExists) {
        console.log(`[Sync File] User found by username "${username}" (server id: ${userExists.id}, client id: ${userId})`);
      }
    }

    if (!userExists) {
      // User not found - file sync will be retried after user sync
      console.warn(`[Sync File] User ${userId} not found on server. File sync deferred.`);
      return NextResponse.json(
        { error: 'User not found on server. File sync will be retried.', needsRetry: true },
        { status: 404 }
      );
    }

    // Skip if file already exists
    const existing = await db.vaultFile.findUnique({ where: { id } });
    if (existing) {
      return NextResponse.json({ message: 'File already synced', file: existing });
    }

    // Use the server's user id (in case it differs from client's)
    const serverUserId = userExists.id;

    const file = await db.vaultFile.create({
      data: {
        id: id || undefined,
        userId: serverUserId,
        type,
        data,
        thumbnail: thumbnail || null,
        createdAt: createdAt ? new Date(createdAt) : undefined,
        synced: true,
      },
    });

    console.log(`[Sync] File synced: ${file.id.slice(0, 8)}... (type: ${type}, user: ${serverUserId})`);
    return NextResponse.json(file);
  } catch (error) {
    console.error('[Sync] Error syncing file:', error);
    return NextResponse.json({ error: 'Failed to sync file' }, { status: 500 });
  }
}
