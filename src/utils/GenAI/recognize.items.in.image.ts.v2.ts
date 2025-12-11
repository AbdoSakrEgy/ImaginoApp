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

// 1. Define the structure for a single item
interface RecognizedItem {
  item_name: string;
  category: string;
  count: number;
  description: string;
}

// 2. Define the structure for the final result
interface ImageRecognitionResult {
  items: RecognizedItem[];
  total_items_detected: number;
}

export async function recognizeItemsInImgFnV2(file: MulterFile): Promise<ImageRecognitionResult> {
  try {
    // --- Initialize OpenAI Instance ---
    const apiKey = process.env.PAID_OpenAI_KEY as string;
    if (!apiKey) {
      throw new Error("PAID_OpenAI_KEY is not defined in environment variables.");
    }
    const openai = new OpenAI({ apiKey });

    // 1. Validate MIME type
    const supportedMimeTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

    if (!supportedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Unsupported image type: ${file.mimetype}`);
    }

    // 2. Read file and encode to base64
    const fileBuffer = fs.readFileSync(file.path);
    const encodedImage = fileBuffer.toString("base64");

    // 3. Call OpenAI GPT-4o-mini with vision capability
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "image_recognition_result",
          schema: {
            type: "object",
            required: ["items", "total_items_detected"],
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  required: ["item_name", "category", "count"],
                  properties: {
                    item_name: {
                      type: "string",
                      description: "The specific name of the item",
                    },
                    category: {
                      type: "string",
                      description: "General category (e.g., Electronics, Furniture, Food)",
                    },
                    count: {
                      type: "integer",
                      description: "How many of this specific item are visible",
                    },
                    description: {
                      type: "string",
                      description: "Brief visual description (color, state, position)",
                    },
                  },
                },
              },
              total_items_detected: {
                type: "integer",
                description: "Total count of all items detected in the image",
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
            "You are an expert image analyst. Analyze images and identify all distinct physical items or objects present. Return structured JSON with the recognition results.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image and identify all distinct physical items or objects present. List them individually with their counts and categories. Ignore background details like walls or floor unless they are the main subject. Return JSON with items array and total_items_detected.",
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
      max_tokens: 1500,
    });

    // 4. Parse and return the response
    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error("No response received from OpenAI");
    }

    return JSON.parse(rawContent) as ImageRecognitionResult;
  } catch (error) {
    console.error("Error recognizing items:", error);
    throw error;
  } finally {
    // --- CLEANUP ---
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (cleanupError) {
      console.error("Error cleaning up file:", cleanupError);
    }
  }
}
