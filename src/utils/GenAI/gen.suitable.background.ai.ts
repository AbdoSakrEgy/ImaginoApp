import axios from "axios";
import sharp from "sharp";

export interface GenSuitableBackgroundAIOptions {
  productImageBuffer: Buffer;
  productMimeType?: string | undefined;
  productDescription?: string | undefined;
  userPrompt?: string | undefined;
  negativePrompt?: string | undefined;
  stylePreset?: string | undefined;
  size?: "1024x1024" | "1536x1024" | "1024x1536" | undefined;
  dominantColors?: string[] | undefined;
  theme?: string | undefined;
}

export interface GenSuitableBackgroundAIResult {
  buffer: Buffer;
  width: number;
  height: number;
  promptUsed: string;
}

/**
 * Convert RGB color to descriptive color name for better AI understanding
 */
function rgbToColorName(rgb: string): string {
  // Extract RGB values from "rgb(R, G, B)" format
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return rgb;

  const r = parseInt(match[1]!, 10);
  const g = parseInt(match[2]!, 10);
  const b = parseInt(match[3]!, 10);

  // Convert to HSL for better color categorization
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const l = (max + min) / 2;

  if (max === min) {
    // Achromatic (gray)
    if (l < 0.2) return "black";
    if (l > 0.8) return "white";
    return "gray";
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === rNorm) {
    h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
  } else if (max === gNorm) {
    h = ((bNorm - rNorm) / d + 2) / 6;
  } else {
    h = ((rNorm - gNorm) / d + 4) / 6;
  }

  const hue = h * 360;

  // Determine lightness prefix
  let prefix = "";
  if (l < 0.3) prefix = "dark ";
  else if (l > 0.7) prefix = "light ";

  // Determine saturation
  if (s < 0.2) {
    if (l < 0.2) return "black";
    if (l > 0.8) return "white";
    return `${prefix}gray`;
  }

  // Determine hue name
  if (hue < 15 || hue >= 345) return `${prefix}red`;
  if (hue < 45) return `${prefix}orange`;
  if (hue < 75) return `${prefix}yellow`;
  if (hue < 150) return `${prefix}green`;
  if (hue < 210) return `${prefix}cyan`;
  if (hue < 270) return `${prefix}blue`;
  if (hue < 315) return `${prefix}purple`;
  return `${prefix}pink`;
}

/**
 * Generate a suitable background image using Pollinations.ai (100% FREE, no API key needed).
 * This creates backgrounds that match the product's colors and aesthetic,
 * producing professional, visually appealing results with harmonious color schemes.
 *
 * @param options - Configuration for background generation
 * @returns Promise<GenSuitableBackgroundAIResult> - The generated background buffer and metadata
 */
export async function genSuitableBackgroundAI(
  options: GenSuitableBackgroundAIOptions,
): Promise<GenSuitableBackgroundAIResult> {
  const {
    productDescription = "product",
    userPrompt,
    negativePrompt,
    stylePreset,
    size = "1024x1024",
    dominantColors = [],
    theme = "modern",
  } = options;

  // Convert RGB colors to descriptive names for better AI understanding
  const colorNames = dominantColors.map(rgbToColorName).filter((c, i, arr) => arr.indexOf(c) === i);
  const primaryColor = colorNames[0] || "neutral";
  const secondaryColor = colorNames[1] || "";

  // Build a strong color-focused prompt
  const colorDescription =
    colorNames.length > 0
      ? `IMPORTANT: Use ${colorNames.slice(0, 3).join(", ")} colors as the main color scheme. The background must feature ${primaryColor} tones${secondaryColor ? ` with ${secondaryColor} accents` : ""}.`
      : "";

  // Build style guidance based on preset
  const styleGuidance = (() => {
    switch (stylePreset?.toLowerCase()) {
      case "studio":
        return "clean professional studio background with soft even lighting and subtle color gradients";
      case "gradient":
        return "smooth beautiful gradient background with harmonious color transitions";
      case "minimal":
        return "minimalist background with clean lines and elegant negative space";
      case "luxury":
        return "luxury premium background with rich textures and sophisticated elegant feel";
      case "nature":
        return "natural organic background with soft botanical hints and earthy atmosphere";
      case "urban":
        return "modern urban background with subtle architectural geometric elements";
      case "neon":
        return "vibrant background with subtle neon glow accents and futuristic feel";
      case "pastel":
        return "soft pastel background with gentle dreamy gradients";
      case "dark":
        return "sophisticated dark moody background with dramatic subtle lighting";
      case "spotlight":
        return "dramatic spotlight background with professional depth lighting";
      default:
        return "modern stylish professional background";
    }
  })();

  // Build theme/product context
  const productContext = (() => {
    const desc = productDescription.toLowerCase();
    if (desc.includes("food") || desc.includes("drink") || desc.includes("coffee"))
      return "suitable for food photography, warm inviting atmosphere";
    if (desc.includes("tech") || desc.includes("phone") || desc.includes("electronic"))
      return "suitable for tech product, sleek modern clean";
    if (desc.includes("beauty") || desc.includes("cosmetic") || desc.includes("skincare"))
      return "suitable for beauty product, elegant soft luxurious";
    if (desc.includes("fashion") || desc.includes("clothing") || desc.includes("shoe"))
      return "suitable for fashion photography, stylish trendy";
    if (desc.includes("furniture") || desc.includes("home") || desc.includes("decor"))
      return "suitable for interior design, cozy sophisticated";
    if (theme && theme !== "modern") return `suitable for ${theme} product photography`;
    return "suitable for professional product photography";
  })();

  // Parse dimensions from size
  const [targetWidth, targetHeight] = size.split("x").map(Number);

  // Craft the comprehensive prompt - COLORS FIRST for emphasis
  const basePrompt = userPrompt?.trim() ? `${userPrompt.trim()}, ` : "";

  const promptText = `${basePrompt}${colorDescription} ${styleGuidance}, ${productContext}, product photography backdrop, ultra high quality 8k, sharp crisp details, smooth elegant textures, professional studio lighting, clean empty background only, no objects no products no text no watermarks, ${primaryColor} color theme`;

  const fullNegativePrompt = negativePrompt?.trim()
    ? `${negativePrompt.trim()}, products, items, objects, text, watermark, logo, people, faces, hands, cluttered, busy, low quality, blurry, noisy`
    : "products, items, objects, text, watermark, logo, people, faces, hands, cluttered, busy, low quality, blurry, noisy, distorted";

  console.log("Generating AI background with Pollinations.ai (FREE)...");
  console.log(`Colors detected: ${colorNames.join(", ") || "none"}`);
  console.log(`Style preset: ${stylePreset || "default"}, Theme: ${theme}`);

  try {
    // URL encode the prompt
    const encodedPrompt = encodeURIComponent(promptText);
    const encodedNegative = encodeURIComponent(fullNegativePrompt);

    // Generate random seed for unique images each request
    const randomSeed = Math.floor(Math.random() * 2147483647);

    // Use Pollinations.ai - completely free, no API key required
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${targetWidth}&height=${targetHeight}&nologo=true&negative_prompt=${encodedNegative}&model=flux&seed=${randomSeed}`;

    console.log("Requesting image from Pollinations.ai with seed:", randomSeed);

    const response = await axios.get(pollinationsUrl, {
      responseType: "arraybuffer",
      timeout: 120000, // 2 minute timeout
      headers: {
        Accept: "image/*",
      },
    });

    // Convert the response to buffer
    const generatedImageBuffer = Buffer.from(response.data);

    // Verify the image is valid
    const metadata = await sharp(generatedImageBuffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error("Generated image has invalid dimensions");
    }

    console.log("AI background generated successfully with matching colors!");
    return {
      buffer: generatedImageBuffer,
      width: metadata.width || targetWidth || 1024,
      height: metadata.height || targetHeight || 1024,
      promptUsed: promptText,
    };
  } catch (error: any) {
    console.error("Error generating AI background:", error);

    if (error?.code === "ECONNABORTED" || error?.message?.includes("timeout")) {
      throw new Error("Image generation timed out. Please try again.");
    }

    throw error;
  }
}

/**
 * Helper function to extract dominant colors from an image using sharp
 * This can be used to provide color hints to the AI for better color matching
 */
export async function extractDominantColors(
  imageBuffer: Buffer,
  topN: number = 5,
): Promise<string[]> {
  try {
    // Resize to small size for faster color analysis
    const { data } = await sharp(imageBuffer)
      .resize(100, 100, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels: { r: number; g: number; b: number }[] = [];
    for (let i = 0; i < data.length - 2; i += 3) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r !== undefined && g !== undefined && b !== undefined) {
        pixels.push({ r, g, b });
      }
    }

    // Simple color quantization using frequency counting
    const colorBuckets: Map<string, number> = new Map();

    for (const pixel of pixels) {
      // Quantize to reduce color space (bucket colors into 32 levels each)
      const qR = Math.floor(pixel.r / 32) * 32;
      const qG = Math.floor(pixel.g / 32) * 32;
      const qB = Math.floor(pixel.b / 32) * 32;

      const key = `rgb(${qR}, ${qG}, ${qB})`;
      colorBuckets.set(key, (colorBuckets.get(key) || 0) + 1);
    }

    // Sort by frequency and get top colors
    const sortedColors = Array.from(colorBuckets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([color]) => color);

    return sortedColors;
  } catch (error) {
    console.warn("Could not extract dominant colors:", error);
    return [];
  }
}
