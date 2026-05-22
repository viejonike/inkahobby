import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders } from '@/lib/cors';
import { uploadToCloudinary } from '@/lib/cloudinary';

// Increase body size limit for large base64 file uploads
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, userId, type, data, thumbnail, createdAt, username } = body;

    if (!userId || !type || !data) {
      return NextResponse.json({ error: 'userId, type, and data are required' }, { status: 400, headers: corsHeaders() });
    }

    // Check if the user exists and has syncRequested
    let userExists = await db.user.findUnique({ where: { id: userId } });

    // If user not found by id, check by username
    if (!userExists && username) {
      userExists = await db.user.findUnique({ where: { username } });
      if (userExists) {
        console.log(`[Sync File] User found by username "${username}" (server id: ${userExists.id}, client id: ${userId})`);
      }
    }

    if (!userExists) {
      console.warn(`[Sync File] User ${userId} not found on server. File sync deferred.`);
      return NextResponse.json(
        { error: 'User not found on server. File sync will be retried.', needsRetry: true },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Check if admin has requested sync for this user
    if (!userExists.syncRequested) {
      console.log(`[Sync File] Sync not requested for user ${userExists.username}. File skipped.`);
      return NextResponse.json(
        { message: 'Sync not requested by admin. File kept locally.', notRequested: true },
        { headers: corsHeaders() }
      );
    }

    // Skip if file already exists
    const existing = await db.vaultFile.findUnique({ where: { id } });
    if (existing) {
      return NextResponse.json({ message: 'File already synced', file: existing }, { headers: corsHeaders() });
    }

    const serverUserId = userExists.id;

    // Upload to Cloudinary
    let cloudinaryUrl: string | null = null;
    let cloudinaryPublicId: string | null = null;

    try {
      const folder = `inkahobby/${serverUserId}`;
      const publicId = `${type}_${id?.slice(0, 12) || Date.now()}`;
      const result = await uploadToCloudinary(data, folder, publicId);
      cloudinaryUrl = result.url;
      cloudinaryPublicId = result.public_id;
      console.log(`[Sync File] Uploaded to Cloudinary: ${cloudinaryPublicId}`);
    } catch (cloudErr) {
      console.error('[Sync File] Cloudinary upload failed, storing in DB as fallback:', cloudErr);
      // Fallback: store base64 in DB if Cloudinary fails
    }

    // Also upload thumbnail to Cloudinary if it exists and is different from data
    let thumbnailUrl: string | null = null;
    if (thumbnail && thumbnail !== data) {
      try {
        const thumbResult = await uploadToCloudinary(thumbnail, `inkahobby/${serverUserId}/thumbs`, `thumb_${id?.slice(0, 12) || Date.now()}`);
        thumbnailUrl = thumbResult.url;
      } catch {
        // Thumbnail upload failed - not critical
      }
    }

    const file = await db.vaultFile.create({
      data: {
        id: id || undefined,
        userId: serverUserId,
        type,
        data: cloudinaryUrl ? '' : data, // Don't store base64 if we have Cloudinary URL
        thumbnail: thumbnailUrl || (cloudinaryUrl ? null : thumbnail), // If cloud, don't store thumbnail base64
        cloudinaryUrl,
        cloudinaryPublicId,
        createdAt: createdAt ? new Date(createdAt) : undefined,
        synced: true,
      },
    });

    console.log(`[Sync] File synced: ${file.id.slice(0, 8)}... (type: ${type}, user: ${serverUserId}, cloud: ${!!cloudinaryUrl})`);
    return NextResponse.json(file, { headers: corsHeaders() });
  } catch (error) {
    console.error('[Sync] Error syncing file:', error);
    return NextResponse.json({ error: 'Failed to sync file' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() });
}
