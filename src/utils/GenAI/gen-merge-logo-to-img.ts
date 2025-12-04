import * as fs from "fs";
import sharp from "sharp";

/**
 * Position options for logo placement
 */
export type LogoPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center"
  | "top-center"
  | "bottom-center";

/**
 * Options for merging logo with image
 */
export interface MergeLogoOptions {
  position?: LogoPosition;
  opacity?: number; // 0-100
  logoScale?: number; // Scale factor for logo (0.1 to 1.0)
  padding?: number; // Padding from edges in pixels
}

/**
 * Merge a logo onto a base image using Sharp library
 * This function intelligently positions and scales the logo
 * 
 * @param baseImagePath - Path to the base/background image
 * @param logoImagePath - Path to the logo image to overlay
 * @param options - Optional configuration for logo placement
 * @returns Buffer containing the merged image
 */
export async function genMergeLogoToImgFn(
  baseImagePath: string,
  logoImagePath: string,
  options: MergeLogoOptions = {}
): Promise<Buffer> {
  try {
    // Default options
    const {
      position = "bottom-right",
      opacity = 80,
      logoScale = 0.15, // Logo will be 15% of base image width by default
      padding = 20,
    } = options;

    // Read both images
    const baseImageBuffer = fs.readFileSync(baseImagePath);
    const logoImageBuffer = fs.readFileSync(logoImagePath);

    // Get metadata for both images
    const baseMetadata = await sharp(baseImageBuffer).metadata();
    const logoMetadata = await sharp(logoImageBuffer).metadata();

    const baseWidth = baseMetadata.width || 1000;
    const baseHeight = baseMetadata.height || 1000;
    const logoWidth = logoMetadata.width || 100;
    const logoHeight = logoMetadata.height || 100;

    // Calculate new logo dimensions (maintain aspect ratio)
    const targetLogoWidth = Math.floor(baseWidth * logoScale);
    const logoAspectRatio = logoHeight / logoWidth;
    const targetLogoHeight = Math.floor(targetLogoWidth * logoAspectRatio);

    // Resize and prepare logo with opacity
    const processedLogo = await sharp(logoImageBuffer)
      .resize(targetLogoWidth, targetLogoHeight, {
        kernel: sharp.kernel.lanczos3,
        fit: "contain",
      })
      .png() // Convert to PNG to support transparency
      .toBuffer();

    // Apply opacity to logo
    const logoWithOpacity = await sharp(processedLogo)
      .composite([
        {
          input: Buffer.from([255, 255, 255, Math.floor((opacity / 100) * 255)]),
          raw: {
            width: 1,
            height: 1,
            channels: 4,
          },
          tile: true,
          blend: "dest-in",
        },
      ])
      .toBuffer();

    // Calculate position coordinates
    let left = 0;
    let top = 0;

    switch (position) {
      case "top-left":
        left = padding;
        top = padding;
        break;
      case "top-right":
        left = baseWidth - targetLogoWidth - padding;
        top = padding;
        break;
      case "bottom-left":
        left = padding;
        top = baseHeight - targetLogoHeight - padding;
        break;
      case "bottom-right":
        left = baseWidth - targetLogoWidth - padding;
        top = baseHeight - targetLogoHeight - padding;
        break;
      case "center":
        left = Math.floor((baseWidth - targetLogoWidth) / 2);
        top = Math.floor((baseHeight - targetLogoHeight) / 2);
        break;
      case "top-center":
        left = Math.floor((baseWidth - targetLogoWidth) / 2);
        top = padding;
        break;
      case "bottom-center":
        left = Math.floor((baseWidth - targetLogoWidth) / 2);
        top = baseHeight - targetLogoHeight - padding;
        break;
    }

    // Merge logo onto base image
    const mergedBuffer = await sharp(baseImageBuffer)
      .composite([
        {
          input: logoWithOpacity,
          top: top,
          left: left,
          blend: "over",
        },
      ])
      .png({
        quality: 100,
        compressionLevel: 6,
      })
      .toBuffer();

    return mergedBuffer;
  } catch (error: any) {
    console.error("❌ Error in genMergeLogoToImgFn:", error);
    throw new Error(`Failed to merge logo to image: ${error.message}`);
  }
}