import { fal } from "@fal-ai/client";

/**
 * تحويل صورة إلى كارتون باستخدام Fal AI
 * @param base64Image الصورة كـ base64 بدون data URI prefix
 * @returns الصورة الناتجة كـ base64
 */
export async function convertWithFalAI(base64Image: string): Promise<string> {
  const FAL_AI_KEY = process.env.FAL_AI_KEY as string;
  if (!FAL_AI_KEY) throw new Error("Missing FAL_AI_KEY");

  // إعداد المفتاح عند استدعاء الدالة
  fal.config({ credentials: FAL_AI_KEY });

  // اشترك في الموديل
  const result = await fal.subscribe("fal-ai/cartoonify", {
    input: {
      image_url: `data:image/jpeg;base64,${base64Image}`,
    },
    logs: true,
  });

  // جلب أول صورة ناتجة وتحويلها إلى base64
  if (!result.data?.images?.[0]?.url) {
    throw new Error("Fal AI did not return a valid image URL");
  }

  // نقدر نجيب الصورة من URL كـ buffer ونحولها ل base64
  const resp = await fetch(result.data.images[0].url);
  const arrayBuffer = await resp.arrayBuffer();
  const outputBase64 = Buffer.from(arrayBuffer).toString("base64");

  return outputBase64;
}
