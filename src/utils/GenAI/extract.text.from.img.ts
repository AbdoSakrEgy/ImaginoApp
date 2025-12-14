import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import * as fs from "fs";

// REMOVED: const genAI = ... (Global initialization is removed)

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

interface TextExtractionResult {
  containsText: boolean;
  extractedText: string | null;
}

export async function extractTextFromImgFn(file: MulterFile): Promise<TextExtractionResult> {
  // We use a try-catch-finally block to ensure the file is deleted
  // regardless of whether the AI succeeds or fails.
  try {
    // --- STEP 0: Initialize AI Instance Here ---
    // This now runs only when the function is called.
    const apiKey = process.env.GEMINI_API_KEY as string;

    // Safety check: specific error if key is missing
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // -------------------------------------------

    // 1. Validate MIME type
    const supportedMimeTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/heic",
      "image/heif",
    ];

    if (!supportedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Unsupported image type: ${file.mimetype}`);
    }

    // 2. Read file
    const fileBuffer = fs.readFileSync(file.path);

    // 3. Configure Model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            containsText: { type: SchemaType.BOOLEAN },
            extractedText: { type: SchemaType.STRING },
          },
          required: ["containsText", "extractedText"],
        },
      },
    });

    // 4. Generate
    const imagePart = {
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType: file.mimetype,
      },
    };

    const prompt = `Analyze this image. Determine if there is any visible text. 
                    If there is text, transcribe it exactly as it appears.`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;

    // 5. Return Data
    return JSON.parse(response.text()) as TextExtractionResult;
  } catch (error) {
    console.error("Error extracting text:", error);
    throw error; // Re-throw the error so your controller knows it failed
  } finally {
    // --- THIS IS WHERE THE CLEANUP GOES ---
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (cleanupError) {
      console.error("Error cleaning up file:", cleanupError);
    }
  }
}
