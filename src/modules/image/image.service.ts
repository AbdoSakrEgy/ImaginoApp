import sharp from "sharp";
import axios from "axios";
import os from "os";
import * as fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { IImage } from "./../../types/image.module.types";
import { ImageModel } from "./image.model";
import { successHandler } from "../../utils/successHandler";
import { NextFunction, Request, Response } from "express";
import { ApplicationException } from "../../utils/Errors";
import { IImageServices } from "../../types/image.module.types";
import { genImgWithNewDimensionFn } from "../../utils/GenAI/gen.img.with.new.dimension";
import { genInhancedQualityImgFn } from "../../utils/GenAI/gen.inhanced.quality.img";
import { genMergeLogoToImgFn } from "../../utils/GenAI/gen-merge-logo-to-img";
import { paginationFunction } from "../../utils/pagination";
import { destroySingleFile, uploadSingleFile } from "../../utils/cloudinary/cloudinary.service";
import {
  generateBackgroundWithStability,
  StabilityBackgroundOptions,
} from "../../utils/ai/stability";
import { extractTextFromImgFn } from "../../utils/GenAI/extract.text.from.img";
import { recognizeItemsInImgFn } from "../../utils/GenAI/recognize.items.in.image";
import {
  BackgroundPromptSource,
  BackgroundTheme,
  buildBackgroundPrompt,
  buildDefaultNegativePrompt,
  calculateProductPlacement,
} from "./background.helpers";
import { generateProductPromptFromImage } from "../../utils/ai/productPromptGenerator";
import { uploadBufferFile } from "../../utils/cloudinary/cloudinaryBuffer.service";
import { convertWithFalAI } from "../../utils/ai/convertWithFalAi";
import { genRemoveBackground } from "../../utils/GenAI/gen.remove.background";
import { genChangeImageStyleFn } from "../../utils/GenAI/gen.change.image.style";
import { removeBackgroundFromImageBase64 } from "../../utils/ai/removeBackground";
import { extractTextFromImgFnV2 } from "../../utils/GenAI/extract.text.from.img.v2";
import { recognizeItemsInImgFnV2 } from "../../utils/GenAI/recognize.items.in.image.ts.v2";
import { genMergeImagesFn } from "../../utils/GenAI/gen.merge.images";
import {
  genSuitableBackgroundAI,
  extractDominantColors,
} from "../../utils/GenAI/gen.suitable.background.ai";

type NegativePromptSource = "user" | "vision" | "auto";

interface PrepareBackgroundContextOptions {
  existingImage: IImage;
  prompt?: string;
  negativePrompt?: string;
  widthValue?: unknown;
  heightValue?: unknown;
  seedValue?: unknown;
}

interface PreparedBackgroundContext {
  resolvedPrompt: string;
  resolvedNegativePrompt?: string;
  promptSourceType: BackgroundPromptSource;
  negativePromptSource?: NegativePromptSource;
  derivedTheme: BackgroundTheme;
  sourceBuffer: Buffer;
  sourceMetadata: sharp.Metadata;
  stabilityWidth: number;
  stabilityHeight: number;
  parsedSeed?: number;
  metadataSummary: string;
  visionSummary?: string;
  visionAttributes?: string[];
  visionBackgroundIdeas?: string[];
  visionSizeHint?: string;
  visionPositionHint?: string;
}

export class ImageServices implements IImageServices {
  private imageModel = ImageModel;

  constructor() {}

  // ============================ Utility functions for the service ============================
  private parseBooleanFlag(value: unknown, defaultValue: boolean): boolean {
    if (typeof value === "undefined" || value === null) return defaultValue;
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) return this.parseBooleanFlag(value[0], defaultValue);
    const normalized = String(value).trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
    return defaultValue;
  }

  private serializeImageDoc(image: any) {
    if (!image) return null;
    const obj = typeof image.toObject === "function" ? image.toObject() : image;
    return {
      _id: obj._id,
      user: obj.user,
      parentId: obj.parentId,
      children: obj.children,
      isOriginal: obj.isOriginal,
      version: obj.version,
      url: obj.url,
      thumbnailUrl: obj.thumbnailUrl,
      storageKey: obj.storageKey,
      filename: obj.filename,
      originalFilename: obj.originalFilename,
      mimeType: obj.mimeType,
      size: obj.size,
      dimensions: obj.dimensions,
      aiEdits: obj.aiEdits,
      status: obj.status,
      tags: obj.tags,
      title: obj.title,
      description: obj.description,
      category: obj.category,
      isPublic: obj.isPublic,
      views: obj.views,
      downloads: obj.downloads,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    } as Partial<IImage> & { _id: mongoose.Types.ObjectId };
  }

  private resolveWritableTmpRoot(): string {
    const explicit =
      process.env.IMAGINO_TMP_DIR || process.env.TMPDIR || process.env.TEMP || process.env.TMP;
    if (explicit) {
      return path.isAbsolute(explicit) ? explicit : path.join(process.cwd(), explicit);
    }

    if (process.env.VERCEL) {
      return path.join("/tmp", "imagino");
    }

    return path.join(os.tmpdir(), "imagino");
  }

  ensureTmpDirectory(subdir: string): string {
    const baseDir = this.resolveWritableTmpRoot();
    const fullPath = subdir ? path.join(baseDir, subdir) : baseDir;

    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    return fullPath;
  }

  private async downloadImageAsBuffer(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(response.data);
  }

  private async prepareBackgroundGenerationContext(
    options: PrepareBackgroundContextOptions,
  ): Promise<PreparedBackgroundContext> {
    const { existingImage, prompt, negativePrompt, widthValue, heightValue, seedValue } = options;

    const promptSourceImage =
      typeof (existingImage as any).toObject === "function"
        ? ((existingImage as any).toObject() as Partial<IImage>)
        : (existingImage as unknown as Partial<IImage>) || {};

    const fallbackPromptPlan = buildBackgroundPrompt(promptSourceImage, prompt);
    let resolvedPrompt = fallbackPromptPlan.prompt;
    const derivedTheme: BackgroundTheme = fallbackPromptPlan.theme;
    let promptSourceType: BackgroundPromptSource = fallbackPromptPlan.source;

    let resolvedNegativePrompt =
      negativePrompt && negativePrompt.trim()
        ? negativePrompt.trim()
        : buildDefaultNegativePrompt(derivedTheme);

    const sourceBuffer = await this.downloadImageAsBuffer(existingImage.url);
    const sourceMetadata = await sharp(sourceBuffer).metadata();

    const metadataSummaryParts: string[] = [];
    if (existingImage.title) metadataSummaryParts.push(`Title: ${existingImage.title}`);
    if (existingImage.description)
      metadataSummaryParts.push(`Description: ${existingImage.description}`);
    if (existingImage.category) metadataSummaryParts.push(`Category: ${existingImage.category}`);
    if (Array.isArray(existingImage.tags) && existingImage.tags.length) {
      metadataSummaryParts.push(`Tags: ${existingImage.tags.slice(0, 8).join(", ")}`);
    }
    metadataSummaryParts.push(
      `Theme guess: ${derivedTheme} | Dimensions: ${sourceMetadata.width || "?"}x${sourceMetadata.height || "?"}`,
    );
    const metadataSummary = metadataSummaryParts.join(" | ");

    const productAnalysis = await generateProductPromptFromImage({
      imageBuffer: sourceBuffer,
      mimeType: existingImage.mimeType,
      metadataText: metadataSummary,
      userPrompt: prompt,
    });

    const emptyStagingRequirement =
      "Reserve a clean, unobstructed staging pocket that matches the product's perspective and lighting; never place placeholder hero objects or text in that space.";

    let visionSummary: string | undefined;
    let visionAttributes: string[] | undefined;
    let visionBackgroundIdeas: string[] | undefined;
    let visionSizeHint: string | undefined;
    let visionPositionHint: string | undefined;
    let negativePromptSource: NegativePromptSource | undefined =
      negativePrompt && negativePrompt.trim()
        ? "user"
        : resolvedNegativePrompt
          ? "auto"
          : undefined;
    let appendedEmptyPocketClause = false;

    if (productAnalysis) {
      const combinedPromptParts: string[] = [];
      if (prompt && prompt.trim()) combinedPromptParts.push(prompt.trim());
      if (productAnalysis.prompt && productAnalysis.prompt.trim()) {
        combinedPromptParts.push(productAnalysis.prompt.trim());
      }
      if (!combinedPromptParts.length && resolvedPrompt) {
        combinedPromptParts.push(resolvedPrompt);
      }
      const combinedPrompt = combinedPromptParts.join("\n\n").trim();
      if (combinedPrompt) {
        resolvedPrompt = combinedPrompt;
        promptSourceType = prompt && prompt.trim() ? "user+vision" : "vision-auto";
      }

      if (!negativePrompt || !negativePrompt.trim()) {
        const visionNegative = productAnalysis.negativePrompt?.trim();
        if (visionNegative) {
          resolvedNegativePrompt = visionNegative;
          negativePromptSource = "vision";
        } else if (!resolvedNegativePrompt) {
          resolvedNegativePrompt = buildDefaultNegativePrompt(derivedTheme);
          negativePromptSource = resolvedNegativePrompt ? "auto" : undefined;
        }
      }

      visionSummary = productAnalysis.summary?.trim() || undefined;
      visionAttributes = Array.isArray(productAnalysis.attributes)
        ? productAnalysis.attributes.filter((attr) => typeof attr === "string" && attr.trim())
        : undefined;
      if (visionAttributes) {
        visionAttributes = visionAttributes.map((attr) => attr.trim());
      }
      visionBackgroundIdeas = Array.isArray(productAnalysis.backgroundIdeas)
        ? productAnalysis.backgroundIdeas.filter((idea) => typeof idea === "string" && idea.trim())
        : undefined;
      if (visionBackgroundIdeas) {
        visionBackgroundIdeas = visionBackgroundIdeas.map((idea) => idea.trim());
      }

      visionSizeHint = productAnalysis.sizeHint?.trim() || undefined;
      visionPositionHint = productAnalysis.positionHint?.trim() || undefined;

      const placementGuidanceParts: string[] = [emptyStagingRequirement];
      if (visionSizeHint) placementGuidanceParts.push(`Product scale guidance: ${visionSizeHint}`);
      if (visionPositionHint)
        placementGuidanceParts.push(`Product placement guidance: ${visionPositionHint}`);

      if (
        placementGuidanceParts.length &&
        !/foreground placement guidance:/i.test(resolvedPrompt)
      ) {
        resolvedPrompt = `${resolvedPrompt}\n\nForeground placement guidance: ${placementGuidanceParts.join(
          " | ",
        )}. Align props, camera perspective, and horizon lines so the product feels naturally integrated.`;
        appendedEmptyPocketClause = true;
      }

      if (!negativePromptSource) {
        negativePromptSource = negativePrompt && negativePrompt.trim() ? "user" : undefined;
      }
    }

    if (!appendedEmptyPocketClause && !/product staging requirement:/i.test(resolvedPrompt)) {
      resolvedPrompt = `${resolvedPrompt}\n\nProduct staging requirement: ${emptyStagingRequirement}`;
    }

    if (!negativePromptSource) {
      negativePromptSource =
        negativePrompt && negativePrompt.trim()
          ? "user"
          : productAnalysis?.negativePrompt
            ? "vision"
            : resolvedNegativePrompt
              ? "auto"
              : undefined;
    }

    const parseDimension = (value: unknown, fallback: number) => {
      if (typeof value === "undefined" || value === null || value === "") {
        return fallback;
      }
      const parsed = Number(value);
      if (Number.isNaN(parsed) || parsed <= 0) {
        throw new ApplicationException("width/height must be positive numbers", 400);
      }
      return parsed;
    };

    const allowedTextToImageDimensions = [
      { width: 1024, height: 1024 },
      { width: 1152, height: 896 },
      { width: 1216, height: 832 },
      { width: 1344, height: 768 },
      { width: 1536, height: 640 },
      { width: 640, height: 1536 },
      { width: 768, height: 1344 },
      { width: 832, height: 1216 },
      { width: 896, height: 1152 },
    ];

    const normalizeForStability = (width: number, height: number) => {
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        return { width: 1024, height: 1024 };
      }

      const requestedRatio = width / height;
      if (!allowedTextToImageDimensions.length) {
        return { width: 1024, height: 1024 };
      }

      let best: { width: number; height: number } = { width: 1024, height: 1024 };
      let bestScore = Number.POSITIVE_INFINITY;

      for (const option of allowedTextToImageDimensions) {
        const optionRatio = option.width / option.height;
        const ratioDiff = Math.abs(optionRatio - requestedRatio);
        const widthDiff = Math.abs(option.width - width) / option.width;
        const heightDiff = Math.abs(option.height - height) / option.height;
        const orientationPenalty =
          requestedRatio > 1 && option.width < option.height
            ? 0.25
            : requestedRatio < 1 && option.width > option.height
              ? 0.25
              : 0;
        const score = ratioDiff * 2 + widthDiff + heightDiff + orientationPenalty;

        if (score < bestScore) {
          bestScore = score;
          best = option;
        }
      }

      return best;
    };

    const fallbackWidth = sourceMetadata.width || 1024;
    const fallbackHeight = sourceMetadata.height || fallbackWidth || 1024;
    const targetWidth = parseDimension(widthValue, fallbackWidth);
    const targetHeight = parseDimension(heightValue, fallbackHeight);
    const { width: stabilityWidth, height: stabilityHeight } = normalizeForStability(
      targetWidth,
      targetHeight,
    );

    const numericSeed =
      typeof seedValue !== "undefined" && seedValue !== "" ? Number(seedValue) : undefined;
    const parsedSeed =
      typeof numericSeed === "number" && !Number.isNaN(numericSeed) ? numericSeed : undefined;

    const context: PreparedBackgroundContext = {
      resolvedPrompt,
      promptSourceType,
      derivedTheme,
      sourceBuffer,
      sourceMetadata,
      stabilityWidth,
      stabilityHeight,
      metadataSummary,
    };

    if (typeof resolvedNegativePrompt !== "undefined") {
      context.resolvedNegativePrompt = resolvedNegativePrompt;
    }
    if (typeof negativePromptSource !== "undefined") {
      context.negativePromptSource = negativePromptSource;
    }
    if (typeof parsedSeed !== "undefined") {
      context.parsedSeed = parsedSeed;
    }
    if (visionSummary) {
      context.visionSummary = visionSummary;
    }
    if (visionAttributes?.length) {
      context.visionAttributes = visionAttributes;
    }
    if (visionBackgroundIdeas?.length) {
      context.visionBackgroundIdeas = visionBackgroundIdeas;
    }
    if (visionSizeHint) {
      context.visionSizeHint = visionSizeHint;
    }
    if (visionPositionHint) {
      context.visionPositionHint = visionPositionHint;
    }

    return context;
  }

  // ============================ get Single Image ============================
  getImage = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const userId = res.locals.user?._id?.toString();
    if (!userId) {
      throw new ApplicationException("User not authenticated", 401);
    }

    const imageId =
      (req.params as Record<string, string | undefined>).imageId ||
      (req.query.imageId as string | undefined) ||
      (req.body?.imageId as string | undefined);

    if (!imageId) {
      throw new ApplicationException("imageId is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(imageId)) {
      throw new ApplicationException("Invalid image ID", 400);
    }

    const includeParent = this.parseBooleanFlag(req.query.includeParent, true);
    const includeChildren = this.parseBooleanFlag(req.query.includeChildren, true);
    const includeHistory = this.parseBooleanFlag(req.query.includeHistory, false);

    const baseQuery = {
      _id: new mongoose.Types.ObjectId(imageId),
      user: new mongoose.Types.ObjectId(userId),
      deletedAt: null,
    };

    let imageQuery = this.imageModel.findOneAndUpdate(
      baseQuery,
      { $inc: { views: 1 } },
      { new: true },
    );

    if (includeChildren) {
      imageQuery = imageQuery.populate({
        path: "children",
        match: { deletedAt: null },
        select:
          "user url thumbnailUrl storageKey filename originalFilename mimeType size dimensions tags title description category isPublic status version isOriginal aiEdits views downloads createdAt updatedAt parentId",
        options: { sort: { createdAt: -1 } },
      });
    }

    if (includeParent) {
      imageQuery = imageQuery.populate({
        path: "parentId",
        select:
          "user url thumbnailUrl storageKey filename originalFilename mimeType size dimensions tags title description category isPublic status version isOriginal aiEdits views downloads createdAt updatedAt parentId",
      });
    }

    const imageDoc: any = await imageQuery;

    if (!imageDoc) {
      throw new ApplicationException("Image not found", 404);
    }

    const result: Record<string, unknown> = {
      image: this.serializeImageDoc(imageDoc),
    };

    if (
      includeParent &&
      imageDoc.parentId &&
      typeof imageDoc.parentId === "object" &&
      "_id" in imageDoc.parentId
    ) {
      result.parent = this.serializeImageDoc(imageDoc.parentId);
    }

    if (includeChildren && Array.isArray(imageDoc.children)) {
      result.children = imageDoc.children
        .filter((child: any) => child && typeof child === "object")
        .map((child: any) => this.serializeImageDoc(child));
    }

    if (includeHistory && typeof imageDoc.getAllVersions === "function") {
      const historyDocs = await imageDoc.getAllVersions();
      result.history = historyDocs.map((doc: any) => this.serializeImageDoc(doc));
    }

    return successHandler({
      res,
      message: "Image fetched successfully",
      result,
    });
  };
  // ============================ getImage ============================
  gitImage = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const user = res.locals.user;
    const { imageId } = req.params;
    const image = await this.imageModel.findById(imageId);
    return successHandler({ res, result: { image } });
  };

  // ============================ listBackgroundsForImage ============================
  listBackgroundsForImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const userId = res.locals.user?._id?.toString();
    if (!userId) {
      throw new ApplicationException("User not authenticated", 401);
    }

    const imageId = (req.params as Record<string, string | undefined>).imageId;
    if (!imageId || !mongoose.Types.ObjectId.isValid(imageId)) {
      throw new ApplicationException("Valid imageId is required", 400);
    }

    const parentImage = await this.imageModel.findOne({
      _id: new mongoose.Types.ObjectId(imageId),
      user: new mongoose.Types.ObjectId(userId),
      deletedAt: null,
    });

    if (!parentImage) {
      throw new ApplicationException("Image not found", 404);
    }

    const rawPage = Number(req.query.page ?? 1);
    const rawSize = Number(req.query.size ?? 20);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const size = Number.isFinite(rawSize) && rawSize > 0 ? Math.min(rawSize, 100) : 20;

    const { limit, skip } = paginationFunction({ page, size });

    const baseQuery = {
      parentId: parentImage._id,
      user: new mongoose.Types.ObjectId(userId),
      deletedAt: null as null,
      isBackgroundOnly: true,
    };

    const [backgroundDocs, totalCount] = await Promise.all([
      this.imageModel.find(baseQuery).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.imageModel.countDocuments(baseQuery),
    ]);

    const backgrounds = backgroundDocs.map((doc) => this.serializeImageDoc(doc));

    return successHandler({
      res,
      message: "Backgrounds fetched successfully",
      result: {
        parentImage: this.serializeImageDoc(parentImage),
        backgrounds,
        totalCount,
        page,
        size,
      },
    });
  };

  // ============================ generateSuitableBackground ============================
  generateSuitableBackground = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const user = res.locals.user;
    if (!user?._id) {
      throw new ApplicationException("User not authenticated", 401);
    }

    const bodyPayload = req.body || {};
    const imageId = (bodyPayload.imageId as string | undefined) || (req.params as any)?.imageId;
    const prompt = bodyPayload.prompt as string | undefined;
    const negativePrompt = bodyPayload.negativePrompt as string | undefined;
    const stylePreset = bodyPayload.stylePreset as string | undefined;
    const seedValue = bodyPayload.seed;
    const widthValue = bodyPayload.width;
    const heightValue = bodyPayload.height;

    if (!imageId || !mongoose.Types.ObjectId.isValid(imageId)) {
      throw new ApplicationException("Valid imageId is required", 400);
    }

    const existingImage = await this.imageModel.findOne({
      _id: new mongoose.Types.ObjectId(imageId),
      user: new mongoose.Types.ObjectId(user._id),
      deletedAt: null,
    });

    if (!existingImage) {
      throw new ApplicationException("Image not found", 404);
    }

    const prepareOptions: PrepareBackgroundContextOptions = {
      existingImage,
      widthValue,
      heightValue,
      seedValue,
    };
    if (typeof prompt !== "undefined") {
      prepareOptions.prompt = prompt;
    }
    if (typeof negativePrompt !== "undefined") {
      prepareOptions.negativePrompt = negativePrompt;
    }

    const {
      resolvedPrompt,
      resolvedNegativePrompt,
      promptSourceType,
      negativePromptSource,
      derivedTheme,
      sourceBuffer,
      stabilityWidth,
      stabilityHeight,
      parsedSeed,
      metadataSummary,
      visionSummary,
      visionAttributes,
      visionBackgroundIdeas,
      visionSizeHint,
      visionPositionHint,
    } = await this.prepareBackgroundGenerationContext(prepareOptions);

    const aiStartTime = Date.now();

    // Extract dominant colors from product for AI color matching
    const dominantColors = await extractDominantColors(sourceBuffer, 5);
    console.log("Extracted dominant colors for background generation:", dominantColors);

    // Determine optimal output size for OpenAI (must be 1024x1024, 1536x1024, or 1024x1536)
    const aiOutputSize: "1024x1024" | "1536x1024" | "1024x1536" = (() => {
      const aspectRatio = stabilityWidth / stabilityHeight;
      if (aspectRatio > 1.3) return "1536x1024"; // landscape
      if (aspectRatio < 0.77) return "1024x1536"; // portrait
      return "1024x1024"; // square-ish
    })();

    // Generate AI background with color harmony
    console.log("Generating AI background with matching colors and cool aesthetic...");
    const aiResult = await genSuitableBackgroundAI({
      productImageBuffer: sourceBuffer,
      productMimeType: existingImage.mimeType || "image/png",
      productDescription:
        metadataSummary || existingImage.title || existingImage.description || "product",
      userPrompt: resolvedPrompt,
      negativePrompt: resolvedNegativePrompt,
      stylePreset: stylePreset?.trim() || undefined,
      size: aiOutputSize,
      dominantColors,
      theme: derivedTheme,
    });

    const backgroundBuffer = aiResult.buffer;

    const projectFolder = process.env.PROJECT_FOLDER || "DefaultProjectFolder";
    const { public_id, secure_url } = await uploadBufferFile({
      fileBuffer: backgroundBuffer,
      storagePathOnCloudinary: `${projectFolder}/${user._id}/suitable-backgrounds`,
    });

    const tagSet = new Set<string>([
      "genSuitableBackground",
      "huggingface-bg",
      "sdxl",
      "color-harmony",
      "background-only",
      derivedTheme,
    ]);
    if (stylePreset && stylePreset.trim()) {
      tagSet.add(stylePreset.trim());
    }
    switch (promptSourceType) {
      case "user":
        tagSet.add("custom-prompt");
        break;
      case "user+vision":
        tagSet.add("vision-assisted");
        break;
      case "vision-auto":
        tagSet.add("vision-prompt");
        break;
      default:
        tagSet.add("auto-prompt");
    }
    if (visionAttributes?.length) {
      visionAttributes.slice(0, 4).forEach((attr) => {
        const slug = attr
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        if (slug) tagSet.add(slug);
      });
    }
    if (visionSizeHint || visionPositionHint) {
      tagSet.add("placement-aware");
    }

    const placementNotes: string[] = [];
    if (visionPositionHint) placementNotes.push(`Position: ${visionPositionHint}`);
    if (visionSizeHint) placementNotes.push(`Scale: ${visionSizeHint}`);

    let backgroundDescription =
      visionSummary ||
      (prompt && prompt.trim()) ||
      `AI generated ${derivedTheme} background concept via Stability AI.`;
    if (placementNotes.length) {
      backgroundDescription = `${backgroundDescription} Placement cues: ${placementNotes.join(
        " | ",
      )}.`;
    }

    const backgroundImage = await this.imageModel.create({
      user: user._id,
      url: secure_url,
      storageKey: public_id,
      filename: `${existingImage.filename || "image"}-bg-${Date.now()}.png`,
      originalFilename: `${existingImage.originalFilename || existingImage.filename}-bg-only.png`,
      mimeType: "image/png",
      size: backgroundBuffer.length,
      parentId: existingImage._id,
      children: [],
      isOriginal: false,
      isBackgroundOnly: true,
      version: (existingImage.version || 1) + 1,
      aiEdits: [
        {
          operation: "text-to-image" as const,
          provider: "custom" as const,
          ...(resolvedPrompt ? { prompt: resolvedPrompt } : {}),
          parameters: {
            ...(stylePreset && stylePreset.trim() ? { stylePreset: stylePreset.trim() } : {}),
            width: aiResult.width,
            height: aiResult.height,
            outputSize: aiOutputSize,
            aiModel: "stable-diffusion-xl-base-1.0",
            aiProvider: "huggingface",
            ...(resolvedNegativePrompt ? { negativePrompt: resolvedNegativePrompt } : {}),
            promptSource: promptSourceType,
            ...(negativePromptSource ? { negativePromptSource } : {}),
            theme: derivedTheme,
            metadataSummary,
            backgroundOnly: true,
            colorHarmony: true,
            dominantColorsUsed: dominantColors,
            ...(visionSummary ? { visionSummary } : {}),
            ...(visionAttributes?.length ? { visionAttributes } : {}),
            ...(visionBackgroundIdeas?.length ? { visionBackgroundIdeas } : {}),
            ...(visionSizeHint ? { visionSizeHint } : {}),
            ...(visionPositionHint ? { visionPositionHint } : {}),
          },
          timestamp: new Date(),
          processingTime: Date.now() - aiStartTime,
        },
      ],
      status: "completed" as const,
      tags: Array.from(tagSet),
      title: existingImage.title
        ? `${existingImage.title} - background concept`
        : `${existingImage.filename}-background`,
      description: backgroundDescription,
      category: existingImage.category || "product",
      isPublic: false,
      views: 0,
      downloads: 0,
      dimensions: {
        width: aiResult.width,
        height: aiResult.height,
      },
    });

    return successHandler({
      res,
      message: "Background generated successfully",
      result: {
        sourceImage: this.serializeImageDoc(existingImage),
        backgroundImage: this.serializeImageDoc(backgroundImage),
      },
    });
  };

  // ============================ blurImageRegion ============================
  blurImageRegion = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const user = res.locals.user;
    if (!user?._id) {
      throw new ApplicationException("User not authenticated", 401);
    }

    const file = req.file as Express.Multer.File | undefined;
    const body = req.body || {};

    const imageId = body.imageId as string | undefined;
    const requireImageId = !file;

    if (requireImageId && (!imageId || !mongoose.Types.ObjectId.isValid(imageId))) {
      throw new ApplicationException("Provide a valid imageId or upload an image", 400);
    }

    const parseNumber = (value: unknown, field: string) => {
      if (typeof value === "undefined" || value === null || value === "") {
        throw new ApplicationException(`${field} is required`, 400);
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new ApplicationException(`${field} must be a finite number`, 400);
      }
      return parsed;
    };

    const regionLeft = Math.round(parseNumber(body.x, "x"));
    const regionTop = Math.round(parseNumber(body.y, "y"));
    const regionWidth = Math.round(parseNumber(body.width, "width"));
    const regionHeight = Math.round(parseNumber(body.height, "height"));
    const blurRadiusInput = body.blurRadius;
    const blurRadius = (() => {
      if (
        typeof blurRadiusInput === "undefined" ||
        blurRadiusInput === null ||
        blurRadiusInput === ""
      ) {
        return 25;
      }
      const parsed = Number(blurRadiusInput);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new ApplicationException("blurRadius must be a positive number", 400);
      }
      return Math.min(Math.max(parsed, 1), 200);
    })();

    let parentImage: IImage | null = null;
    let sourceBuffer: Buffer;
    let sourceMimeType: string | undefined;
    let sourceFilename: string | undefined;
    let sourceOriginalFilename: string | undefined;

    if (file) {
      sourceBuffer = fs.readFileSync(file.path);
      const originalMetadata = await sharp(sourceBuffer).metadata();

      const { public_id, secure_url } = await uploadSingleFile({
        fileLocation: file.path,
        storagePathOnCloudinary: `ImaginoApp/blurImageRegion/${user._id}/originals`,
      });

      parentImage = await this.imageModel.create({
        user: user._id,
        url: secure_url,
        storageKey: public_id,
        filename: file.filename,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        dimensions: {
          width: originalMetadata.width || 0,
          height: originalMetadata.height || 0,
        },
        children: [],
        isOriginal: true,
        version: 1,
        aiEdits: [],
        status: "completed" as const,
        tags: ["blur-region", "original"],
        title: file.originalname,
        description: "Original upload for blur operation",
        category: "other" as const,
        isPublic: false,
        views: 0,
        downloads: 0,
      });

      sourceMimeType = file.mimetype;
      sourceFilename = file.filename;
      sourceOriginalFilename = file.originalname;
    } else {
      parentImage = await this.imageModel.findOne({
        _id: new mongoose.Types.ObjectId(imageId as string),
        user: new mongoose.Types.ObjectId(user._id),
        deletedAt: null,
      });

      if (!parentImage) {
        throw new ApplicationException("Image not found", 404);
      }

      sourceBuffer = await this.downloadImageAsBuffer(parentImage.url);
      sourceMimeType = parentImage.mimeType;
      sourceFilename = parentImage.filename;
      sourceOriginalFilename = parentImage.originalFilename || parentImage.filename;
    }

    const metadata = await sharp(sourceBuffer).metadata();
    const imageWidth = metadata.width || 0;
    const imageHeight = metadata.height || 0;

    if (!imageWidth || !imageHeight) {
      throw new ApplicationException("Unable to determine image dimensions", 500);
    }

    if (regionWidth <= 0 || regionHeight <= 0) {
      throw new ApplicationException("width and height must be positive", 400);
    }

    if (regionLeft < 0 || regionTop < 0) {
      throw new ApplicationException("x and y must be non-negative", 400);
    }

    if (regionLeft + regionWidth > imageWidth || regionTop + regionHeight > imageHeight) {
      throw new ApplicationException("Requested blur region exceeds image bounds", 400);
    }

    const blurOperationStart = Date.now();

    const blurredSourceBuffer = await sharp(sourceBuffer).blur(blurRadius).toBuffer();
    const blurredRegionBuffer = await sharp(blurredSourceBuffer)
      .extract({ left: regionLeft, top: regionTop, width: regionWidth, height: regionHeight })
      .toBuffer();

    const composite = sharp(sourceBuffer).composite([
      { input: blurredRegionBuffer, left: regionLeft, top: regionTop },
    ]);

    type SupportedCompositeFormat = "jpeg" | "png" | "webp" | "avif";

    const targetFormat: SupportedCompositeFormat = (() => {
      const normalized = (metadata.format || "png").toLowerCase();
      if (["jpeg", "jpg"].includes(normalized)) return "jpeg" as const;
      if (normalized === "webp") return "webp" as const;
      if (normalized === "avif") return "avif" as const;
      return "png" as const;
    })();

    let formattedPipeline: sharp.Sharp;
    switch (targetFormat) {
      case "jpeg":
        formattedPipeline = composite.jpeg({ quality: 95 });
        break;
      case "webp":
        formattedPipeline = composite.webp({ quality: 95 });
        break;
      case "avif":
        formattedPipeline = composite.avif({ quality: 80 });
        break;
      default:
        formattedPipeline = composite.png();
    }

    const blurredCompositeBuffer = await formattedPipeline.toBuffer();

    const formatDetails: Record<SupportedCompositeFormat, { mime: string; extension: string }> = {
      jpeg: { mime: "image/jpeg", extension: "jpg" },
      png: { mime: "image/png", extension: "png" },
      webp: { mime: "image/webp", extension: "webp" },
      avif: { mime: "image/avif", extension: "avif" },
    };

    const outputDetails = formatDetails[targetFormat];
    const parsedName = path.parse(sourceOriginalFilename || sourceFilename || "image");
    const blurredFilename = `${parsedName.name || "image"}-blur-${Date.now()}.${outputDetails.extension}`;

    const projectFolder = process.env.PROJECT_FOLDER || "DefaultProjectFolder";
    const { public_id: blurredPublicId, secure_url: blurredSecureUrl } = await uploadBufferFile({
      fileBuffer: blurredCompositeBuffer,
      storagePathOnCloudinary: `${projectFolder}/${user._id}/blurred-regions`,
    });

    const blurredImage = await this.imageModel.create({
      user: user._id,
      url: blurredSecureUrl,
      storageKey: blurredPublicId,
      filename: blurredFilename,
      originalFilename: `${parsedName.name || "image"}-blurred.${outputDetails.extension}`,
      mimeType: outputDetails.mime,
      size: blurredCompositeBuffer.length,
      parentId: parentImage?._id || null,
      children: [],
      isOriginal: false,
      version: parentImage ? (parentImage.version || 1) + 1 : 1,
      aiEdits: [
        {
          operation: "custom" as const,
          provider: "custom" as const,
          prompt: "Apply localized blur",
          parameters: {
            blurRegion: {
              x: regionLeft,
              y: regionTop,
              width: regionWidth,
              height: regionHeight,
            },
            blurRadius,
            sourceImageId: parentImage?._id,
          },
          timestamp: new Date(),
          processingTime: Date.now() - blurOperationStart,
        },
      ],
      status: "completed" as const,
      tags: ["blur-region", "localized-blur"],
      title: parentImage?.title
        ? `${parentImage.title} - blurred`
        : `${parsedName.name || "image"} - blurred region`,
      description: `Blurred region ${regionWidth}x${regionHeight} at (${regionLeft}, ${regionTop})`,
      category: parentImage?.category || "other",
      isPublic: false,
      views: 0,
      downloads: 0,
      dimensions: {
        width: imageWidth,
        height: imageHeight,
      },
    });

    if (parentImage?._id) {
      await this.imageModel.findByIdAndUpdate(parentImage._id, {
        $addToSet: { children: blurredImage._id },
      });
    }

    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return successHandler({
      res,
      message: "Image blurred successfully",
      result: {
        originalImage: parentImage ? this.serializeImageDoc(parentImage) : null,
        blurredImage: this.serializeImageDoc(blurredImage),
      },
    });
  };

  // ============================ genImgWithSelectedBackground ============================
  genImgWithSelectedBackground = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const user = res.locals.user;
    if (!user?._id) {
      throw new ApplicationException("User not authenticated", 401);
    }

    const bodyPayload = req.body || {};
    const productImageId = bodyPayload.productImageId as string | undefined;
    const backgroundImageId = bodyPayload.backgroundImageId as string | undefined;
    const backgroundFile = req.file as Express.Multer.File | undefined;

    if (!productImageId || !mongoose.Types.ObjectId.isValid(productImageId)) {
      throw new ApplicationException("Valid productImageId is required", 400);
    }

    if (!backgroundImageId && !backgroundFile) {
      throw new ApplicationException(
        "Provide backgroundImageId or upload a backgroundImage file",
        400,
      );
    }

    if (backgroundImageId && !mongoose.Types.ObjectId.isValid(backgroundImageId)) {
      throw new ApplicationException("Invalid backgroundImageId", 400);
    }

    const userObjectId = new mongoose.Types.ObjectId(user._id);

    const transparentImage = await this.imageModel.findOne({
      _id: new mongoose.Types.ObjectId(productImageId),
      deletedAt: null,
    });

    if (!transparentImage) {
      throw new ApplicationException("Transparent product image not found", 404);
    }

    const composeStartTime = Date.now();
    const productBuffer = await this.downloadImageAsBuffer(transparentImage.url);
    const productMetadata = await sharp(productBuffer).metadata();

    let backgroundBuffer: Buffer;
    let backgroundImageDoc: IImage | null = null;

    if (backgroundImageId) {
      backgroundImageDoc = await this.imageModel.findOne({
        _id: new mongoose.Types.ObjectId(backgroundImageId),
        deletedAt: null,
      });

      if (!backgroundImageDoc) {
        throw new ApplicationException("Background image not found", 404);
      }

      backgroundBuffer = await this.downloadImageAsBuffer(backgroundImageDoc.url);
    } else if (backgroundFile?.path) {
      backgroundBuffer = fs.readFileSync(backgroundFile.path);
    } else {
      throw new ApplicationException("Unable to resolve background image", 400);
    }

    const backgroundMetadata = await sharp(backgroundBuffer).metadata();
    const backgroundWidth = backgroundMetadata.width || productMetadata.width || 1024;
    const backgroundHeight = backgroundMetadata.height || productMetadata.height || 1024;

    const promptSeed =
      typeof (transparentImage as any).toObject === "function"
        ? ((transparentImage as any).toObject() as Partial<IImage>)
        : (transparentImage as unknown as Partial<IImage>);
    const { theme: derivedTheme } = buildBackgroundPrompt(promptSeed);

    // Determine optimal output size for OpenAI (must be 1024x1024, 1536x1024, or 1024x1536)
    const aiOutputSize: "1024x1024" | "1536x1024" | "1024x1536" = (() => {
      const aspectRatio = backgroundWidth / backgroundHeight;
      if (aspectRatio > 1.3) return "1536x1024"; // landscape
      if (aspectRatio < 0.77) return "1024x1536"; // portrait
      return "1024x1024"; // square-ish
    })();

    // Build descriptions for AI context
    const productDescription =
      transparentImage.description || transparentImage.title || "transparent product image";
    const bgDescription =
      backgroundImageDoc?.description || backgroundImageDoc?.title || "background scene";

    // Use AI to merge images with proper lighting, shadows, and perspective
    console.log("Merging images with AI for high-quality composite...");
    const mergeResult = await genMergeImagesFn({
      productImageBuffer: productBuffer,
      backgroundImageBuffer: backgroundBuffer,
      productMimeType: transparentImage.mimeType || "image/png",
      backgroundMimeType: backgroundImageDoc?.mimeType || "image/png",
      productDescription,
      backgroundDescription: bgDescription,
      placementHint: ["furniture", "fashion", "food", "vehicle"].includes(derivedTheme)
        ? "bottom"
        : "natural",
      size: aiOutputSize,
    });

    const compositedBuffer = mergeResult.buffer;
    const outputWidth = mergeResult.width;
    const outputHeight = mergeResult.height;

    if (backgroundFile?.path && fs.existsSync(backgroundFile.path)) {
      fs.unlinkSync(backgroundFile.path);
    }

    const projectFolder = process.env.PROJECT_FOLDER || "DefaultProjectFolder";
    const { public_id, secure_url } = await uploadBufferFile({
      fileBuffer: compositedBuffer,
      storagePathOnCloudinary: `${projectFolder}/${user._id}/selected-backgrounds`,
    });

    const tagSet = new Set<string>([
      "genImgWithSelectedBackground",
      derivedTheme,
      "ai-merged",
      "openai-composite",
    ]);

    if (backgroundImageDoc?.tags?.length) {
      backgroundImageDoc.tags.slice(0, 3).forEach((tag) => tagSet.add(tag));
    }

    const generatedImage = await this.imageModel.create({
      user: user._id,
      url: secure_url,
      storageKey: public_id,
      filename: `${transparentImage.filename || "image"}-selected-bg-${Date.now()}.png`,
      originalFilename: `${
        transparentImage.originalFilename || transparentImage.filename
      }-selected-bg.png`,
      mimeType: "image/png",
      size: compositedBuffer.length,
      parentId: transparentImage._id,
      children: [],
      isOriginal: false,
      version: (transparentImage.version || 1) + 1,
      aiEdits: [
        {
          operation: "image-to-image" as const,
          provider: "openai" as const,
          prompt:
            "AI-powered composite: seamlessly merge product onto background with proper lighting, shadows, and perspective",
          parameters: {
            backgroundSource: backgroundImageDoc ? "existing-image" : "uploaded-file",
            ...(backgroundImageDoc ? { backgroundImageId: backgroundImageDoc._id } : {}),
            aiModel: "gpt-image-1",
            outputSize: aiOutputSize,
            theme: derivedTheme,
            productDescription,
            backgroundDescription: bgDescription,
          },
          timestamp: new Date(),
          processingTime: Date.now() - composeStartTime,
        },
      ],
      status: "completed" as const,
      tags: Array.from(tagSet),
      title: transparentImage.title
        ? `${transparentImage.title} - AI merged background`
        : `${transparentImage.filename}-ai-merged-background`,
      description: backgroundImageDoc?.description
        ? `AI composite using background: ${backgroundImageDoc.description}`
        : "AI-powered composite with user-selected background image",
      category: transparentImage.category || "product",
      isPublic: false,
      views: 0,
      downloads: 0,
      dimensions: {
        width: outputWidth,
        height: outputHeight,
      },
    });

    await this.imageModel.findByIdAndUpdate(transparentImage._id, {
      $addToSet: { children: generatedImage._id },
    });

    const resultPayload: Record<string, unknown> = {
      transparentImage: this.serializeImageDoc(transparentImage),
      generatedImage: this.serializeImageDoc(generatedImage),
    };

    if (backgroundImageDoc) {
      resultPayload.backgroundImage = this.serializeImageDoc(backgroundImageDoc);
    }

    return successHandler({
      res,
      message: "Background applied successfully",
      result: resultPayload,
    });
  };

  // ============================ genImgWithNewBackground ============================
  genImgWithNewBackground = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const user = res.locals.user;
    if (!user?._id) {
      throw new ApplicationException("User not authenticated", 401);
    }

    const bodyPayload = req.body || {};
    // const coerceSingle = (value: unknown) => (Array.isArray(value) ? value[0] : value);

    const imageId = bodyPayload.imageId as string | undefined;
    console.log("imageId:", imageId);
    const prompt = bodyPayload.prompt as string | undefined;
    const negativePrompt = bodyPayload.negativePrompt as string | undefined;
    const stylePreset = bodyPayload.stylePreset as string | undefined;
    const seedValue = bodyPayload.seed;
    const widthValue = bodyPayload.width;
    const heightValue = bodyPayload.height;

    if (!imageId || !mongoose.Types.ObjectId.isValid(imageId)) {
      throw new ApplicationException("Valid imageId is required", 400);
    }

    const existingImage = await this.imageModel.findOne({
      _id: new mongoose.Types.ObjectId(imageId),
      user: new mongoose.Types.ObjectId(user._id),
      deletedAt: null,
    });

    if (!existingImage) {
      throw new ApplicationException("Image not found", 404);
    }

    const prepareOptions: PrepareBackgroundContextOptions = {
      existingImage,
      widthValue,
      heightValue,
      seedValue,
    };
    if (typeof prompt !== "undefined") {
      prepareOptions.prompt = prompt;
    }
    if (typeof negativePrompt !== "undefined") {
      prepareOptions.negativePrompt = negativePrompt;
    }

    const {
      resolvedPrompt,
      resolvedNegativePrompt,
      promptSourceType,
      negativePromptSource,
      derivedTheme,
      sourceBuffer,
      sourceMetadata,
      stabilityWidth,
      stabilityHeight,
      parsedSeed,
      metadataSummary,
      visionSummary,
      visionAttributes,
      visionBackgroundIdeas,
      visionSizeHint,
      visionPositionHint,
    } = await this.prepareBackgroundGenerationContext(prepareOptions);

    const stabilityStartTime = Date.now();
    const stabilityOptions: StabilityBackgroundOptions = {
      productImageBuffer: sourceBuffer,
      width: stabilityWidth,
      height: stabilityHeight,
      prompt: resolvedPrompt,
    };

    if (resolvedNegativePrompt) {
      stabilityOptions.negativePrompt = resolvedNegativePrompt;
    }
    if (stylePreset && stylePreset.trim()) {
      stabilityOptions.stylePreset = stylePreset.trim();
    }
    if (typeof parsedSeed !== "undefined") {
      stabilityOptions.seed = parsedSeed;
    }

    const backgroundBuffer = await generateBackgroundWithStability(stabilityOptions);

    const resizedProductBuffer = await sharp(sourceBuffer)
      .resize({
        width: Math.min(stabilityWidth, sourceMetadata.width || stabilityWidth),
        height: Math.min(stabilityHeight, sourceMetadata.height || stabilityHeight),
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const resizedProductMetadata = await sharp(resizedProductBuffer).metadata();

    const productPlacement = calculateProductPlacement({
      backgroundWidth: stabilityWidth,
      backgroundHeight: stabilityHeight,
      productWidth:
        resizedProductMetadata.width ||
        Math.min(stabilityWidth, sourceMetadata.width || stabilityWidth),
      productHeight:
        resizedProductMetadata.height ||
        Math.min(stabilityHeight, sourceMetadata.height || stabilityHeight),
      theme: derivedTheme,
    });

    const overlayOptions: sharp.OverlayOptions =
      productPlacement.mode === "custom"
        ? {
            input: resizedProductBuffer,
            left: productPlacement.left,
            top: productPlacement.top,
          }
        : {
            input: resizedProductBuffer,
            gravity: "center",
          };

    const compositedBuffer = await sharp(backgroundBuffer)
      .resize({ width: stabilityWidth, height: stabilityHeight, fit: "cover" })
      .composite([overlayOptions])
      .png()
      .toBuffer();

    const tmpDir = this.ensureTmpDirectory("new-background");
    const finalFilename = `${existingImage.filename || "image"}-bg-${Date.now()}.png`;
    const tempFilePath = path.join(tmpDir, finalFilename);
    fs.writeFileSync(tempFilePath, compositedBuffer);

    const { public_id, secure_url } = await uploadSingleFile({
      fileLocation: tempFilePath,
      storagePathOnCloudinary: `ImaginoApp/genImgWithNewBackground/${user._id}`,
    });

    const tagSet = new Set<string>(["genImgWithNewBackground", "stability-bg", derivedTheme]);
    if (stylePreset) {
      tagSet.add(stylePreset);
    }
    switch (promptSourceType) {
      case "user":
        tagSet.add("custom-prompt");
        break;
      case "user+vision":
        tagSet.add("vision-assisted");
        break;
      case "vision-auto":
        tagSet.add("vision-prompt");
        break;
      default:
        tagSet.add("auto-prompt");
    }
    if (visionAttributes?.length) {
      visionAttributes.slice(0, 4).forEach((attr) => {
        const slug = attr
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        if (slug) tagSet.add(slug);
      });
    }
    if (visionSizeHint || visionPositionHint) {
      tagSet.add("placement-aware");
    }

    const placementNotes: string[] = [];
    if (visionPositionHint) placementNotes.push(`Position: ${visionPositionHint}`);
    if (visionSizeHint) placementNotes.push(`Scale: ${visionSizeHint}`);

    let generatedDescription =
      visionSummary ||
      (prompt && prompt.trim()) ||
      `AI generated ${derivedTheme} background composed with Stability AI.`;
    if (placementNotes.length) {
      generatedDescription = `${generatedDescription} Placement cues: ${placementNotes.join(" | ")}.`;
    }

    const generatedImage = await this.imageModel.create({
      user: user._id,
      url: secure_url,
      storageKey: public_id,
      filename: finalFilename,
      originalFilename: `${existingImage.originalFilename || existingImage.filename}-bg.png`,
      mimeType: "image/png",
      size: compositedBuffer.length,
      parentId: existingImage._id,
      children: [],
      isOriginal: false,
      version: (existingImage.version || 1) + 1,
      aiEdits: [
        {
          operation: "image-to-image" as const,
          provider: "stability-ai" as const,
          ...(resolvedPrompt ? { prompt: resolvedPrompt } : {}),
          parameters: {
            ...(stylePreset && stylePreset.trim() ? { stylePreset: stylePreset.trim() } : {}),
            width: stabilityWidth,
            height: stabilityHeight,
            ...(typeof parsedSeed !== "undefined" ? { seed: parsedSeed } : {}),
            ...(resolvedNegativePrompt ? { negativePrompt: resolvedNegativePrompt } : {}),
            promptSource: promptSourceType,
            ...(negativePromptSource ? { negativePromptSource } : {}),
            theme: derivedTheme,
            placementMode: productPlacement.mode,
            ...(productPlacement.mode === "custom"
              ? { placementOffsets: { left: productPlacement.left, top: productPlacement.top } }
              : {}),
            metadataSummary,
            ...(visionSummary ? { visionSummary } : {}),
            ...(visionAttributes?.length ? { visionAttributes } : {}),
            ...(visionBackgroundIdeas?.length ? { visionBackgroundIdeas } : {}),
            ...(visionSizeHint ? { visionSizeHint } : {}),
            ...(visionPositionHint ? { visionPositionHint } : {}),
          },
          timestamp: new Date(),
          processingTime: Date.now() - stabilityStartTime,
        },
      ],
      status: "completed" as const,
      tags: Array.from(tagSet),
      title:
        existingImage.title ||
        `${existingImage.filename} - ${derivedTheme.replace(/-/g, " ")} background`,
      description: generatedDescription,
      category: existingImage.category || "product",
      isPublic: false,
      views: 0,
      downloads: 0,
      dimensions: {
        width: stabilityWidth,
        height: stabilityHeight,
      },
    });

    await this.imageModel.findByIdAndUpdate(existingImage._id, {
      $addToSet: { children: generatedImage._id },
    });

    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    return successHandler({
      res,
      message: "Background generated successfully",
      result: {
        transparentImage: this.serializeImageDoc(existingImage),
        generatedImage: this.serializeImageDoc(generatedImage),
      },
    });
  };

  // ============================ genResizeImg ============================
  genResizeImg = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const user = res.locals.user;
    if (!user?._id) {
      throw new ApplicationException("User not authenticated", 401);
    }

    const file = req.file as Express.Multer.File | undefined;
    const { imageId, width, height, fit, background, format, quality, allowUpscale, position } =
      req.body || {};

    const parseDimension = (value: unknown) => {
      if (typeof value === "undefined" || value === null || value === "") {
        return undefined;
      }
      const parsed = Number(value);
      if (Number.isNaN(parsed)) {
        throw new ApplicationException("width/height must be numeric", 400);
      }
      if (parsed <= 0) {
        throw new ApplicationException("width/height must be positive", 400);
      }
      return parsed;
    };

    const targetWidth = parseDimension(width);
    const targetHeight = parseDimension(height);

    if (!targetWidth && !targetHeight) {
      throw new ApplicationException("Provide at least one dimension (width or height)", 400);
    }

    const fitOptions: Array<keyof sharp.FitEnum> = [
      "cover",
      "contain",
      "fill",
      "inside",
      "outside",
    ];
    const fitValue =
      typeof fit === "string" ? (fit.toLowerCase() as keyof sharp.FitEnum) : undefined;
    const normalizedFit: keyof sharp.FitEnum =
      fitValue && fitOptions.includes(fitValue) ? fitValue : "inside";

    const gravityOptions: Array<sharp.Gravity> = [
      "centre",
      "north",
      "northeast",
      "east",
      "southeast",
      "south",
      "southwest",
      "west",
      "northwest",
      "center",
      "entropy",
      "attention",
    ];

    const gravityValue =
      typeof position === "string" ? (position.toLowerCase() as sharp.Gravity) : undefined;
    const normalizedPosition: sharp.Gravity =
      gravityValue && gravityOptions.includes(gravityValue) ? gravityValue : "centre";

    const shouldAllowUpscale = this.parseBooleanFlag(allowUpscale, false);
    const normalizedQuality = quality ? Math.min(Math.max(Number(quality), 1), 100) : 90;

    const formatMap: Record<
      string,
      { mime: string; extension: string; sharpFormat: "jpeg" | "png" | "webp" | "avif" }
    > = {
      jpeg: { mime: "image/jpeg", extension: "jpg", sharpFormat: "jpeg" },
      jpg: { mime: "image/jpeg", extension: "jpg", sharpFormat: "jpeg" },
      png: { mime: "image/png", extension: "png", sharpFormat: "png" },
      webp: { mime: "image/webp", extension: "webp", sharpFormat: "webp" },
      avif: { mime: "image/avif", extension: "avif", sharpFormat: "avif" },
    };

    // Step: Prepare source buffer either from fresh upload or existing image
    let sourceBuffer: Buffer;
    let parentImage: IImage | null = null;
    let sourceMimeType = file?.mimetype;
    let sourceFilename = file?.filename;
    let sourceOriginalFilename = file?.originalname;
    let sourceStoragePath = `ImaginoApp/genResizeImg/${user._id}/originals`;

    if (file) {
      sourceBuffer = fs.readFileSync(file.path);

      const originalMetadata = await sharp(sourceBuffer).metadata();

      const { public_id, secure_url } = await uploadSingleFile({
        fileLocation: file.path,
        storagePathOnCloudinary: sourceStoragePath,
      });

      parentImage = await this.imageModel.create({
        user: user._id,
        url: secure_url,
        storageKey: public_id,
        filename: file.filename,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        dimensions: {
          width: originalMetadata.width || 0,
          height: originalMetadata.height || 0,
        },
        children: [],
        isOriginal: true,
        version: 1,
        aiEdits: [],
        status: "completed" as const,
        tags: ["genResizeImg", "original"],
        title: file.originalname,
        description: "Original upload for resizing",
        category: "other" as const,
        isPublic: false,
        views: 0,
        downloads: 0,
      });
    } else {
      if (!imageId || !mongoose.Types.ObjectId.isValid(imageId)) {
        throw new ApplicationException("Provide a valid imageId or upload a new file", 400);
      }

      parentImage = await this.imageModel.findOne({
        _id: new mongoose.Types.ObjectId(imageId),
        user: user._id,
        deletedAt: null,
      });

      if (!parentImage) {
        throw new ApplicationException("Image not found", 404);
      }

      sourceBuffer = await this.downloadImageAsBuffer(parentImage.url);
      sourceMimeType = parentImage.mimeType;
      sourceFilename = parentImage.filename;
      sourceOriginalFilename = parentImage.originalFilename || parentImage.filename;
      sourceStoragePath = `ImaginoApp/genResizeImg/${user._id}/derived`;
    }

    if (!parentImage) {
      throw new ApplicationException("Unable to determine source image", 400);
    }

    const metadata = await sharp(sourceBuffer).metadata();

    let requestedFormat = typeof format === "string" ? format.toLowerCase() : undefined;
    if (requestedFormat === "jpg") requestedFormat = "jpeg";
    const preferredFormat =
      (requestedFormat && formatMap[requestedFormat]?.sharpFormat) ||
      (metadata.format && formatMap[metadata.format]?.sharpFormat) ||
      "png";
    const formatDetails = formatMap[preferredFormat] || formatMap.png;

    const resizePipeline = sharp(sourceBuffer)
      .rotate()
      .resize({
        width: targetWidth ? Math.round(targetWidth) : undefined,
        height: targetHeight ? Math.round(targetHeight) : undefined,
        fit: normalizedFit,
        position: normalizedPosition,
        withoutEnlargement: !shouldAllowUpscale,
        background: background || { r: 0, g: 0, b: 0, alpha: 0 },
      });

    let processedPipeline: sharp.Sharp;
    switch (preferredFormat) {
      case "jpeg":
        processedPipeline = resizePipeline.jpeg({ quality: normalizedQuality, mozjpeg: true });
        break;
      case "webp":
        processedPipeline = resizePipeline.webp({ quality: normalizedQuality });
        break;
      case "avif":
        processedPipeline = resizePipeline.avif({ quality: normalizedQuality });
        break;
      default:
        processedPipeline = resizePipeline.png({ quality: normalizedQuality });
        break;
    }

    const resizedBuffer = await processedPipeline.toBuffer();
    const resizedMetadata = await sharp(resizedBuffer).metadata();

    const tmpDir = this.ensureTmpDirectory("resized");
    const parsedName = path.parse(sourceFilename || sourceOriginalFilename || "image");
    const resizedFilename = `${parsedName.name || "image"}-${targetWidth || "auto"}x${
      targetHeight || "auto"
    }-${Date.now()}.${formatDetails?.extension || "png"}`;
    const tempResizedPath = path.join(tmpDir, resizedFilename);
    fs.writeFileSync(tempResizedPath, resizedBuffer);

    const { public_id: resizedPublicId, secure_url: resizedSecureUrl } = await uploadSingleFile({
      fileLocation: tempResizedPath,
      storagePathOnCloudinary: `ImaginoApp/genResizeImg/${user._id}/resized`,
    });

    const resizedImage = await this.imageModel.create({
      user: user._id,
      url: resizedSecureUrl,
      storageKey: resizedPublicId,
      filename: resizedFilename,
      originalFilename: `${parsedName.name || "image"}-resized.${formatDetails?.extension || "png"}`,
      mimeType: formatDetails?.mime || sourceMimeType || "image/png",
      size: resizedBuffer.length,
      parentId: parentImage._id,
      children: [],
      isOriginal: false,
      version: (parentImage.version || 1) + 1,
      aiEdits: [
        {
          operation: "custom",
          provider: "custom",
          prompt: `Resize image to ${targetWidth || "auto"}x${targetHeight || "auto"}`,
          parameters: {
            width: targetWidth,
            height: targetHeight,
            fit: normalizedFit,
            format: preferredFormat,
            allowUpscale: shouldAllowUpscale,
            position: normalizedPosition,
          },
          timestamp: new Date(),
          processingTime: 0,
        },
      ],
      status: "completed" as const,
      tags: ["genResizeImg", `${targetWidth || "auto"}x${targetHeight || "auto"}`, preferredFormat],
      title: `Resized - ${parentImage.title || parentImage.filename}`,
      description: `Resized image to ${targetWidth || "auto"}x${targetHeight || "auto"}`,
      category: parentImage.category || "other",
      isPublic: false,
      views: 0,
      downloads: 0,
      dimensions: {
        width: resizedMetadata.width || targetWidth || 0,
        height: resizedMetadata.height || targetHeight || 0,
      },
    });

    await this.imageModel.findByIdAndUpdate(parentImage._id, {
      $addToSet: { children: resizedImage._id },
    });

    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    if (fs.existsSync(tempResizedPath)) {
      fs.unlinkSync(tempResizedPath);
    }

    return successHandler({
      res,
      message: "Image resized successfully",
      result: {
        originalImage: this.serializeImageDoc(parentImage),
        resizedImage: this.serializeImageDoc(resizedImage),
      },
    });
  };

  // ============================ genImgWithNewDimension ============================
  genImgWithNewDimension = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const user = res.locals.user;
    const file = req.file;
    const { angle } = req.body;
    // step: file and angle existence
    if (!file) {
      throw new ApplicationException("file is required", 400);
    }
    if (!angle) {
      return successHandler({ res, message: "Please send angle", status: 400 });
    }
    // step: store image in cloudinary and db
    const { public_id, secure_url } = await uploadSingleFile({
      fileLocation: (file as any).path,
      storagePathOnCloudinary: `ImaginoApp/genImgWithNewDimension/${user._id}`,
    });
    const originalImage = await this.imageModel.create({
      user: user._id,
      url: secure_url,
      storageKey: public_id,
      filename: file.filename,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      children: [],
      isOriginal: true,
      version: 1,
      aiEdits: [],
      status: "completed" as const,
      tags: ["genImgWithNewDimension"],
      title: "genImgWithNewDimension",
      description: "genImgWithNewDimension",
      category: "other" as const,
      isPublic: false,
      views: 0,
      downloads: 0,
    });
    // step: use ai to gen new images with new dimension
    const newAngleImageBuffer = await genImgWithNewDimensionFn(file, angle);

    // step: Create a temporary path for the new angle image to upload it
    const newAngleFilename = `newAngle-${Date.now()}-${file.filename}`;
    const tempNewAnglePath = `${file.path}-new angle`;
    if (!newAngleImageBuffer) {
      return successHandler({ res, message: "Failed to generate new angle image", status: 500 });
    }

    fs.writeFileSync(tempNewAnglePath, newAngleImageBuffer);

    // step: Store new angle image in Cloudinary
    const { public_id: newPublicId, secure_url: newSecureUrl } = await uploadSingleFile({
      fileLocation: tempNewAnglePath,
      storagePathOnCloudinary: `ImaginoApp/genInhancedQuality/${user._id}/new angle`,
    });

    // step: Store new angle image in DB (as child of original)
    const newAngleImage = await this.imageModel.create({
      user: user._id,
      url: newSecureUrl,
      storageKey: newPublicId,
      filename: newAngleFilename,
      originalFilename: `enhanced-${file.originalname}`,
      mimeType: file.mimetype,
      size: newAngleImageBuffer.length,
      parentId: originalImage._id,
      children: [],
      isOriginal: false,
      version: 1, // Will auto-increment due to pre-save hook logic if configured
      aiEdits: [
        {
          operation: "enhance" as const, // Ensure this enum exists in your schema
          provider: "custom" as const, // or "google"
          prompt: "Enhance image quality and resolution",
          parameters: {
            model: "gemini-flash",
            improvement: "quality-upscale",
          },
          timestamp: new Date(),
          processingTime: 0,
        },
      ],
      status: "completed" as const,
      tags: ["enhanced", "genAI", "high-quality"],
      title: `Enhanced - ${file.originalname}`,
      description: "AI Enhanced version of the original image",
      category: "other" as const,
      isPublic: false,
      views: 0,
      downloads: 0,
    });

    // step: Update parent image with child reference
    await this.imageModel.findByIdAndUpdate(originalImage._id, {
      $addToSet: { children: newAngleImage._id },
    });

    // step: Cleanup file system (Temp files)
    // Delete the original multer upload
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    // step: Delete the generated temp file
    if (fs.existsSync(tempNewAnglePath)) fs.unlinkSync(tempNewAnglePath);

    return successHandler({
      res,
      result: {
        original: originalImage,
        enhanced: newAngleImage,
      },
    });
  };

  // ============================ genInhancedQualityImg ============================
  genInhancedQualityImg = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const user = res.locals.user;
    const file = req.file;

    // step: check file existence
    if (!file) {
      throw new ApplicationException("file is required", 400);
    }

    // step: Store ORIGINAL image in Cloudinary and DB
    const { public_id, secure_url } = await uploadSingleFile({
      fileLocation: (file as any).path,
      storagePathOnCloudinary: `ImaginoApp/genInhancedQuality/${user._id}`,
    });

    const originalImage = await this.imageModel.create({
      user: user._id,
      url: secure_url,
      storageKey: public_id,
      filename: file.filename,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      children: [],
      isOriginal: true,
      version: 1,
      aiEdits: [],
      status: "completed" as const,
      tags: ["original", "before-enhancement"],
      title: file.originalname,
      description: "Original upload for quality enhancement",
      category: "other" as const,
      isPublic: false,
      views: 0,
      downloads: 0,
    });

    // step: Use AI to generate enhanced quality image
    // This function returns a Buffer of the processed image
    const enhancedImageBuffer = await genInhancedQualityImgFn(file.path);
    // step: Create a temporary path for the enhanced image to upload it
    const enhancedFilename = `enhanced-${Date.now()}-${file.filename}`;
    const tempEnhancedPath = `${file.path}-enhanced`;

    fs.writeFileSync(tempEnhancedPath, enhancedImageBuffer);

    // step: Store ENHANCED image in Cloudinary
    const { public_id: newPublicId, secure_url: newSecureUrl } = await uploadSingleFile({
      fileLocation: tempEnhancedPath,
      storagePathOnCloudinary: `ImaginoApp/genInhancedQuality/${user._id}/enhanced`,
    });

    // step: Store ENHANCED image in DB (as child of original)
    const enhancedImage = await this.imageModel.create({
      user: user._id,
      url: newSecureUrl,
      storageKey: newPublicId,
      filename: enhancedFilename,
      originalFilename: `enhanced-${file.originalname}`,
      mimeType: file.mimetype,
      size: enhancedImageBuffer.length,
      parentId: originalImage._id,
      children: [],
      isOriginal: false,
      version: 1, // Will auto-increment due to pre-save hook logic if configured
      aiEdits: [
        {
          operation: "enhance" as const, // Ensure this enum exists in your schema
          provider: "custom" as const, // or "google"
          prompt: "Enhance image quality and resolution",
          parameters: {
            model: "gemini-flash",
            improvement: "quality-upscale",
          },
          timestamp: new Date(),
          processingTime: 0,
        },
      ],
      status: "completed" as const,
      tags: ["enhanced", "genAI", "high-quality"],
      title: `Enhanced - ${file.originalname}`,
      description: "AI Enhanced version of the original image",
      category: "other" as const,
      isPublic: false,
      views: 0,
      downloads: 0,
    });

    // step: Update parent image with child reference
    await this.imageModel.findByIdAndUpdate(originalImage._id, {
      $addToSet: { children: enhancedImage._id },
    });

    // step: Cleanup file system (Temp files)
    // Delete the original multer upload
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    // step: Delete the generated temp file
    if (fs.existsSync(tempEnhancedPath)) fs.unlinkSync(tempEnhancedPath);

    return successHandler({
      res,
      result: {
        original: originalImage,
        enhanced: enhancedImage,
      },
    });
  };

  // ============================ genMergeLogoToImg ============================
  genMergeLogoToImg = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const user = res.locals.user;
    const files = req.files as Express.Multer.File[];

    // step: check file existence and validate we have exactly 2 images
    if (!files || !Array.isArray(files) || files.length !== 2) {
      throw new ApplicationException("Exactly 2 images are required (base image and logo)", 400);
    }

    // After validation, we know files has exactly 2 elements
    const baseImageFile = files[0]!;
    const logoImageFile = files[1]!;

    // step: Store BOTH ORIGINAL images in Cloudinary and DB
    // Store base image
    const { public_id: basePublicId, secure_url: baseSecureUrl } = await uploadSingleFile({
      fileLocation: baseImageFile.path,
      storagePathOnCloudinary: `ImaginoApp/genMergeLogoToImg/${user._id}/base`,
    });

    const baseImage = await this.imageModel.create({
      user: user._id,
      url: baseSecureUrl,
      storageKey: basePublicId,
      filename: baseImageFile.filename,
      originalFilename: baseImageFile.originalname,
      mimeType: baseImageFile.mimetype,
      size: baseImageFile.size,
      children: [],
      isOriginal: true,
      version: 1,
      aiEdits: [],
      status: "completed" as const,
      tags: ["base-image", "merge-operation"],
      title: `Base - ${baseImageFile.originalname}`,
      description: "Base image for logo merging",
      category: "other" as const,
      isPublic: false,
      views: 0,
      downloads: 0,
    });

    // Store logo image
    const { public_id: logoPublicId, secure_url: logoSecureUrl } = await uploadSingleFile({
      fileLocation: logoImageFile.path,
      storagePathOnCloudinary: `ImaginoApp/genMergeLogoToImg/${user._id}/logo`,
    });

    const logoImage = await this.imageModel.create({
      user: user._id,
      url: logoSecureUrl,
      storageKey: logoPublicId,
      filename: logoImageFile.filename,
      originalFilename: logoImageFile.originalname,
      mimeType: logoImageFile.mimetype,
      size: logoImageFile.size,
      children: [],
      isOriginal: true,
      version: 1,
      aiEdits: [],
      status: "completed" as const,
      tags: ["logo", "merge-operation"],
      title: `Logo - ${logoImageFile.originalname}`,
      description: "Logo image for merging",
      category: "other" as const,
      isPublic: false,
      views: 0,
      downloads: 0,
    });

    // step: Use AI/Sharp to merge logo to image
    // This function returns a Buffer of the processed image
    const mergedImageBuffer = await genMergeLogoToImgFn(baseImageFile.path, logoImageFile.path, {
      position: "bottom-right",
      opacity: 80,
      logoScale: 0.15,
      padding: 20,
    });

    // step: Create a temporary path for the merged image to upload it
    const mergedFilename = `merged-${Date.now()}-${baseImageFile.filename}`;
    const tempMergedPath = `${baseImageFile.path}-merged`;
    fs.writeFileSync(tempMergedPath, mergedImageBuffer);

    // step: Store MERGED image in Cloudinary
    const { public_id: mergedPublicId, secure_url: mergedSecureUrl } = await uploadSingleFile({
      fileLocation: tempMergedPath,
      storagePathOnCloudinary: `ImaginoApp/genMergeLogoToImg/${user._id}/merged`,
    });

    // step: Store MERGED image in DB (as child of base image)
    const mergedImage = await this.imageModel.create({
      user: user._id,
      url: mergedSecureUrl,
      storageKey: mergedPublicId,
      filename: mergedFilename,
      originalFilename: `merged-${baseImageFile.originalname}`,
      mimeType: baseImageFile.mimetype,
      size: mergedImageBuffer.length,
      parentId: baseImage._id,
      children: [],
      isOriginal: false,
      version: 1,
      aiEdits: [
        {
          operation: "custom" as const,
          provider: "custom" as const,
          prompt: "Merge logo onto base image",
          parameters: {
            operationType: "merge",
            logoImageId: logoImage._id.toString(),
            position: "bottom-right",
            opacity: 80,
            logoScale: 0.15,
            padding: 20,
          },
          timestamp: new Date(),
          processingTime: 0,
        },
      ],
      status: "completed" as const,
      tags: ["merged", "logo-watermark", "genAI"],
      title: `Merged - ${baseImageFile.originalname}`,
      description: `Base image with ${logoImageFile.originalname} logo overlay`,
      category: "other" as const,
      isPublic: false,
      views: 0,
      downloads: 0,
    });

    // step: Update base image with child reference
    await this.imageModel.findByIdAndUpdate(baseImage._id, {
      $addToSet: { children: mergedImage._id },
    });

    // step: Cleanup file system (Temp files)
    // Delete the original multer uploads
    if (fs.existsSync(baseImageFile.path)) fs.unlinkSync(baseImageFile.path);
    if (fs.existsSync(logoImageFile.path)) fs.unlinkSync(logoImageFile.path);

    // step: Delete the generated temp file
    if (fs.existsSync(tempMergedPath)) fs.unlinkSync(tempMergedPath);

    return successHandler({
      res,
      result: {
        baseImage,
        logoImage,
        mergedImage,
        message: "Images merged successfully",
      },
    });
  };

  // ============================ extractTextFromImg ============================
  extractTextFromImg = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const user = res.locals.user;
    const file = req.file as Express.Multer.File | undefined;
    const { imageId } = req.body || {};

    if (!file && (!imageId || !mongoose.Types.ObjectId.isValid(imageId))) {
      throw new ApplicationException("Provide an image file or a valid imageId", 400);
    }

    let fileForOcr: Express.Multer.File | undefined = file;

    // If no upload, pull existing image and materialize it as a temp multer-like file
    if (!fileForOcr && imageId) {
      const existingImage = await this.imageModel.findOne({
        _id: new mongoose.Types.ObjectId(imageId),
        user: user._id,
        deletedAt: null,
      });

      if (!existingImage) {
        throw new ApplicationException("Image not found", 404);
      }

      const buffer = await this.downloadImageAsBuffer(existingImage.url);
      const tmpDir = this.ensureTmpDirectory("extract-text");
      const extension = existingImage.mimeType?.split("/")[1] || "png";
      const filename = `${existingImage._id}-${Date.now()}.${extension}`;
      const tempPath = path.join(tmpDir, filename);
      fs.writeFileSync(tempPath, buffer);

      fileForOcr = {
        fieldname: "image",
        originalname: existingImage.originalFilename || existingImage.filename || filename,
        encoding: "7bit",
        mimetype: existingImage.mimeType || "image/png",
        destination: tmpDir,
        filename,
        path: tempPath,
        size: buffer.length,
        stream: fs.createReadStream(tempPath),
        buffer,
      } as Express.Multer.File;
    }

    if (!fileForOcr) {
      throw new ApplicationException("Unable to process image", 400);
    }

    // If the request uploaded a new file, persist it like before
    if (file) {
      const { public_id, secure_url } = await uploadSingleFile({
        fileLocation: file.path,
        storagePathOnCloudinary: `ImaginoApp/genInhancedQuality/${user._id}`,
      });

      await this.imageModel.create({
        user: user._id,
        url: secure_url,
        storageKey: public_id,
        filename: file.filename,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        children: [],
        isOriginal: true,
        version: 1,
        aiEdits: [],
        status: "completed" as const,
        tags: ["extractTextFromImg"],
        title: file.originalname,
        description: "Original upload for quality enhancement",
        category: "other" as const,
        isPublic: false,
        views: 0,
        downloads: 0,
      });
    }

    const text = await extractTextFromImgFn(fileForOcr as any);
    return successHandler({ res, result: { text } });
  };

  // ============================ recognizeItemsInImage ============================
  recognizeItemsInImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const user = res.locals.user;
    const file = req.file as Express.Multer.File | undefined;
    const { imageId } = req.body || {};

    if (!file && (!imageId || !mongoose.Types.ObjectId.isValid(imageId))) {
      throw new ApplicationException("Provide an image file or a valid imageId", 400);
    }

    let fileForRecognition: Express.Multer.File | undefined = file;

    if (!fileForRecognition && imageId) {
      const existingImage = await this.imageModel.findOne({
        _id: new mongoose.Types.ObjectId(imageId),
        user: user._id,
        deletedAt: null,
      });

      if (!existingImage) {
        throw new ApplicationException("Image not found", 404);
      }

      const buffer = await this.downloadImageAsBuffer(existingImage.url);
      const tmpDir = this.ensureTmpDirectory("recognize-items");
      const extension = existingImage.mimeType?.split("/")[1] || "png";
      const filename = `${existingImage._id}-${Date.now()}.${extension}`;
      const tempPath = path.join(tmpDir, filename);
      fs.writeFileSync(tempPath, buffer);

      fileForRecognition = {
        fieldname: "image",
        originalname: existingImage.originalFilename || existingImage.filename || filename,
        encoding: "7bit",
        mimetype: existingImage.mimeType || "image/png",
        destination: tmpDir,
        filename,
        path: tempPath,
        size: buffer.length,
        stream: fs.createReadStream(tempPath),
        buffer,
      } as Express.Multer.File;
    }

    if (!fileForRecognition) {
      throw new ApplicationException("Unable to process image", 400);
    }

    // Persist uploaded files as before
    if (file) {
      const { public_id, secure_url } = await uploadSingleFile({
        fileLocation: file.path,
        storagePathOnCloudinary: `ImaginoApp/genInhancedQuality/${user._id}`,
      });

      await this.imageModel.create({
        user: user._id,
        url: secure_url,
        storageKey: public_id,
        filename: file.filename,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        children: [],
        isOriginal: true,
        version: 1,
        aiEdits: [],
        status: "completed" as const,
        tags: ["recognizeItemsInImage"],
        title: file.originalname,
        description: "Original upload for quality enhancement",
        category: "other" as const,
        isPublic: false,
        views: 0,
        downloads: 0,
      });
    }

    const text = await recognizeItemsInImgFn(fileForRecognition as any);
    return successHandler({ res, result: { text } });
  };
  // ============================ getAllImages ============================
  getAllImages = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const { isPublic, category, tags, page = 1, size = 20 } = req.query;

    const userId = res.locals.user?._id?.toString();
    if (!userId) {
      throw new ApplicationException("User not authenticated", 401);
    }

    const query: any = { deletedAt: null, user: userId };

    if (typeof isPublic !== "undefined") {
      query.isPublic = isPublic === "true";
    }

    if (category) {
      query.category = category;
    }

    if (tags) {
      query.tags = { $all: (tags as string).split(",") };
    }

    const { limit, skip } = paginationFunction({
      page: Number(page),
      size: Number(size),
    });

    const [images, totalCount] = await Promise.all([
      ImageModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "user url thumbnailUrl storageKey filename mimeType size dimensions tags title description category isPublic views downloads createdAt updatedAt",
        ),
      ImageModel.countDocuments(query),
    ]);
    console.log("IMAGES RESULT => ", images);

    if (!images.length) {
      return successHandler({
        res,
        message: "No images found",
        result: {
          images: [],
          totalCount: 0,
          page: Number(page),
          size: Number(size),
        },
      });
    }

    const formattedImages = images.map((img) => ({
      _id: img._id,
      user: img.user,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl,
      storageKey: img.storageKey,
      filename: img.filename,
      mimeType: img.mimeType,
      size: img.size,
      dimensions: img.dimensions,
      tags: img.tags,
      title: img.title,
      description: img.description,
      category: img.category,
      isPublic: img.isPublic,
      views: img.views,
      downloads: img.downloads,
      createdAt: img.createdAt,
      updatedAt: img.updatedAt,
    }));

    return successHandler({
      res,
      message: "Images fetched successfully",
      result: {
        images: formattedImages,
        totalCount,
        page: Number(page),
        size: Number(size),
      },
    });
  };

  // ============================ deleteImage ============================
  deleteImage = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const imageId = req.params.imageId;
    const userId = res.locals.user?._id?.toString();

    if (!imageId || !mongoose.Types.ObjectId.isValid(imageId)) {
      throw new ApplicationException("Invalid image ID", 400);
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new ApplicationException("User not authenticated", 401);
    }

    const imageExist: any = {
      _id: new mongoose.Types.ObjectId(imageId),
      user: new mongoose.Types.ObjectId(userId),
      deletedAt: null,
    };

    const image = await ImageModel.findOne(imageExist);

    if (!image) {
      throw new ApplicationException("Image not found or already deleted", 404);
    }

    await destroySingleFile({ public_id: image.storageKey });

    image.status = "deleted";
    image.deletedAt = new Date();
    await image.save();

    return successHandler({
      res,
      message: "Image deleted successfully",
      result: {
        _id: image._id,
        deletedAt: image.deletedAt,
      },
    });
  };

  // ============================ uploadImageWithoutBackground ============================
  uploadImageWithoutBackground = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const userId = res.locals.user?._id?.toString();
    if (!userId) throw new ApplicationException("User not authenticated", 401);

    if (!req.file) throw new ApplicationException("No image uploaded", 400);

    const fileBuffer = fs.readFileSync(req.file.path);
    const base64Image = fileBuffer.toString("base64");

    const resultBase64 = await removeBackgroundFromImageBase64({
      imageBase64: base64Image,
    });

    const bufferToUpload = Buffer.from(resultBase64, "base64");

    const projectFolder = process.env.PROJECT_FOLDER || "DefaultProjectFolder";

    const { public_id, secure_url } = await uploadBufferFile({
      fileBuffer: bufferToUpload,
      storagePathOnCloudinary: `${projectFolder}/${userId}/no-bg`,
    });

    const newImage = await ImageModel.create({
      user: new mongoose.Types.ObjectId(userId),
      url: secure_url,
      storageKey: public_id,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      dimensions: { width: 0, height: 0 },
      status: "completed",
      isPublic: false,
      aiEdits: [
        {
          operation: "remove-background",
          provider: "custom",
          timestamp: new Date(),
          processingTime: 0,
          cost: 0,
        },
      ],
    });

    fs.unlinkSync(req.file.path);

    return successHandler({
      res,
      message: "Image uploaded and background removed successfully",
      result: {
        _id: newImage._id,
        url: newImage.url,
        storageKey: newImage.storageKey,
        aiEdits: newImage.aiEdits,
      },
    });
  };

  // ============================ genChangeImageStyle ============================
  genChangeImageStyle = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const user = res.locals.user;
    const file = req.file;
    const { style } = req.body;

    // step: check file existence
    if (!file) {
      throw new ApplicationException("file is required", 400);
    }

    // step: store orignial image in Cloudinary and DB
    const { public_id, secure_url } = await uploadSingleFile({
      fileLocation: (file as any).path,
      storagePathOnCloudinary: `ImaginoApp/genInhancedQuality/${user._id}`,
    });

    const originalImage = await this.imageModel.create({
      user: user._id,
      url: secure_url,
      storageKey: public_id,
      filename: file.filename,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      children: [],
      isOriginal: true,
      version: 1,
      aiEdits: [],
      status: "completed" as const,
      tags: ["original", "convert-to-style"],
      title: file.originalname,
      description: "Original upload for quality enhancement",
      category: "other" as const,
      isPublic: false,
      views: 0,
      downloads: 0,
    });

    // step: Use AI to remove background
    // This function returns a Buffer of the processed image
    const imgWithStyle = await genChangeImageStyleFn(file, style);

    // step: Check if background removal was successful
    if (!imgWithStyle) {
      throw new ApplicationException("Failed to remove background from image", 500);
    }

    // step: Create a temporary path for the enhanced image to upload it
    const imgWithStyleName = `removedBG-${Date.now()}-${file.filename}`;
    const tempImgWithStyle = `${file.path}-removedBG`;

    fs.writeFileSync(tempImgWithStyle, imgWithStyle);

    // step: Store removedBGImage in Cloudinary
    const { public_id: newPublicId, secure_url: newSecureUrl } = await uploadSingleFile({
      fileLocation: tempImgWithStyle,
      storagePathOnCloudinary: `ImaginoApp/genInhancedQuality/${user._id}/removedBG`,
    });

    // step: Store removedBGImage in DB (as child of original)
    const removedBGImage = await this.imageModel.create({
      user: user._id,
      url: newSecureUrl,
      storageKey: newPublicId,
      filename: imgWithStyleName,
      originalFilename: `removedBG-${file.originalname}`,
      mimeType: file.mimetype,
      size: imgWithStyle.length,
      parentId: originalImage._id,
      children: [],
      isOriginal: false,
      version: 1, // Will auto-increment due to pre-save hook logic if configured
      aiEdits: [
        {
          operation: "enhance" as const, // Ensure this enum exists in your schema
          provider: "custom" as const, // or "google"
          prompt: "Enhance image quality and resolution",
          parameters: {
            model: "gemini-flash",
            improvement: "quality-upscale",
          },
          timestamp: new Date(),
          processingTime: 0,
        },
      ],
      status: "completed" as const,
      tags: ["enhanced", "genAI", "high-quality"],
      title: `Enhanced - ${file.originalname}`,
      description: "AI Enhanced version of the original image",
      category: "other" as const,
      isPublic: false,
      views: 0,
      downloads: 0,
    });

    // step: Update parent image with child reference
    await this.imageModel.findByIdAndUpdate(originalImage._id, {
      $addToSet: { children: removedBGImage._id },
    });

    // step: Cleanup file system (Temp files)
    // Delete the original multer upload
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    // step: Delete the generated temp file
    if (fs.existsSync(tempImgWithStyle)) fs.unlinkSync(tempImgWithStyle);

    return successHandler({
      res,
      result: {
        original: originalImage,
        enhanced: removedBGImage,
      },
    });
  };
}
