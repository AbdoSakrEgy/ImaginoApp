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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.genInhancedQualityImgFn = genInhancedQualityImgFn;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sharp_1 = __importDefault(require("sharp"));
/**
 * Enhance image quality using Sharp library
 * This is a FREE, local solution that provides excellent quality enhancement
 * without relying on external paid APIs
 *
 * @param imagePath - Path to the input image file
 * @returns Buffer containing the enhanced image
 */
async function genInhancedQualityImgFn(imagePath) {
    try {
        // console.log("🚀 Starting image quality enhancement...");
        // Read the input image
        const imageBuffer = fs.readFileSync(imagePath);
        // console.log("� Processing image with Sharp for enhancement...");
        // Get original image metadata
        const metadata = await (0, sharp_1.default)(imageBuffer).metadata();
        const originalWidth = metadata.width || 1000;
        const originalHeight = metadata.height || 1000;
        // Calculate new dimensions (2x upscale)
        const newWidth = originalWidth;
        const newHeight = originalHeight;
        // console.log(
        //   `� Upscaling from ${originalWidth}x${originalHeight} to ${newWidth}x${newHeight}`
        // );
        // Enhance the image using Sharp
        const enhancedBuffer = await (0, sharp_1.default)(imageBuffer)
            // Resize with high-quality Lanczos3 algorithm
            .resize(newWidth, newHeight, {
            kernel: sharp_1.default.kernel.lanczos3,
            fit: "fill",
        })
            // Sharpen the image for better clarity
            .sharpen({
            sigma: 2.5,
            m1: 1.5,
            m2: 0.5,
            x1: 3,
            y2: 15,
            y3: 15,
        })
            // Enhance contrast and brightness
            .modulate({
            brightness: 1.10, // Slight brightness boost
            saturation: 1.25, // Slight saturation boost
        })
            // Apply slight gamma correction for better tonal range
            .gamma(1.1)
            // Normalize to improve overall quality
            .normalize()
            // Convert to high-quality PNG
            .png({
            quality: 100,
            compressionLevel: 6,
            adaptiveFiltering: true,
        })
            .toBuffer();
        // console.log(
        //   `✨ Image enhanced successfully! Size: ${enhancedBuffer.length} bytes`
        // );
        return enhancedBuffer;
    }
    catch (error) {
        // console.error("❌ Error in genInhancedQualityImgFn:", error);
        throw error;
    }
}
/**
 * Get MIME type from file extension
 */
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    };
    return mimeTypes[ext] || "image/jpeg";
}
