import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export default cloudinary;

/**
 * Upload a base64 file to Cloudinary
 * @param base64Data - The base64 data URI string
 * @param folder - Cloudinary folder (e.g., 'inkahobby/users')
 * @param publicId - Optional custom public ID
 * @returns Object with url and public_id
 */
export async function uploadToCloudinary(
  base64Data: string,
  folder: string = 'inkahobby',
  publicId?: string
): Promise<{ url: string; public_id: string }> {
  const result = await cloudinary.uploader.upload(base64Data, {
    folder,
    public_id: publicId,
    resource_type: 'auto', // Auto-detect image/video/raw
    chunk_size: 6000000, // 6MB chunks for large files
    timeout: 120000, // 2 minute timeout
  });

  return {
    url: result.secure_url,
    public_id: result.public_id,
  };
}

/**
 * Delete a file from Cloudinary by public_id
 * @param publicId - The Cloudinary public ID
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'auto',
      invalidate: true, // Invalidate CDN cache
    });
  } catch (error) {
    console.error('[Cloudinary] Error deleting file:', publicId, error);
    // Don't throw - we still want to delete from DB even if Cloudinary fails
  }
}

/**
 * Delete all files in a Cloudinary folder
 * @param folder - The folder path
 */
export async function deleteFolderFromCloudinary(folder: string): Promise<void> {
  try {
    // First, get all resources in the folder
    const resources = await cloudinary.api.resources({
      type: 'upload',
      prefix: folder,
      max_results: 500,
    });

    // Delete all resources
    if (resources.resources && resources.resources.length > 0) {
      const publicIds = resources.resources.map((r: { public_id: string }) => r.public_id);
      await cloudinary.api.delete_resources(publicIds, {
        resource_type: 'auto',
        invalidate: true,
      });
    }
  } catch (error) {
    console.error('[Cloudinary] Error deleting folder:', folder, error);
  }
}
