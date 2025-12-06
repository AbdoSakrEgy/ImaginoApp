import { IImage } from "../../types/image.module.types";

export type BackgroundTheme =
  | "vehicle"
  | "beauty"
  | "fashion"
  | "food"
  | "tech"
  | "furniture"
  | "generic";

export type BackgroundPromptSource = "user" | "auto" | "vision-auto" | "user+vision";

const THEME_KEYWORDS: Array<{ theme: BackgroundTheme; keywords: string[] }> = [
  {
    theme: "vehicle",
    keywords: [
      "car",
      "vehicle",
      "automotive",
      "auto",
      "motorcycle",
      "bike",
      "truck",
      "suv",
      "sedan",
      "coupe",
      "roadster",
      "van",
      "convertible",
    ],
  },
  {
    theme: "beauty",
    keywords: [
      "skin",
      "skincare",
      "cosmetic",
      "makeup",
      "beauty",
      "serum",
      "cream",
      "lotion",
      "perfume",
      "fragrance",
    ],
  },
  {
    theme: "fashion",
    keywords: [
      "shoe",
      "sneaker",
      "boot",
      "bag",
      "apparel",
      "jacket",
      "dress",
      "hoodie",
      "fashion",
      "wear",
    ],
  },
  {
    theme: "food",
    keywords: [
      "food",
      "drink",
      "beverage",
      "coffee",
      "tea",
      "snack",
      "dessert",
      "kitchen",
      "plate",
    ],
  },
  {
    theme: "tech",
    keywords: [
      "phone",
      "laptop",
      "tablet",
      "speaker",
      "camera",
      "tech",
      "gadget",
      "console",
      "headphone",
      "monitor",
    ],
  },
  {
    theme: "furniture",
    keywords: ["chair", "sofa", "table", "desk", "lamp", "bed", "stool", "couch", "shelf"],
  },
];

const BACKGROUND_THEME_PROMPTS: Record<
  BackgroundTheme,
  { opening: string; setting: string; details: string }
> = {
  vehicle: {
    opening: "Cinematic automotive hero shot of {descriptor}",
    setting: "positioned on a modern rooftop parking deck with moody skyline bokeh",
    details:
      "wet asphalt reflections, dramatic rim lighting, no people, no signage, leave a clean empty parking bay ready for the hero product",
  },
  beauty: {
    opening: "Premium beauty campaign still of {descriptor}",
    setting: "arranged on marble and glass vanity props with diffused daylight",
    details:
      "soft pastels, floating mist, no other product categories, hyperreal textures, maintain an empty pedestal pocket awaiting the hero product",
  },
  fashion: {
    opening: "Editorial fashion product scene for {descriptor}",
    setting: "styled on sculpted plinths inside a minimal studio with rim-lit gradients",
    details:
      "floating fabric motion, subtle shadow drop, no competing wardrobe, keep a vacant plinth for the foreground piece",
  },
  food: {
    opening: "Gourmet food photography of {descriptor}",
    setting: "placed on rustic tabletop with natural window light and depth-rich props",
    details:
      "steam, crumbs, utensils, no packaged cosmetics or tech, leave a clean plating zone open for the hero dish",
  },
  tech: {
    opening: "Futuristic tech showcase for {descriptor}",
    setting: "on anodized aluminum surface with neon rim lighting and volumetric haze",
    details:
      "floating HUD elements, bokeh particles, no organic skincare items, reserve an empty illuminated pad where the product will sit",
  },
  furniture: {
    opening: "Interior design lifestyle shot of {descriptor}",
    setting: "inside a curated living space with layered lighting and tactile materials",
    details:
      "area rug shadows, architectural light streaks, no unrelated cosmetics, keep a cleared zone on the floor or platform for the hero furnishing",
  },
  generic: {
    opening: "Lifestyle hero scene for {descriptor}",
    setting: "set on a premium stylized stage with cinematic depth",
    details:
      "soft studio lighting, DSLR depth of field, practical props that support the product, maintain a spotless open area awaiting the foreground item",
  },
};

const THEME_NEGATIVE_PROMPTS: Partial<Record<BackgroundTheme, string>> = {
  vehicle: "skincare, cosmetics, perfume, makeup, hands, people, signage, text overlay",
  beauty: "cars, vehicles, engines, asphalt, tires, industrial machinery",
  fashion: "cars, vehicles, crowded streets, skincare jars, phones, laptops",
  food: "cars, people, hands, skincare, laptops, text",
  tech: "cars, food, skin, people, clutter, wrinkles",
  furniture: "cars, food, faces, text overlay, clutter, crowd",
  generic: "logos, text overlay, people, mismatched merchandise, clutter",
};

const detectBackgroundTheme = (image: Partial<IImage>): BackgroundTheme => {
  const textParts: string[] = [];
  if (image.title) textParts.push(image.title);
  if (image.description) textParts.push(image.description);
  if (image.category) textParts.push(image.category);
  if (Array.isArray(image.tags)) textParts.push(...image.tags);
  const normalized = textParts.join(" ").toLowerCase();

  for (const matcher of THEME_KEYWORDS) {
    if (matcher.keywords.some((keyword) => normalized.includes(keyword))) {
      return matcher.theme;
    }
  }

  if (image.category === "product" || image.category === "art" || image.category === "landscape") {
    return "generic";
  }

  return "generic";
};

export const buildBackgroundPrompt = (
  image: Partial<IImage>,
  userPrompt?: string,
): { prompt: string; theme: BackgroundTheme; source: BackgroundPromptSource } => {
  const theme = detectBackgroundTheme(image);
  if (userPrompt && userPrompt.trim()) {
    return { prompt: userPrompt.trim(), theme, source: "user" };
  }

  const descriptorSources: string[] = [];
  if (image.title) descriptorSources.push(image.title);
  if (Array.isArray(image.tags) && image.tags.length) {
    descriptorSources.push(image.tags.slice(0, 3).join(" "));
  }
  if (!descriptorSources.length && image.description) {
    descriptorSources.push(image.description.split(" ").slice(0, 6).join(" "));
  }

  const descriptor = descriptorSources.join(" ").trim() || "product";
  const template = BACKGROUND_THEME_PROMPTS[theme] || BACKGROUND_THEME_PROMPTS.generic;
  const replaceDescriptor = (value: string) => value.replace("{descriptor}", descriptor);
  const prompt = [template.opening, template.setting, template.details]
    .map(replaceDescriptor)
    .filter(Boolean)
    .join(". ");

  return { prompt, theme, source: "auto" };
};

export const buildDefaultNegativePrompt = (theme: BackgroundTheme): string | undefined => {
  return THEME_NEGATIVE_PROMPTS[theme] || THEME_NEGATIVE_PROMPTS.generic;
};

export const calculateProductPlacement = (options: {
  backgroundWidth: number;
  backgroundHeight: number;
  productWidth: number;
  productHeight: number;
  theme: BackgroundTheme;
}): { mode: "center" | "custom"; left: number; top: number } => {
  const { backgroundWidth, backgroundHeight, productWidth, productHeight, theme } = options;
  const marginX = Math.round(backgroundWidth * 0.04);
  const marginY = Math.round(backgroundHeight * 0.06);
  const centerLeft = Math.round((backgroundWidth - productWidth) / 2);
  const centerTop = Math.round((backgroundHeight - productHeight) / 2);
  let left = centerLeft;
  let top = centerTop;
  let mode: "center" | "custom" = "center";

  const productRatio = productWidth / Math.max(productHeight, 1);
  const shouldGroundProduct =
    theme === "vehicle" || theme === "fashion" || theme === "furniture" || theme === "food";

  if (shouldGroundProduct) {
    top = Math.max(marginY, backgroundHeight - productHeight - marginY);
    mode = "custom";
  }

  if (productRatio < 0.9) {
    left = Math.round(backgroundWidth * 0.58 - productWidth / 2);
    mode = "custom";
  } else if (productRatio > 1.4 && theme === "vehicle") {
    left = Math.round(backgroundWidth * 0.5 - productWidth / 2);
    mode = "custom";
  }

  const clamp = (value: number, min: number, max: number) => {
    if (Number.isNaN(value)) return min;
    if (max <= min) return min;
    return Math.min(Math.max(value, min), max);
  };

  left = clamp(left, marginX, backgroundWidth - productWidth - marginX);
  top = clamp(top, marginY, backgroundHeight - productHeight - marginY);

  if (Math.abs(left - centerLeft) < 8 && Math.abs(top - centerTop) < 8) {
    mode = "center";
  }

  return { mode, left, top };
};
