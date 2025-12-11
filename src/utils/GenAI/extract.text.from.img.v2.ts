import OpenAI from "openai";
import * as fs from "fs";

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

export async function extractTextFromImgFnV2(file: MulterFile): Promise<TextExtractionResult> {
  // We use a try-catch-finally block to ensure the file is deleted
  // regardless of whether the AI succeeds or fails.
  try {
    // --- STEP 0: Initialize OpenAI Instance ---
    const apiKey = process.env.PAID_OpenAI_KEY as string;

    // Safety check: specific error if key is missing
    if (!apiKey) {
      throw new Error("PAID_OpenAI_KEY is not defined in environment variables.");
    }

    const openai = new OpenAI({ apiKey });
    // -------------------------------------------

    // 1. Validate MIME type
    const supportedMimeTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

    if (!supportedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Unsupported image type: ${file.mimetype}`);
    }

    // 2. Read file and encode to base64
    const fileBuffer = fs.readFileSync(file.path);
    const encodedImage = fileBuffer.toString("base64");

    // 3. Call OpenAI GPT-4o with vision capability
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "text_extraction_result",
          schema: {
            type: "object",
            required: ["containsText", "extractedText"],
            properties: {
              containsText: {
                type: "boolean",
                description: "Whether the image contains any visible text",
              },
              extractedText: {
                type: ["string", "null"],
                description: "The extracted text from the image, or null if no text is found",
              },
            },
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You are an OCR expert. Analyze images and extract any visible text accurately. Return structured JSON with the extraction results.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image. Determine if there is any visible text. If there is text, transcribe it exactly as it appears. Return JSON with containsText (boolean) and extractedText (string or null).",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${file.mimetype};base64,${encodedImage}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    // 4. Parse and return the response
    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error("No response received from OpenAI");
    }

    return JSON.parse(rawContent) as TextExtractionResult;
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
