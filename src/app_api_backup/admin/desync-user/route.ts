import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders } from '@/lib/cors';
import { deleteFromCloudinary } from '@/lib/cloudinary';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST - Admin desyncs a user (deletes cloud files, keeps user record)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400, headers: corsHeaders() });
    }

    // Find user
    let user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await db.user.findUnique({ where: { username: userId } });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders() });
    }

    // Get all files for this user that have Cloudinary data
    const files = await db.vaultFile.findMany({
      where: { userId: user.id, cloudinaryPublicId: { not: null } },
      select: { id: true, cloudinaryPublicId: true },
    });

    // Delete files from Cloudinary
    let deletedFromCloud = 0;
    for (const file of files) {
      if (file.cloudinaryPublicId) {
        await deleteFromCloudinary(file.cloudinaryPublicId);
        deletedFromCloud++;
      }
    }

    // Delete ALL vault files from database for this user
    const deletedFiles = await db.vaultFile.deleteMany({
      where: { userId: user.id },
    });

    // Set syncRequested = false
    const updated = await db.user.update({
      where: { id: user.id },
      data: { syncRequested: false },
    });

    console.log(`[Admin] Desync user: ${updated.username} - Deleted ${deletedFiles.count} DB files, ${deletedFromCloud} cloud files`);
    return NextResponse.json({
      message: `Desynced ${updated.username}. Deleted ${deletedFiles.count} files from DB, ${deletedFromCloud} from cloud.`,
      deletedDbFiles: deletedFiles.count,
      deletedCloudFiles: deletedFromCloud,
      user: updated,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[Admin] Error desyncing user:', error);
    return NextResponse.json({ error: 'Failed to desync user' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() });
}
