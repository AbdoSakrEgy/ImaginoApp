import mongoose, { model, Schema } from "mongoose";
import { IImage } from "../../types/image.module.types";

const imageSchema = new Schema<IImage>(
  {
    // User who owns/created this image
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    // Version control - parent/child relationships for edit history
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "image",
      default: null,
    },
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "image",
      },
    ],

    // Is this the original upload or an edited version?
    isOriginal: {
      type: Boolean,
      default: true,
    },
    // is background only image
    isBackgroundOnly: {
      type: Boolean,
      default: false,
    },
    // Version number for edits
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
        parameters: { type: Schema.Types.Mixed }, // Model-specific params
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

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
  let current: any = this;
  while (current.parentId) {
    current = await ImageModel.findById(current.parentId);
    if (!current) break;
  }
  return current;
};

// Method to get all versions in order
imageSchema.methods.getAllVersions = async function () {
  const root = await this.getRootImage();
  const versions = [root];

  async function getChildren(parentId: any) {
    const children = await ImageModel.find({ parentId }).sort({ createdAt: 1 });
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
    const parent = await ImageModel.findById(this.parentId);
    if (parent) {
      this.version = parent.version + 1;
      this.isOriginal = false;

      // Add this image to parent's children
      await ImageModel.findByIdAndUpdate(this.parentId, {
        $addToSet: { children: this._id },
      });
    }
  }
});

export const ImageModel = model<IImage>("image", imageSchema);
