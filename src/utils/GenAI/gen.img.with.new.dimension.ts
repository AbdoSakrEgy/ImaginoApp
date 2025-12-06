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

export async function genImgWithNewDimensionFn(
  file: MulterFile,
  angle: string | number,
): Promise<Buffer | null> {
  const openai = new OpenAI({
    apiKey: process.env.PAID_GPT_KEY,
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
You are an expert 3D rendering and product photography specialist.

Generate a **photorealistic image** of the same product shown in the input image from the specified angle: **${angle}**.

Requirements:
- Preserve the original product shape, materials, colors, and proportions exactly.
- Maintain realistic lighting, shadows, and reflections.
- Render from the exact requested angle (top, bottom, left, right, top-left, top-right, bottom-left, bottom-right, or any custom angle).
- Keep the background clean and professional (studio-style, plain background).
- Ensure e-commerce quality: high-resolution, sharp, well-lit, realistic.
- Do NOT alter, add, or remove any part of the product.
- Output a photorealistic image that shows the product clearly from the requested perspective.
`;

    console.log("Generating image from angle:", angle);
    console.log("Using GPT-Image-1 model...");

    const response = await openai.images.edit({
      model: "gpt-image-1",
      // Pass the buffer directly with explicit MIME type
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

    console.log("Image generated successfully from angle:", angle);
    return buffer;
  } catch (error) {
    console.error("Error generating image with new dimension:", error);
    throw error;
  }
}
