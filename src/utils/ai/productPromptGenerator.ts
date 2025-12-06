import OpenAI from "openai";

export interface ProductPromptAnalysis {
  prompt: string;
  summary: string;
  negativePrompt?: string;
  backgroundIdeas: string[];
  attributes: string[];
  sizeHint?: string;
  positionHint?: string;
  rawJson?: Record<string, unknown>;
}

interface GenerateProductPromptOptions {
  imageBuffer: Buffer;
  mimeType?: string | undefined;
  metadataText?: string | undefined;
  userPrompt?: string | undefined;
}

const DEFAULT_PRODUCT_PROMPT_MODEL =
  process.env.OPENAI_PRODUCT_PROMPT_MODEL || process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";

export const generateProductPromptFromImage = async (
  options: GenerateProductPromptOptions,
): Promise<ProductPromptAnalysis | null> => {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not set; skipping vision prompt generation");
    return null;
  }

  const { imageBuffer, mimeType = "image/png", metadataText, userPrompt } = options;
  if (!imageBuffer?.length) {
    return null;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const encodedImage = imageBuffer.toString("base64");

  const metadataSnippet = metadataText?.trim()
    ? metadataText.trim().slice(0, 1000)
    : "No additional metadata provided.";

  try {
    const response = await client.chat.completions.create({
      model: DEFAULT_PRODUCT_PROMPT_MODEL,
      temperature: 0.4,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "product_prompt_plan",
          schema: {
            type: "object",
            required: ["background_prompt", "summary"],
            properties: {
              background_prompt: {
                type: "string",
                description:
                  "Positive text prompt for generating a custom background tailored to the detected product. Explicitly call out how large the product should feel in frame, where it should sit relative to the scene (e.g., 'hero scale centered in lower third'), and describe the deliberately empty staging pocket where the real product will be composited so no other hero object sits there.",
              },
              summary: {
                type: "string",
                description: "One paragraph describing the product, styling cues, and positioning.",
              },
              negative_prompt: {
                type: "string",
                description:
                  "Things to avoid in the generated background (unrelated props, clutter, duplicate hero objects, anything occupying the reserved empty space, etc.).",
              },
              background_ideas: {
                type: "array",
                items: { type: "string" },
                description:
                  "List of potential scenes or lighting setups that match the product context.",
              },
              product_attributes: {
                type: "array",
                items: { type: "string" },
                description:
                  "Bullet-level descriptors covering material, finish, color, orientation, and function.",
              },
              object_scale_hint: {
                type: "string",
                description:
                  "Describe how large the product appears within the frame (e.g., 'occupies ~60% of width, hero scale').",
              },
              object_position_hint: {
                type: "string",
                description:
                  "Describe the object's position relative to the frame (e.g., 'anchored bottom-right, tilted slightly left').",
              },
            },
            additionalProperties: true,
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You are a senior e-commerce art director. Analyze transparent product cutouts and craft highly descriptive, concise prompts for photorealistic background generation that preserve a clear empty pocket where the product belongs.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Study this isolated product image and return JSON with:",
                "1) background_prompt: A vivid positive prompt describing composition, props, lighting, materials, camera cues, and the empty staging pocket meant for the product.",
                "2) summary: Sentence summary of the product, its features, and pose.",
                "3) negative_prompt: Optional comma-separated list of things to suppress.",
                "4) background_ideas: Optional list of short scene titles.",
                "5) product_attributes: Optional bullet descriptors.",
                "6) object_scale_hint: Describe the relative size coverage (use percentages of frame, synonyms like 'occupies most of frame').",
                "7) object_position_hint: Describe where the product sits (centered, lower third, tilted, etc.).",
                "8) Ensure the background_prompt itself ends with a clause that reinforces the required product scale and placement.",
                "9) Describe the open staging zone that must stay unobstructed for the real product; avoid adding placeholder products in that area.",
                "Existing metadata:",
                metadataSnippet,
                userPrompt?.trim()
                  ? `User creative direction to respect: ${userPrompt.trim()}`
                  : "No user creative direction provided.",
              ].join("\n"),
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${encodedImage}`,
              },
            },
          ],
        },
      ],
      max_tokens: 800,
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) {
      return null;
    }

    const parsed = JSON.parse(rawContent);
    return {
      prompt: parsed.background_prompt || parsed.prompt || "",
      summary: parsed.summary || "",
      negativePrompt: parsed.negative_prompt || undefined,
      backgroundIdeas: Array.isArray(parsed.background_ideas) ? parsed.background_ideas : [],
      attributes: Array.isArray(parsed.product_attributes) ? parsed.product_attributes : [],
      sizeHint: parsed.object_scale_hint || parsed.scale_hint || undefined,
      positionHint: parsed.object_position_hint || parsed.position_hint || undefined,
      rawJson: parsed,
    };
  } catch (error) {
    console.warn("generateProductPromptFromImage failed", error);
    return null;
  }
};
