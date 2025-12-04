"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageServices = void 0;
const fs_1 = __importDefault(require("fs"));
const image_model_1 = require("../image/image.model");
const Errors_1 = require("../../utils/Errors");
const successHandler_1 = require("../../utils/successHandler");
const pagination_1 = require("../../utils/pagination");
const cloudinary_service_1 = require("../../utils/cloudinary/cloudinary.service");
const mongoose_1 = __importDefault(require("mongoose"));
const removeBackground_1 = require("../../utils/ai/removeBackground");
const win32_1 = __importDefault(require("path/win32"));
class ImageServices {
    constructor() { }
    getAllImages = async (req, res, next) => {
        const { isPublic, category, tags, page = 1, size = 20 } = req.query;
        const userId = res.locals.user?._id?.toString();
        if (!userId) {
            throw new Errors_1.ApplicationException("User not authenticated", 401);
        }
        const query = { deletedAt: null, user: userId };
        if (typeof isPublic !== "undefined") {
            query.isPublic = isPublic === "true";
        }
        if (category) {
            query.category = category;
        }
        if (tags) {
            query.tags = { $all: tags.split(",") };
        }
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
        console.log("IMAGES RESULT => ", images);
        if (!images.length) {
            return (0, successHandler_1.successHandler)({
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
    deleteImage = async (req, res, next) => {
        const imageId = req.params.imageId;
        const userId = res.locals.user?._id?.toString();
        if (!imageId || !mongoose_1.default.Types.ObjectId.isValid(imageId)) {
            throw new Errors_1.ApplicationException("Invalid image ID", 400);
        }
        if (!userId || !mongoose_1.default.Types.ObjectId.isValid(userId)) {
            throw new Errors_1.ApplicationException("User not authenticated", 401);
        }
        const imageExist = {
            _id: new mongoose_1.default.Types.ObjectId(imageId),
            user: new mongoose_1.default.Types.ObjectId(userId),
            deletedAt: null,
        };
        const image = await image_model_1.ImageModel.findOne(imageExist);
        if (!image) {
            throw new Errors_1.ApplicationException("Image not found or already deleted", 404);
        }
        await (0, cloudinary_service_1.destroySingleFile)({ public_id: image.storageKey });
        image.status = "deleted";
        image.deletedAt = new Date();
        await image.save();
        return (0, successHandler_1.successHandler)({
            res,
            message: "Image deleted successfully",
            result: {
                _id: image._id,
                deletedAt: image.deletedAt,
            },
        });
    };
    uploadImageWithoutBackground = async (req, res, next) => {
        const userId = res.locals.user?._id?.toString();
        if (!userId)
            throw new Errors_1.ApplicationException("User not authenticated", 401);
        if (!req.file)
            throw new Errors_1.ApplicationException("No image uploaded", 400);
        const tmpFolder = win32_1.default.join(__dirname, "../../tmp");
        if (!fs_1.default.existsSync(tmpFolder))
            fs_1.default.mkdirSync(tmpFolder, { recursive: true });
        const fileBuffer = fs_1.default.readFileSync(req.file.path);
        const base64Image = fileBuffer.toString("base64");
        const resultBase64 = await (0, removeBackground_1.removeBackgroundFromImageBase64)({
            imageBase64: base64Image,
        });
        const tmpFilePath = win32_1.default.join(tmpFolder, `no-bg-${Date.now()}.png`);
        fs_1.default.writeFileSync(tmpFilePath, Buffer.from(resultBase64, "base64"));
        const projectFolder = process.env.PROJECT_FOLDER || "DefaultProjectFolder";
        const { public_id, secure_url } = await (0, cloudinary_service_1.uploadSingleFile)({
            fileLocation: tmpFilePath,
            storagePathOnCloudinary: `${projectFolder}/${userId}/no-bg`,
        });
        console.log(public_id);
        const newImage = await image_model_1.ImageModel.create({
            user: new mongoose_1.default.Types.ObjectId(userId),
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
        fs_1.default.unlinkSync(req.file.path);
        fs_1.default.unlinkSync(tmpFilePath);
        return (0, successHandler_1.successHandler)({
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
exports.ImageServices = ImageServices;
