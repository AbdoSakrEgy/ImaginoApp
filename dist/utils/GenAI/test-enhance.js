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
const gen_inhanced_quality_img_1 = require("./gen.inhanced.quality.img");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
async function test() {
    try {
        console.log("🚀 Starting test...");
        // 1. Download a sample image
        const imageUrl = "https://replicate.delivery/pbxt/IJZ5y825y825y825/out-0.png"; // A sample image or just use a placeholder
        // Actually, let's use a real sample image URL that is likely to exist or just a small one.
        // Let's use a placeholder image service.
        const sampleImageUrl = "https://placehold.co/600x400/png";
        console.log("Downloading sample image...");
        const response = await axios_1.default.get(sampleImageUrl, { responseType: "arraybuffer" });
        const imagePath = path.join(__dirname, "test_image.png");
        fs.writeFileSync(imagePath, response.data);
        console.log(`Saved sample image to ${imagePath}`);
        // 2. Call the function
        console.log("Calling genInhancedQualityImgFn...");
        const result = await (0, gen_inhanced_quality_img_1.genInhancedQualityImgFn)(imagePath);
        // 3. Verify results
        console.log("✅ Function returned successfully");
        console.log("Description:", result.description);
        console.log("Image Buffer Length:", result.image.length);
        console.log("Mime Type:", result.mimeType);
        // 4. Save output
        const outputPath = path.join(__dirname, "test_output.png");
        fs.writeFileSync(outputPath, result.image);
        console.log(`Saved output image to ${outputPath}`);
        // Cleanup
        if (fs.existsSync(imagePath))
            fs.unlinkSync(imagePath);
        if (fs.existsSync(outputPath))
            fs.unlinkSync(outputPath);
    }
    catch (error) {
        console.error("❌ Test failed:", error);
        fs.writeFileSync(path.join(__dirname, "error.log"), JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}
test();
