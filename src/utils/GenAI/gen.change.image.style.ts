import OpenAI from "openai";
import fs from "fs";

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
}

export async function genChangeImageStyleFn(file: MulterFile, style: string): Promise<Buffer | null> {
  const openai = new OpenAI({
    apiKey: process.env.PAID_OpenAI_KEY,
  });

  try {
    // Validate MIME type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      throw new Error(
        `Unsupported image type: ${file.mimetype}. Supported formats: JPEG, PNG, WebP`,
      );
    }

    const fileBuffer = fs.readFileSync(file.path);
    const promptText = `
Transform this image into the "${style}" artistic style.

Requirements:
- Apply the "${style}" style to the entire image while preserving the main subject and composition
- Maintain the original subject matter and key elements
- Create a cohesive artistic interpretation in the specified style
- Ensure high quality output with proper colors and details for the chosen style
- The result should clearly reflect the "${style}" aesthetic

Style Guidelines for "${style}":
- If cartoon/anime: Use bold outlines, vibrant colors, simplified features
- If oil painting: Add visible brushstrokes, rich textures, classic artistic feel
- If watercolor: Soft edges, flowing colors, transparent washes
- If sketch/pencil: Detailed line work, shading, hand-drawn appearance
- If pop art: Bold colors, halftone dots, comic-style treatment
- If cyberpunk: Neon colors, futuristic elements, high contrast
- If vintage/retro: Muted colors, grain, nostalgic feel
- If minimalist: Clean lines, reduced details, essential elements only
- For other styles: Apply the most recognizable characteristics of that artistic movement
`;

    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: new File([fileBuffer], file.originalname, { type: file.mimetype }),
      prompt: promptText,
      size: "1024x1024",
      n: 1,
    });

    if (!response.data?.[0]?.b64_json) {
      console.warn("No image received from GPT-Image-1");
      return null;
    }

    const base64Image = response.data[0].b64_json;
    const buffer = Buffer.from(base64Image, "base64");

    console.log(`Image style changed successfully to: ${style}`);
    return buffer;
  } catch (error) {
    console.error("Error changing image style:", error);
    throw error;
  }
}
