"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageServices = void 0;
const image_model_1 = require("./image.model");
const successHandler_1 = require("../../utils/successHandler");
const Errors_1 = require("../../utils/Errors");
const cloudinary_service_1 = require("../../utils/cloudinary/cloudinary.service");
const gen_img_with_new_dimension_1 = require("../../utils/GenAI/gen.img.with.new.dimension");
const fs = __importStar(require("fs"));
const gen_inhanced_quality_img_1 = require("../../utils/GenAI/gen.inhanced.quality.img");
const gen_merge_logo_to_img_1 = require("../../utils/GenAI/gen-merge-logo-to-img");
class ImageServices {
    imageModel = image_model_1.ImageModel;
    constructor() { }
    // ============================ gitImage ============================
    gitImage = async (req, res, next) => {
        return (0, successHandler_1.successHandler)({ res });
    };
    // ============================ deleteImage ============================
    deleteImage = async (req, res, next) => {
        return (0, successHandler_1.successHandler)({ res });
    };
    // ============================ genImgWithoutBackground ============================
    genImgWithoutBackground = async (req, res, next) => {
        return (0, successHandler_1.successHandler)({ res });
    };
    // ============================ genSutiableBackgrounds ============================
    genSutiableBackgrounds = async (req, res, next) => {
        return (0, successHandler_1.successHandler)({ res });
    };
    // ============================ genImgWithSelectedBackground ============================
    genImgWithSelectedBackground = async (req, res, next) => {
        return (0, successHandler_1.successHandler)({ res });
    };
    // ============================ genImgWithNewBackground ============================
    genImgWithNewBackground = async (req, res, next) => {
        return (0, successHandler_1.successHandler)({ res });
    };
    // ============================ genResizeImg ============================
    genResizeImg = async (req, res, next) => {
        return (0, successHandler_1.successHandler)({ res });
    };
    // ============================ genImgWithNewDimension ============================
    genImgWithNewDimension = async (req, res, next) => {
        const user = res.locals.user;
        const file = req.file;
        // step: file existence
        if (!file) {
            throw new Errors_1.ApplicationException("file is required", 400);
        }
        // step: store image in cloudinary and db
        const { public_id, secure_url } = await (0, cloudinary_service_1.uploadSingleFile)({
            fileLocation: file.path,
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
            status: "completed",
            tags: ["genImgWithNewDimension"],
            title: "genImgWithNewDimension",
            description: "genImgWithNewDimension",
            category: "other",
            isPublic: false,
            views: 0,
            downloads: 0,
        });
        // step: use ai to gen new images with new dimension
        const newImages = await (0, gen_img_with_new_dimension_1.genImgWithNewDimensionFn)(file.path);
        // step: store new images in cloudinary and db
        const storedImages = [];
        for (const newImage of newImages) {
            try {
                // Convert base64 to buffer if needed
                const imageBuffer = Buffer.from(newImage.image, "base64");
                const tempImagePath = `${file.path}-${newImage.viewType}`;
                fs.writeFileSync(tempImagePath, imageBuffer);
                // sotre in cloudinary
                const { public_id: newPublicId, secure_url: newSecureUrl } = await (0, cloudinary_service_1.uploadSingleFile)({
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
                            operation: "image-to-image",
                            provider: "custom",
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
                    status: "completed",
                    tags: ["genImgWithNewDimension", newImage.viewType],
                    title: `${file.filename} - ${newImage.viewType}`,
                    description: newImage.description,
                    category: "product",
                    isPublic: false,
                    views: 0,
                    downloads: 0,
                });
                storedImages.push(childImage);
                // Clean up temp file
                fs.unlinkSync(tempImagePath);
            }
            catch (error) {
                console.error(`Error storing ${newImage.viewType} image:`, error);
            }
        }
        // Update parent image with children references
        await this.imageModel.findByIdAndUpdate(image._id, {
            children: storedImages.map((img) => img._id),
        });
        return (0, successHandler_1.successHandler)({
            res,
            result: {
                originalImage: image,
                generatedImages: storedImages,
                totalGenerated: storedImages.length,
            },
        });
    };
    // ============================ genInhancedQualityImg ============================
    genInhancedQualityImg = async (req, res, next) => {
        const user = res.locals.user;
        const file = req.file;
        // step: check file existence
        if (!file) {
            throw new Errors_1.ApplicationException("file is required", 400);
        }
        // step: Store ORIGINAL image in Cloudinary and DB
        const { public_id, secure_url } = await (0, cloudinary_service_1.uploadSingleFile)({
            fileLocation: file.path,
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
            status: "completed",
            tags: ["original", "before-enhancement"],
            title: file.originalname,
            description: "Original upload for quality enhancement",
            category: "other",
            isPublic: false,
            views: 0,
            downloads: 0,
        });
        // step: Use AI to generate enhanced quality image
        // This function returns a Buffer of the processed image
        const enhancedImageBuffer = await (0, gen_inhanced_quality_img_1.genInhancedQualityImgFn)(file.path);
        // step: Create a temporary path for the enhanced image to upload it
        const enhancedFilename = `enhanced-${Date.now()}-${file.filename}`;
        const tempEnhancedPath = `${file.path}-enhanced`;
        fs.writeFileSync(tempEnhancedPath, enhancedImageBuffer);
        // step: Store ENHANCED image in Cloudinary
        const { public_id: newPublicId, secure_url: newSecureUrl } = await (0, cloudinary_service_1.uploadSingleFile)({
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
                    operation: "enhance", // Ensure this enum exists in your schema
                    provider: "custom", // or "google"
                    prompt: "Enhance image quality and resolution",
                    parameters: {
                        model: "gemini-flash",
                        improvement: "quality-upscale",
                    },
                    timestamp: new Date(),
                    processingTime: 0,
                },
            ],
            status: "completed",
            tags: ["enhanced", "genAI", "high-quality"],
            title: `Enhanced - ${file.originalname}`,
            description: "AI Enhanced version of the original image",
            category: "other",
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
        if (fs.existsSync(file.path))
            fs.unlinkSync(file.path);
        // step: Delete the generated temp file
        if (fs.existsSync(tempEnhancedPath))
            fs.unlinkSync(tempEnhancedPath);
        return (0, successHandler_1.successHandler)({
            res,
            result: {
                original: originalImage,
                enhanced: enhancedImage,
            },
        });
    };
    // ============================ genMergeLogoToImg ============================
    genMergeLogoToImg = async (req, res, next) => {
        const user = res.locals.user;
        const files = req.files;
        // step: check file existence and validate we have exactly 2 images
        if (!files || !Array.isArray(files) || files.length !== 2) {
            throw new Errors_1.ApplicationException("Exactly 2 images are required (base image and logo)", 400);
        }
        // After validation, we know files has exactly 2 elements
        const baseImageFile = files[0];
        const logoImageFile = files[1];
        // step: Store BOTH ORIGINAL images in Cloudinary and DB
        // Store base image
        const { public_id: basePublicId, secure_url: baseSecureUrl } = await (0, cloudinary_service_1.uploadSingleFile)({
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
            status: "completed",
            tags: ["base-image", "merge-operation"],
            title: `Base - ${baseImageFile.originalname}`,
            description: "Base image for logo merging",
            category: "other",
            isPublic: false,
            views: 0,
            downloads: 0,
        });
        // Store logo image
        const { public_id: logoPublicId, secure_url: logoSecureUrl } = await (0, cloudinary_service_1.uploadSingleFile)({
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
            status: "completed",
            tags: ["logo", "merge-operation"],
            title: `Logo - ${logoImageFile.originalname}`,
            description: "Logo image for merging",
            category: "other",
            isPublic: false,
            views: 0,
            downloads: 0,
        });
        // step: Use AI/Sharp to merge logo to image
        // This function returns a Buffer of the processed image
        const mergedImageBuffer = await (0, gen_merge_logo_to_img_1.genMergeLogoToImgFn)(baseImageFile.path, logoImageFile.path, {
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
        const { public_id: mergedPublicId, secure_url: mergedSecureUrl } = await (0, cloudinary_service_1.uploadSingleFile)({
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
                    operation: "custom",
                    provider: "custom",
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
            status: "completed",
            tags: ["merged", "logo-watermark", "genAI"],
            title: `Merged - ${baseImageFile.originalname}`,
            description: `Base image with ${logoImageFile.originalname} logo overlay`,
            category: "other",
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
        if (fs.existsSync(baseImageFile.path))
            fs.unlinkSync(baseImageFile.path);
        if (fs.existsSync(logoImageFile.path))
            fs.unlinkSync(logoImageFile.path);
        // step: Delete the generated temp file
        if (fs.existsSync(tempMergedPath))
            fs.unlinkSync(tempMergedPath);
        return (0, successHandler_1.successHandler)({
            res,
            result: {
                baseImage,
                logoImage,
                mergedImage,
                message: "Images merged successfully",
            },
        });
    };
}
exports.ImageServices = ImageServices;
