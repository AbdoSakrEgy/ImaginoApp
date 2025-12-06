import { Request, Response, NextFunction } from "express";
import { Document, Types } from "mongoose";

export interface IAIEdit {
  operation:
    | "remove-background"
    | "enhance"
    | "colorize"
    | "upscale"
    | "inpaint"
    | "outpaint"
    | "style-transfer"
    | "object-removal"
    | "text-to-image"
    | "image-to-image"
    | "custom";
  provider: "openai" | "stability-ai" | "midjourney" | "replicate" | "custom";
  prompt?: string;
  parameters?: Record<string, any>;
  timestamp: Date;
  processingTime?: number;
  cost?: number;
}

export interface IImage extends Document {
  // References
  user: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  children?: Types.ObjectId[];

  // Version control
  isOriginal: boolean;
  version: number;

  isBackgroundOnly: boolean;

  // Storage
  url: string;
  storageKey: string;
  thumbnailUrl?: string;

  // Metadata
  filename: string;
  originalFilename?: string;
  mimeType: string;
  size: number;
  dimensions: {
    width: number;
    height: number;
  };

  // AI editing
  aiEdits: IAIEdit[];

  // Status
  status: "uploading" | "processing" | "completed" | "failed" | "deleted";
  processingError?: string;

  // Organization
  tags: string[];
  title?: string;
  description?: string;
  category?: "portrait" | "landscape" | "product" | "art" | "other";

  // Privacy
  isPublic: boolean;
  shareToken?: string;

  // Usage
  views: number;
  downloads: number;

  // Soft delete
  deletedAt?: Date | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Methods

  // getRootImage(): Promise<IImage | null>;
  // getAllVersions(): Promise<IImage[]>;
}

export interface IImageServices {
  getAllImages(req: Request, res: Response, next: NextFunction): Promise<Response>;
  deleteImage(req: Request, res: Response, next: NextFunction): Promise<Response>;
}

export interface IImageServices {
  deleteImage(req: Request, res: Response, next: NextFunction): Promise<Response>;
}
