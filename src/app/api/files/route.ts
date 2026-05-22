import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { corsHeaders } from '@/lib/cors';
import { deleteFromCloudinary } from '@/lib/cloudinary';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const where = userId ? { userId } : {};

    const files = await db.vaultFile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { username: true },
        },
      },
    });

    // Transform files for admin panel: use Cloudinary URL if available
    const transformedFiles = files.map(file => ({
      ...file,
      // If we have a Cloudinary URL, use it as the data source for the viewer
      data: file.cloudinaryUrl || file.data,
      // Use thumbnail URL if available
      thumbnail: file.cloudinaryUrl ? null : file.thumbnail, // Cloudinary handles thumbnails via URL params
    }));

    return NextResponse.json(transformedFiles, {
      headers: corsHeaders(),
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400, headers: corsHeaders() });
    }

    // Get file to find Cloudinary public ID
    const file = await db.vaultFile.findUnique({ where: { id: fileId } });
    if (file?.cloudinaryPublicId) {
      await deleteFromCloudinary(file.cloudinaryPublicId);
    }

    await db.vaultFile.delete({ where: { id: fileId } });
    return NextResponse.json({ success: true }, {
      headers: corsHeaders(),
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
}
