import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

/**
 * Enhance image quality using Sharp library
 * This is a FREE, local solution that provides excellent quality enhancement
 * without relying on external paid APIs
 * 
 * @param imagePath - Path to the input image file
 * @returns Buffer containing the enhanced image
 */
export async function genInhancedQualityImgFn(
  imagePath: string
): Promise<Buffer> {
  try {
    // console.log("🚀 Starting image quality enhancement...");

    // Read the input image
    const imageBuffer = fs.readFileSync(imagePath);

    // console.log("� Processing image with Sharp for enhancement...");

    // Get original image metadata
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width || 1000;
    const originalHeight = metadata.height || 1000;

    // Calculate new dimensions (2x upscale)
    const newWidth = originalWidth ;
    const newHeight = originalHeight ;

    // console.log(
    //   `� Upscaling from ${originalWidth}x${originalHeight} to ${newWidth}x${newHeight}`
    // );

    // Enhance the image using Sharp
    const enhancedBuffer = await sharp(imageBuffer)
      // Resize with high-quality Lanczos3 algorithm
      .resize(newWidth, newHeight, {
        kernel: sharp.kernel.lanczos3,
        fit: "fill",
      })
      // Sharpen the image for better clarity
      .sharpen({
        sigma: 2.5,
        m1: 1.5,
        m2: 0.5,
        x1: 3,
        y2: 15,
        y3: 15,
      })
      // Enhance contrast and brightness
      .modulate({
        brightness: 1.10, // Slight brightness boost
        saturation: 1.25, // Slight saturation boost
      })
      // Apply slight gamma correction for better tonal range
      .gamma(1.1)
      // Normalize to improve overall quality
      .normalize()
      // Convert to high-quality PNG
      .png({
        quality: 100,
        compressionLevel: 6,
        adaptiveFiltering: true,
      })
      .toBuffer();

    // console.log(
    //   `✨ Image enhanced successfully! Size: ${enhancedBuffer.length} bytes`
    // );

    return enhancedBuffer;
  } catch (error: any) {
    // console.error("❌ Error in genInhancedQualityImgFn:", error);
    throw error;
  }
}

/**
 * Get MIME type from file extension
 */
function getMimeType(
  filePath: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<
    string,
    "image/jpeg" | "image/png" | "image/gif" | "image/webp"
  > = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return mimeTypes[ext] || "image/jpeg";
}
