import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { corsHeaders } from '@/lib/cors';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const runtime = 'nodejs';

/**
 * Generate a signed upload params for direct client upload to Cloudinary
 * This bypasses the Vercel 4.5MB body size limit
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { folder, publicId, username } = body;

    // Verify the user exists and has syncRequested
    if (username) {
      const { db } = await import('@/lib/db');
      const user = await db.user.findUnique({ where: { username } });
      if (!user || !user.syncRequested) {
        return NextResponse.json(
          { error: 'Sync not requested by admin' },
          { status: 403, headers: corsHeaders() }
        );
      }
    }

    const timestamp = Math.round(new Date().getTime() / 1000);

    const paramsToSign: Record<string, string> = {
      timestamp: timestamp.toString(),
      folder: folder || 'inkahobby',
    };

    if (publicId) {
      paramsToSign.public_id = publicId;
    }

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!
    );

    return NextResponse.json({
      signature,
      timestamp,
      folder: paramsToSign.folder,
      publicId: paramsToSign.public_id,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[Cloudinary] Error generating signature:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload signature' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() });
}
