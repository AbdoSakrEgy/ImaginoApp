import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
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

export async function recognizeItemsInImgFn(file: MulterFile): Promise<ImageRecognitionResult> {
  try {
    // --- Initialize AI Instance ---
    const apiKey = process.env.GEMINI_API_KEY as string;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }
    const genAI = new GoogleGenerativeAI(apiKey);

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

    // 3. Configure Model with Item Recognition Schema
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            // We define an array of items
            items: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  item_name: {
                    type: SchemaType.STRING,
                    description: "The specific name of the item",
                  },
                  category: {
                    type: SchemaType.STRING,
                    description: "General category (e.g., Electronics, Furniture, Food)",
                  },
                  count: {
                    type: SchemaType.INTEGER,
                    description: "How many of this specific item are visible",
                  },
                  description: {
                    type: SchemaType.STRING,
                    description: "Brief visual description (color, state, position)",
                  },
                },
                required: ["item_name", "category", "count"],
              },
            },
            total_items_detected: { type: SchemaType.INTEGER },
          },
          required: ["items", "total_items_detected"],
        },
      },
    });

    // 4. Prepare Payload
    const imagePart = {
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType: file.mimetype,
      },
    };

    // 5. Prompt for Object Detection
    const prompt = `Analyze this image and identify all distinct physical items or objects present. 
                    List them individually with their counts and categories. 
                    Ignore background details like walls or floor unless they are the main subject.`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;

    // 6. Return Data
    return JSON.parse(response.text()) as ImageRecognitionResult;
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
