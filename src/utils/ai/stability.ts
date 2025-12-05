import axios from "axios";
import FormData from "form-data";

export interface StabilityBackgroundOptions {
  productImageBuffer: Buffer;
  prompt?: string;
  negativePrompt?: string;
  stylePreset?: string;
  width?: number;
  height?: number;
  seed?: number;
}

interface TextToImageOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
}

const DEFAULT_BACKGROUND_PROMPT =
  "Lifestyle product scene, soft studio lighting, high detail, DSLR depth of field";

const STABILITY_REPLACE_BG_ENDPOINT =
  "https://api.stability.ai/v2beta/stable-image/edit/replace-background";

const STABILITY_TEXT_TO_IMAGE_ENDPOINT =
  "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image";

export const generateBackgroundWithStability = async ({
  productImageBuffer,
  prompt,
  negativePrompt,
  stylePreset,
  width,
  height,
  seed,
}: StabilityBackgroundOptions): Promise<Buffer> => {
  if (!process.env.STABILITY_API_KEY) {
    throw new Error("STABILITY_API_KEY not set in environment");
  }

  if (!productImageBuffer || !productImageBuffer.length) {
    throw new Error("productImageBuffer is required");
  }

  const formData = new FormData();
  formData.append("image", productImageBuffer, {
    filename: "product.png",
    contentType: "image/png",
    knownLength: productImageBuffer.length,
  });

  formData.append("prompt", (prompt && prompt.trim()) || DEFAULT_BACKGROUND_PROMPT);
  formData.append("output_format", "png");

  if (negativePrompt) {
    formData.append("negative_prompt", negativePrompt);
  }
  if (stylePreset) {
    formData.append("style_preset", stylePreset);
  }
  if (width) {
    formData.append("width", String(width));
  }
  if (height) {
    formData.append("height", String(height));
  }
  if (typeof seed === "number" && !Number.isNaN(seed)) {
    formData.append("seed", String(seed));
  }

  try {
    const response = await axios.post(STABILITY_REPLACE_BG_ENDPOINT, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
        Accept: "image/png",
      },
      responseType: "arraybuffer",
      timeout: 60_000,
    });

    return Buffer.from(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.warn(
        "Stability replace-background endpoint unavailable, falling back to text-to-image",
      );
      const fallbackPayload: TextToImageOptions = {
        prompt: (prompt && prompt.trim()) || DEFAULT_BACKGROUND_PROMPT,
      };
      if (negativePrompt && negativePrompt.trim()) {
        fallbackPayload.negativePrompt = negativePrompt.trim();
      }
      if (width) fallbackPayload.width = width;
      if (height) fallbackPayload.height = height;
      if (typeof seed === "number" && !Number.isNaN(seed)) fallbackPayload.seed = seed;

      return await generateBackgroundWithTextToImage(fallbackPayload);
    }
    if (axios.isAxiosError(error)) {
      throw new Error(formatStabilityError("replace-background", error));
    }
    throw error;
  }
};

const generateBackgroundWithTextToImage = async ({
  prompt,
  negativePrompt,
  width,
  height,
  seed,
}: TextToImageOptions): Promise<Buffer> => {
  const payload: Record<string, unknown> = {
    text_prompts: [
      {
        text: prompt,
        weight: 1,
      },
    ],
    cfg_scale: 7,
    steps: 30,
    samples: 1,
  };

  if (negativePrompt) {
    (payload.text_prompts as any[]).push({ text: negativePrompt, weight: -1 });
  }
  if (width) {
    payload.width = width;
  }
  if (height) {
    payload.height = height;
  }
  if (typeof seed === "number" && !Number.isNaN(seed)) {
    payload.seed = seed;
  }

  try {
    const response = await axios.post(STABILITY_TEXT_TO_IMAGE_ENDPOINT, payload, {
      headers: {
        Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 60_000,
    });

    const artifacts = response.data?.artifacts;
    if (!Array.isArray(artifacts) || !artifacts.length || !artifacts[0]?.base64) {
      throw new Error("Stability text-to-image response missing artifacts");
    }

    return Buffer.from(artifacts[0].base64, "base64");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(formatStabilityError("text-to-image", error));
    }
    throw error;
  }
};

const formatStabilityError = (operation: string, error: any) => {
  if (!axios.isAxiosError(error)) return `Stability ${operation} failed: ${error}`;
  const status = error.response?.status ?? "unknown";
  const data = error.response?.data;
  const body = typeof data === "string" ? data : JSON.stringify(data);
  return `Stability ${operation} failed (status ${status}): ${body}`;
};
