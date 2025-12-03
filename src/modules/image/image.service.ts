// services/image.service.ts
import { Request, Response, NextFunction } from "express";
import { ImageModel } from "../image/image.model";
import { IImageServices } from "../../types/image.module.types";
import { ApplicationException } from "../../utils/Errors";
import { successHandler } from "../../utils/successHandler";
import { paginationFunction } from "../../utils/pagination";

export class ImageServices implements IImageServices {
  constructor() {}

  getAllImages = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const {isPublic, category, tags, page = 1, size = 20 } = req.query;
    const userId = res.locals.user._id.toString();


    const query: any = { deletedAt: null };

    if (userId) query.user = userId;
    if (typeof isPublic !== "undefined") query.isPublic = isPublic === "true";
    if (category) query.category = category;
    if (tags) query.tags = { $all: (tags as string).split(",") };

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
          "user url thumbnailUrl storageKey filename mimeType size dimensions tags title description category isPublic views downloads createdAt updatedAt"
        ),
      ImageModel.countDocuments(query),
    ]);

    if (!images) {
      throw new ApplicationException("Failed to fetch images", 500);
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
}



