import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';

const bucket = getStorage().bucket();

export async function uploadImageFromUrl(
  imageUrl: string,
  uid: string
): Promise<string> {
  try {
    // Fetch image from URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const fileName = `crop-images/${uid}/${uuidv4()}.jpg`;
    const file = bucket.file(fileName);

    await file.save(imageBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=3600',
      },
    });

    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  } catch (error) {
    console.error('Image upload error:', error);
    throw error;
  }
}

export async function uploadBase64Image(
  base64Data: string,
  uid: string,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const extension = mimeType.split('/')[1] || 'jpg';
    const fileName = `crop-images/${uid}/${uuidv4()}.${extension}`;
    const file = bucket.file(fileName);

    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
        cacheControl: 'public, max-age=3600',
      },
    });

    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  } catch (error) {
    console.error('Base64 image upload error:', error);
    throw error;
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await bucket.file(filePath).delete();
  } catch (error) {
    console.error('File deletion error:', error);
    // Don't throw error for deletion failures
  }
}

// Legacy compatibility
export const storageService = {
  async uploadFile(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
    try {
      const file = bucket.file(`uploads/${fileName}`);

      await file.save(buffer, {
        metadata: {
          contentType,
        },
      });

      await file.makePublic();
      return `https://storage.googleapis.com/${bucket.name}/uploads/${fileName}`;
    } catch (error) {
      console.error('Storage Upload Error:', error);
      throw new Error('Failed to upload file');
    }
  },

  async deleteFile(fileName: string): Promise<void> {
    try {
      const file = bucket.file(`uploads/${fileName}`);
      await file.delete();
    } catch (error) {
      console.error('Storage Delete Error:', error);
      throw new Error('Failed to delete file');
    }
  },

  async getSignedUrl(fileName: string, expirationTime: number = 3600000): Promise<string> {
    try {
      const file = bucket.file(`uploads/${fileName}`);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expirationTime,
      });
      return url;
    } catch (error) {
      console.error('Signed URL Error:', error);
      throw new Error('Failed to generate signed URL');
    }
  },
};
