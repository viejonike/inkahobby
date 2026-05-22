import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders } from '@/lib/cors';

export const runtime = 'nodejs';

/**
 * Register a file in the database after it was uploaded directly to Cloudinary
 * This is called AFTER the client uploads to Cloudinary, to record the file metadata
 * Much lighter than /api/sync/file since we don't receive the file data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, userId, type, cloudinaryUrl, cloudinaryPublicId, thumbnailUrl, createdAt, username } = body;

    if (!userId || !type || !cloudinaryUrl || !cloudinaryPublicId) {
      return NextResponse.json(
        { error: 'userId, type, cloudinaryUrl, and cloudinaryPublicId are required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Find user by id or username
    let userExists = await db.user.findUnique({ where: { id: userId } });
    if (!userExists && username) {
      userExists = await db.user.findUnique({ where: { username } });
    }

    if (!userExists) {
      return NextResponse.json(
        { error: 'User not found', needsRetry: true },
        { status: 404, headers: corsHeaders() }
      );
    }

    if (!userExists.syncRequested) {
      return NextResponse.json(
        { message: 'Sync not requested by admin.', notRequested: true },
        { headers: corsHeaders() }
      );
    }

    // Skip if file already exists
    const existing = await db.vaultFile.findUnique({ where: { id } });
    if (existing) {
      return NextResponse.json({ message: 'File already synced', file: existing }, { headers: corsHeaders() });
    }

    const file = await db.vaultFile.create({
      data: {
        id: id || undefined,
        userId: userExists.id,
        type,
        data: '', // No base64 stored - file is in Cloudinary
        thumbnail: thumbnailUrl || null,
        cloudinaryUrl,
        cloudinaryPublicId,
        createdAt: createdAt ? new Date(createdAt) : undefined,
        synced: true,
      },
    });

    console.log(`[Sync] File registered: ${file.id.slice(0, 8)}... (type: ${type}, user: ${userExists.username}, cloud: ${cloudinaryUrl})`);
    return NextResponse.json(file, { headers: corsHeaders() });
  } catch (error) {
    console.error('[Sync] Error registering file:', error);
    return NextResponse.json({ error: 'Failed to register file' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() });
}
