import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import Replicate from "replicate";
import sharp from "sharp";

interface GeneratedProductView {
  image: string; // base64
  viewType: "front" | "back" | "left" | "right" | "top" | "angle";
  description: string;
  confidence: number;
}

/**
 * Generate multi-angle product views using Zero123++
 * via Replicate API
 */
export async function genImgWithNewDimensionFn(
  filePath: string
): Promise<GeneratedProductView[]> {
  try {
    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

    if (!REPLICATE_API_TOKEN) {
      throw new Error(
        "REPLICATE_API_TOKEN not found. Get free API key from https://replicate.com"
      );
    }

    const replicate = new Replicate({
      auth: REPLICATE_API_TOKEN,
    });

    console.log("🚀 Starting multi-view generation from image...");

    // Read image
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString("base64");
    const mimeType = getMimeType(filePath);
    const dataUri = `data:${mimeType};base64,${base64Image}`;

    // Direct generation using Zero123++
    return await generateWithZero123PlusPlus(
      dataUri,
      replicate,
      base64Image
    );

  } catch (error: any) {
    console.error("❌ Error in genImgWithNewDimensionFn:", error);
    throw error;
  }
}

/**
 * Generate novel views using Zero123++
 * Model: jd7h/zero123plusplus
 * Output: 3x2 grid of images
 * Row 1: 30, 90, 150 azimuth
 * Row 2: 210, 270, 330 azimuth
 */
async function generateWithZero123PlusPlus(
  imageDataUri: string,
  replicate: Replicate,
  originalBase64: string
): Promise<GeneratedProductView[]> {
  try {
    // Run Zero123++
    const output = await replicate.run(
      "jd7h/zero123plusplus:d1cf158204642058694033c7f126284693998822080a229c15849893d5641776", // Using specific version to be safe
      {
        input: {
          image: imageDataUri,
          target_ratio: "1:1", // Ensure square output if possible, though model output is fixed
        },
      }
    );

    console.log("Zero123++ output:", output);

    let imageUrl: string | null = null;
    if (typeof output === "string") {
      imageUrl = output;
    } else if (Array.isArray(output) && output.length > 0) {
      imageUrl = output[0];
    } else if (typeof output === "object" && output !== null && "url" in (output as any)) {
        imageUrl = (output as any).url;
    }

    if (!imageUrl) {
        throw new Error("No output URL received from Replicate");
    }

    // Download the grid image
    const gridBuffer = await downloadFile(imageUrl);
    
    // Process the grid using sharp
    // The output is a 3x2 grid. We need to split it.
    // Assuming the output image is 960x640 (320x320 per tile) or similar aspect ratio.
    // We will get metadata to determine dimensions.
    
    const image = sharp(gridBuffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
        throw new Error("Could not get image metadata");
    }

    const tileWidth = Math.floor(metadata.width / 3);
    const tileHeight = Math.floor(metadata.height / 2);

    console.log(`Processing grid: ${metadata.width}x${metadata.height}, Tile: ${tileWidth}x${tileHeight}`);

    // Define the grid mapping
    // Row 1: 30 (Front-Right), 90 (Right), 150 (Back-Right)
    // Row 2: 210 (Back-Left), 270 (Left), 330 (Front-Left)
    
    // We need to map these to: "front", "back", "left", "right", "top", "angle"
    // Mapping:
    // "front" -> 330 (Row 2, Col 3) - Front-Left
    // "right" -> 90 (Row 1, Col 2)
    // "back" -> 210 (Row 2, Col 1) - Back-Left
    // "left" -> 270 (Row 2, Col 2)
    // "angle" -> 30 (Row 1, Col 1) - Front-Right
    // "top" -> 150 (Row 1, Col 3) - Back-Right (Proxy for top as we don't have a top view)

    const viewsToExtract = [
        { name: "angle", r: 0, c: 0, desc: "Angle view (30°)" },
        { name: "right", r: 0, c: 1, desc: "Right view (90°)" },
        { name: "top",   r: 0, c: 2, desc: "Back-Right view (150°) - Proxy for Top" }, // Imperfect mapping
        { name: "back",  r: 1, c: 0, desc: "Back view (210°)" },
        { name: "left",  r: 1, c: 1, desc: "Left view (270°)" },
        { name: "front", r: 1, c: 2, desc: "Front view (330°)" },
    ];

    const generatedViews: GeneratedProductView[] = [];

    for (const view of viewsToExtract) {
        const left = view.c * tileWidth;
        const top = view.r * tileHeight;

        const tileBuffer = await image
            .clone()
            .extract({ left, top, width: tileWidth, height: tileHeight })
            .toFormat("png")
            .toBuffer();

        generatedViews.push({
            image: tileBuffer.toString("base64"),
            viewType: view.name as any,
            description: view.desc,
            confidence: 0.9,
        });
    }

    return generatedViews;

  } catch (error) {
    console.error("Zero123++ error:", error);
    // Fallback to original if generation fails completely
    // But we prefer to throw if it's a configuration error. 
    // If it's a processing error, maybe fallback? 
    // Let's throw to be transparent as requested.
    throw error;
  }
}

/**
 * Download file from URL
 */
async function downloadFile(url: string): Promise<Buffer> {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(response.data);
}

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
