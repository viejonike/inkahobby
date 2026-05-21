import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, userId, type, data, thumbnail, createdAt, synced } = body;

    if (!userId || !type || !data) {
      return NextResponse.json({ error: 'userId, type, and data are required' }, { status: 400 });
    }

    // Check if the user exists first
    const userExists = await db.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      // If user doesn't exist on server, we can't sync the file yet
      // This file will be retried in the next sync cycle
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

    const file = await db.vaultFile.create({
      data: {
        id: id || undefined,
        userId,
        type,
        data,
        thumbnail: thumbnail || null,
        createdAt: createdAt ? new Date(createdAt) : undefined,
        synced: true,
      },
    });

    console.log(`[Sync] File synced: ${file.id} (type: ${type}, user: ${userId})`);
    return NextResponse.json(file);
  } catch (error) {
    console.error('[Sync] Error syncing file:', error);
    return NextResponse.json({ error: 'Failed to sync file' }, { status: 500 });
  }
}
