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
exports.ImageModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const imageSchema = new mongoose_1.Schema({
    // User who owns/created this image
    user: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true,
    },
    // Version control - parent/child relationships for edit history
    parentId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "image",
        default: null,
    },
    children: [
        {
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: "image",
        },
    ],
    // Is this the original upload or an edited version?
    isOriginal: {
        type: Boolean,
        default: true,
    },
    version: {
        type: Number,
        default: 1,
    },
    // Image storage
    url: {
        type: String,
        required: true,
    },
    thumbnailUrl: {
        type: String,
    },
    storageKey: {
        type: String,
        required: true,
    }, // S3/Cloudinary key for deletion
    // Image metadata
    filename: {
        type: String,
        required: true,
    },
    originalFilename: {
        type: String,
    },
    mimeType: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
        required: true,
    }, // bytes
    dimensions: {
        width: { type: Number },
        height: { type: Number },
    },
    // AI editing information
    aiEdits: [
        {
            operation: {
                type: String,
                enum: [
                    "remove-background",
                    "enhance",
                    "colorize",
                    "upscale",
                    "inpaint",
                    "outpaint",
                    "style-transfer",
                    "object-removal",
                    "text-to-image",
                    "image-to-image",
                    "custom",
                ],
                required: true,
            },
            provider: {
                type: String,
                enum: ["openai", "stability-ai", "midjourney", "replicate", "custom"],
                required: true,
            },
            prompt: { type: String }, // For generative operations
            parameters: { type: mongoose_1.Schema.Types.Mixed }, // Model-specific params
            timestamp: { type: Date, default: Date.now },
            processingTime: { type: Number }, // milliseconds
            cost: { type: Number }, // API cost tracking
        },
    ],
    // Current status
    status: {
        type: String,
        enum: ["uploading", "processing", "completed", "failed", "deleted"],
        default: "uploading",
        index: true,
    },
    processingError: { type: String },
    // Organization/categorization
    tags: [{ type: String, index: true }],
    title: { type: String },
    description: { type: String },
    category: {
        type: String,
        enum: ["portrait", "landscape", "product", "art", "other"],
    },
    // Privacy & sharing
    isPublic: {
        type: Boolean,
        default: false,
        index: true,
    },
    shareToken: {
        type: String,
        unique: true,
        sparse: true,
    },
    // Usage tracking
    views: {
        type: Number,
        default: 0,
    },
    downloads: {
        type: Number,
        default: 0,
    },
    // Soft delete
    deletedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Indexes for common queries
imageSchema.index({ user: 1, createdAt: -1 });
imageSchema.index({ user: 1, status: 1 });
imageSchema.index({ parentId: 1 });
imageSchema.index({ deletedAt: 1 });
// Virtual for getting the full edit history
imageSchema.virtual("editHistory", {
    ref: "image",
    localField: "_id",
    foreignField: "parentId",
});
// Method to get root/original image
imageSchema.methods.getRootImage = async function () {
    let current = this;
    while (current.parentId) {
        current = await exports.ImageModel.findById(current.parentId);
        if (!current)
            break;
    }
    return current;
};
// Method to get all versions in order
imageSchema.methods.getAllVersions = async function () {
    const root = await this.getRootImage();
    const versions = [root];
    async function getChildren(parentId) {
        const children = await exports.ImageModel.find({ parentId }).sort({ createdAt: 1 });
        for (const child of children) {
            versions.push(child);
            await getChildren(child._id);
        }
    }
    await getChildren(root._id);
    return versions;
};
// Pre-save hook to update version number
imageSchema.pre("save", async function () {
    if (this.isNew && this.parentId) {
        const parent = await exports.ImageModel.findById(this.parentId);
        if (parent) {
            this.version = parent.version + 1;
            this.isOriginal = false;
            // Add this image to parent's children
            await exports.ImageModel.findByIdAndUpdate(this.parentId, {
                $addToSet: { children: this._id },
            });
        }
    }
});
exports.ImageModel = (0, mongoose_1.model)("image", imageSchema);
