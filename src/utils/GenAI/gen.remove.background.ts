import OpenAI from "openai";
import * as fs from "node:fs";

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

export async function genRemoveBackground(file: MulterFile): Promise<Buffer | null> {
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
Remove the background from this image completely.

Requirements:
- Keep the main subject (person, object, or product) intact and perfectly preserved.
- Make the background fully transparent (alpha channel).
- Maintain crisp, clean edges around the subject with no artifacts or halos.
- Preserve all details, colors, textures, and shadows of the subject.
- Do NOT alter, distort, or modify the subject in any way.
- Output a high-quality PNG image with a transparent background.
`;

    console.log("Removing background from image...");
    console.log("Using GPT-Image-1 model...");

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

    console.log("Background removed successfully");
    return buffer;
  } catch (error) {
    console.error("Error removing background:", error);
    throw error;
  }
}
