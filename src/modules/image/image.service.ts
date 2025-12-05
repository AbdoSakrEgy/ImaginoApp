import { IImage } from "./../../types/image.module.types";
import { ImageModel } from "./image.model";
import { successHandler } from "../../utils/successHandler";
import { NextFunction, Request, Response } from "express";
import { ApplicationException } from "../../utils/Errors";
import { IImageServices } from "../../types/image.module.types";
import { genImgWithNewDimensionFn } from "../../utils/GenAI/gen.img.with.new.dimension";
import * as fs from "fs";
import { genInhancedQualityImgFn } from "../../utils/GenAI/gen.inhanced.quality.img";
import { genMergeLogoToImgFn } from "../../utils/GenAI/gen-merge-logo-to-img";
import { paginationFunction } from "../../utils/pagination";
import { destroySingleFile, uploadSingleFile } from "../../utils/cloudinary/cloudinary.service";
import mongoose from "mongoose";
import { removeBackgroundFromImageBase64 } from "../../utils/ai/removeBackground";
import path from "path/win32";
import sharp from "sharp";
import axios from "axios";

export class ImageServices implements IImageServices {
  private imageModel = ImageModel;

  constructor() {}

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

  ensureTmpDirectory(subdir: string): string {
  const baseDir = '/tmp'; // Lambda's writable directory
  const fullPath = path.join(baseDir, subdir);
  
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  
  return fullPath;
}

  private async downloadImageAsBuffer(url: string): Promise<Buffer> {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(response.data);
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

  // ============================ genSutiableBackgrounds ============================
  genSutiableBackgrounds = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    return successHandler({ res });
  };

  // ============================ genImgWithSelectedBackground ============================
  genImgWithSelectedBackground = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    return successHandler({ res });
  };

  // ============================ genImgWithNewBackground ============================
  genImgWithNewBackground = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    return successHandler({ res });
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
    // step: file existence
    if (!file) {
      throw new ApplicationException("file is required", 400);
    }
    // step: store image in cloudinary and db
    const { public_id, secure_url } = await uploadSingleFile({
      fileLocation: (file as any).path,
      storagePathOnCloudinary: `ImaginoApp/genImgWithNewDimension/${user._id}`,
    });
    const image = await this.imageModel.create({
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
    const newImages = await genImgWithNewDimensionFn(file.path);
    // step: store new images in cloudinary and db
    const storedImages: any = [];

    for (const newImage of newImages) {
      try {
        // Convert base64 to buffer if needed
        const imageBuffer = Buffer.from(newImage.image, "base64");
        const tempImagePath = `${file.path}-${newImage.viewType}`;
        fs.writeFileSync(tempImagePath, imageBuffer);

        // sotre in cloudinary
        const { public_id: newPublicId, secure_url: newSecureUrl } = await uploadSingleFile({
          fileLocation: tempImagePath,
          storagePathOnCloudinary: `ImaginoApp/genImgWithNewDimension/${user._id}/${newImage.viewType}`,
        });

        // store in db
        const childImage = await this.imageModel.create({
          user: user._id,
          url: newSecureUrl,
          storageKey: newPublicId,
          filename: `${file.filename}-${newImage.viewType}`,
          originalFilename: `${file.originalname}-${newImage.viewType}`,
          mimeType: file.mimetype,
          size: imageBuffer.length,
          parentId: image._id,
          children: [],
          isOriginal: false,
          version: 1,
          aiEdits: [
            {
              operation: "image-to-image" as const,
              provider: "custom" as const,
              prompt: `Generate ${newImage.viewType} view of product`,
              parameters: {
                viewType: newImage.viewType,
                description: newImage.description,
                confidence: newImage.confidence || 0.92,
              },
              timestamp: new Date(),
              processingTime: 0,
            },
          ],
          status: "completed" as const,
          tags: ["genImgWithNewDimension", newImage.viewType],
          title: `${file.filename} - ${newImage.viewType}`,
          description: newImage.description,
          category: "product" as const,
          isPublic: false,
          views: 0,
          downloads: 0,
        });

        storedImages.push(childImage);

        // Clean up temp file
        fs.unlinkSync(tempImagePath);
      } catch (error) {
        console.error(`Error storing ${newImage.viewType} image:`, error);
      }
    }

    // Update parent image with children references
    await this.imageModel.findByIdAndUpdate(image._id, {
      children: storedImages.map((img: any) => img._id),
    });

    return successHandler({
      res,
      result: {
        originalImage: image,
        generatedImages: storedImages,
        totalGenerated: storedImages.length,
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

  // ============================ genImgWithoutBackground ============================
  genImgWithoutBackground = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const userId = res.locals.user?._id?.toString();
    if (!userId) throw new ApplicationException("User not authenticated", 401);
    if (!req.file) throw new ApplicationException("No image uploaded", 400);

    const tmpFolder = path.join(__dirname, "../../tmp");
    if (!fs.existsSync(tmpFolder)) fs.mkdirSync(tmpFolder, { recursive: true });

    const fileBuffer = fs.readFileSync(req.file.path);
    const base64Image = fileBuffer.toString("base64");

    const resultBase64 = await removeBackgroundFromImageBase64({
      imageBase64: base64Image,
    });

    const tmpFilePath = path.join(tmpFolder, `no-bg-${Date.now()}.png`);
    fs.writeFileSync(tmpFilePath, Buffer.from(resultBase64, "base64"));

    const projectFolder = process.env.PROJECT_FOLDER || "DefaultProjectFolder";

    const { public_id, secure_url } = await uploadSingleFile({
      fileLocation: tmpFilePath,
      storagePathOnCloudinary: `${projectFolder}/${userId}/no-bg`,
    });
    console.log(public_id);

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
    fs.unlinkSync(tmpFilePath);

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
}
