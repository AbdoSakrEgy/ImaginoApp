"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageServices = void 0;
const image_model_1 = require("../image/image.model");
const Errors_1 = require("../../utils/Errors");
const successHandler_1 = require("../../utils/successHandler");
const pagination_1 = require("../../utils/pagination");
class ImageServices {
    constructor() { }
    // ============================ getAllImages ============================
    getAllImages = async (req, res, next) => {
        const { isPublic, category, tags, page = 1, size = 20 } = req.query;
        const userId = res.locals.user._id.toString();
        const query = { deletedAt: null };
        if (userId)
            query.user = userId;
        if (typeof isPublic !== "undefined")
            query.isPublic = isPublic === "true";
        if (category)
            query.category = category;
        if (tags)
            query.tags = { $all: tags.split(",") };
        const { limit, skip } = (0, pagination_1.paginationFunction)({
            page: Number(page),
            size: Number(size),
        });
        const [images, totalCount] = await Promise.all([
            image_model_1.ImageModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select("user url thumbnailUrl storageKey filename mimeType size dimensions tags title description category isPublic views downloads createdAt updatedAt"),
            image_model_1.ImageModel.countDocuments(query),
        ]);
        if (!images) {
            throw new Errors_1.ApplicationException("Failed to fetch images", 500);
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
        return (0, successHandler_1.successHandler)({
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
exports.ImageServices = ImageServices;
