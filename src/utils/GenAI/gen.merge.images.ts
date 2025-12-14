import OpenAI from "openai";

export interface MergeImagesOptions {
  productImageBuffer: Buffer;
  backgroundImageBuffer: Buffer;
  productMimeType?: string;
  backgroundMimeType?: string;
  productDescription?: string;
  backgroundDescription?: string;
  placementHint?: "center" | "bottom" | "natural" | string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
}

export interface MergeImagesResult {
  buffer: Buffer;
  width: number;
  height: number;
}

/**
 * Merge a product image onto a background image using OpenAI's GPT-Image-1 model.
 * This produces a high-quality, professional composite where the product is
 * naturally integrated into the background scene with proper lighting,
 * shadows, and perspective adjustments.
 *
 * @param options - Configuration for the merge operation
 * @returns Promise<MergeImagesResult> - The merged image buffer and dimensions
 */
export async function genMergeImagesFn(options: MergeImagesOptions): Promise<MergeImagesResult> {
  const {
    productImageBuffer,
    backgroundImageBuffer,
    productMimeType = "image/png",
    backgroundMimeType = "image/png",
    productDescription = "product",
    backgroundDescription = "background",
    placementHint = "natural",
    size = "1024x1024",
  } = options;

  const openai = new OpenAI({
    apiKey: process.env.PAID_OpenAI_KEY,
  });

  if (!process.env.PAID_OpenAI_KEY) {
    throw new Error("PAID_OpenAI_KEY is not defined in environment variables.");
  }

  // Validate buffers
  if (!productImageBuffer || productImageBuffer.length === 0) {
    throw new Error("Product image buffer is required and cannot be empty.");
  }

  if (!backgroundImageBuffer || backgroundImageBuffer.length === 0) {
    throw new Error("Background image buffer is required and cannot be empty.");
  }

  // Validate MIME types
  const supportedMimeTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (!supportedMimeTypes.includes(productMimeType)) {
    throw new Error(
      `Unsupported product image type: ${productMimeType}. Supported: PNG, JPEG, WebP`,
    );
  }
  if (!supportedMimeTypes.includes(backgroundMimeType)) {
    throw new Error(
      `Unsupported background image type: ${backgroundMimeType}. Supported: PNG, JPEG, WebP`,
    );
  }

  // Build placement guidance
  const placementGuidance = (() => {
    switch (placementHint) {
      case "center":
        return "Position the product in the center of the background.";
      case "bottom":
        return "Position the product at the bottom-center of the background, as if placed on a surface.";
      case "natural":
      default:
        return "Position the product naturally in the scene, as if it belongs there, respecting perspective and scale.";
    }
  })();

  // Craft a detailed prompt for high-quality merging
  const promptText = `
You are an expert product photographer and digital compositor.

TASK: Seamlessly merge the provided product image onto the background image to create a professional, realistic composite.

PRODUCT CONTEXT: ${productDescription}
BACKGROUND CONTEXT: ${backgroundDescription}

REQUIREMENTS:
1. PLACEMENT: ${placementGuidance}
2. SCALE: Resize the product proportionally so it looks natural and fits the scene appropriately.
3. LIGHTING: Adjust the product's lighting to match the background's ambient light, shadows, and color temperature.
4. SHADOWS: Add realistic shadows and reflections where the product meets surfaces.
5. PERSPECTIVE: Ensure the product's perspective matches the background scene.
6. EDGES: Create seamless, natural edges with no visible cutout artifacts or halos.
7. QUALITY: Maintain the highest possible image quality for both product and background.
8. INTEGRATION: The final result should look like a single, cohesive photograph taken in a studio.

OUTPUT: A high-quality professional product photograph with the product naturally integrated into the scene.
`.trim();

  console.log("Merging images with AI (GPT-Image-1)...");
  console.log(`Placement hint: ${placementHint}, Size: ${size}`);

  try {
    // Convert buffers to Uint8Array for proper File constructor compatibility
    const productArrayBuffer = new Uint8Array(productImageBuffer);
    const backgroundArrayBuffer = new Uint8Array(backgroundImageBuffer);

    // Create File objects for the API
    const productFile = new File(
      [productArrayBuffer],
      `product.${productMimeType.split("/")[1] || "png"}`,
      { type: productMimeType },
    );

    const backgroundFile = new File(
      [backgroundArrayBuffer],
      `background.${backgroundMimeType.split("/")[1] || "png"}`,
      { type: backgroundMimeType },
    );

    // Use OpenAI's images.edit endpoint with multiple images
    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: [productFile, backgroundFile],
      prompt: promptText,
      size: size,
      n: 1,
    });

    if (!response.data?.[0]?.b64_json) {
      console.warn("No image received from GPT-Image-1");
      throw new Error("AI merge failed: No image data returned from OpenAI");
    }

    const base64Image = response.data[0].b64_json;
    const buffer = Buffer.from(base64Image, "base64");

    // Parse dimensions from size string
    const [width, height] = size.split("x").map(Number);

    console.log("Images merged successfully with AI");
    return {
      buffer,
      width: width || 1024,
      height: height || 1024,
    };
  } catch (error: any) {
    console.error("Error merging images with AI:", error);

    // Provide more context for common errors
    if (error?.code === "invalid_api_key") {
      throw new Error("Invalid OpenAI API key. Please check your PAID_OpenAI_KEY.");
    }

    if (error?.code === "billing_hard_limit_reached") {
      throw new Error("OpenAI API billing limit reached. Please check your account.");
    }

    throw error;
  }
}

/**
 * Alternative merge function using a single composite prompt
 * This can be used when you want more control over the composition
 */
export async function genMergeImagesWithPromptFn(
  productImageBuffer: Buffer,
  backgroundImageBuffer: Buffer,
  customPrompt: string,
  size: "1024x1024" | "1536x1024" | "1024x1536" = "1024x1024",
): Promise<Buffer> {
  const openai = new OpenAI({
    apiKey: process.env.PAID_OpenAI_KEY,
  });

  if (!process.env.PAID_OpenAI_KEY) {
    throw new Error("PAID_OpenAI_KEY is not defined in environment variables.");
  }

  // Convert buffers to Uint8Array for proper File constructor compatibility
  const productArrayBuffer = new Uint8Array(productImageBuffer);
  const backgroundArrayBuffer = new Uint8Array(backgroundImageBuffer);

  const productFile = new File([productArrayBuffer], "product.png", {
    type: "image/png",
  });

  const backgroundFile = new File([backgroundArrayBuffer], "background.png", {
    type: "image/png",
  });

  console.log("Merging images with custom prompt via AI...");

  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: [productFile, backgroundFile],
    prompt: customPrompt,
    size: size,
    n: 1,
  });

  if (!response.data?.[0]?.b64_json) {
    throw new Error("AI merge failed: No image data returned from OpenAI");
  }

  return Buffer.from(response.data[0].b64_json, "base64");
}
