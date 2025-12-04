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
exports.genMergeLogoToImgFn = genMergeLogoToImgFn;
const fs = __importStar(require("fs"));
const sharp_1 = __importDefault(require("sharp"));
/**
 * Merge a logo onto a base image using Sharp library
 * This function intelligently positions and scales the logo
 *
 * @param baseImagePath - Path to the base/background image
 * @param logoImagePath - Path to the logo image to overlay
 * @param options - Optional configuration for logo placement
 * @returns Buffer containing the merged image
 */
async function genMergeLogoToImgFn(baseImagePath, logoImagePath, options = {}) {
    try {
        // Default options
        const { position = "bottom-right", opacity = 80, logoScale = 0.15, // Logo will be 15% of base image width by default
        padding = 20, } = options;
        // Read both images
        const baseImageBuffer = fs.readFileSync(baseImagePath);
        const logoImageBuffer = fs.readFileSync(logoImagePath);
        // Get metadata for both images
        const baseMetadata = await (0, sharp_1.default)(baseImageBuffer).metadata();
        const logoMetadata = await (0, sharp_1.default)(logoImageBuffer).metadata();
        const baseWidth = baseMetadata.width || 1000;
        const baseHeight = baseMetadata.height || 1000;
        const logoWidth = logoMetadata.width || 100;
        const logoHeight = logoMetadata.height || 100;
        // Calculate new logo dimensions (maintain aspect ratio)
        const targetLogoWidth = Math.floor(baseWidth * logoScale);
        const logoAspectRatio = logoHeight / logoWidth;
        const targetLogoHeight = Math.floor(targetLogoWidth * logoAspectRatio);
        // Resize and prepare logo with opacity
        const processedLogo = await (0, sharp_1.default)(logoImageBuffer)
            .resize(targetLogoWidth, targetLogoHeight, {
            kernel: sharp_1.default.kernel.lanczos3,
            fit: "contain",
        })
            .png() // Convert to PNG to support transparency
            .toBuffer();
        // Apply opacity to logo
        const logoWithOpacity = await (0, sharp_1.default)(processedLogo)
            .composite([
            {
                input: Buffer.from([255, 255, 255, Math.floor((opacity / 100) * 255)]),
                raw: {
                    width: 1,
                    height: 1,
                    channels: 4,
                },
                tile: true,
                blend: "dest-in",
            },
        ])
            .toBuffer();
        // Calculate position coordinates
        let left = 0;
        let top = 0;
        switch (position) {
            case "top-left":
                left = padding;
                top = padding;
                break;
            case "top-right":
                left = baseWidth - targetLogoWidth - padding;
                top = padding;
                break;
            case "bottom-left":
                left = padding;
                top = baseHeight - targetLogoHeight - padding;
                break;
            case "bottom-right":
                left = baseWidth - targetLogoWidth - padding;
                top = baseHeight - targetLogoHeight - padding;
                break;
            case "center":
                left = Math.floor((baseWidth - targetLogoWidth) / 2);
                top = Math.floor((baseHeight - targetLogoHeight) / 2);
                break;
            case "top-center":
                left = Math.floor((baseWidth - targetLogoWidth) / 2);
                top = padding;
                break;
            case "bottom-center":
                left = Math.floor((baseWidth - targetLogoWidth) / 2);
                top = baseHeight - targetLogoHeight - padding;
                break;
        }
        // Merge logo onto base image
        const mergedBuffer = await (0, sharp_1.default)(baseImageBuffer)
            .composite([
            {
                input: logoWithOpacity,
                top: top,
                left: left,
                blend: "over",
            },
        ])
            .png({
            quality: 100,
            compressionLevel: 6,
        })
            .toBuffer();
        return mergedBuffer;
    }
    catch (error) {
        console.error("❌ Error in genMergeLogoToImgFn:", error);
        throw new Error(`Failed to merge logo to image: ${error.message}`);
    }
}
