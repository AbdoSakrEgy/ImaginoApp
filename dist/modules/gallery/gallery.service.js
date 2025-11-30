"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalleryServices = void 0;
const gallery_model_1 = require("../../modules/gallery/gallery.model");
const cloudinary_services_1 = require("../../utils/multer/cloudinary.services");
const successHandler_1 = require("../../utils/successHandler");
const Errors_1 = require("../../utils/Errors");
class GalleryServices {
    constructor() { }
    // ============================ UploadGallery ============================
    uploadGallery = async (req, res, next) => {
        const userId = res.locals.user._id.toString();
        const { title, desc, tag, status } = req.body;
        if (!userId)
            throw new Errors_1.ApplicationException("Unauthorized", 401);
        if (!req.files || req.files.length === 0) {
            throw new Errors_1.ApplicationException("Please upload images", 400);
        }
        console.log(req.files);
        const files = Array.isArray(req.files) ? req.files : [req.files];
        const filePaths = files.map((f) => f.path);
        const uploadedImages = await (0, cloudinary_services_1.uploadManyFiles)({
            fileLocationArr: filePaths,
            storagePathOnCloudinary: `${process.env.PROJECT_FOLDER}/Gallery/${userId}`,
        });
        const gallery = await gallery_model_1.GalleryModel.create({
            title: title,
            description: desc,
            tags: tag || [],
            images: uploadedImages,
            userId,
            status: status || "private",
        });
        return (0, successHandler_1.successHandler)({
            res,
            message: "Gallery created successfully",
            result: gallery,
        });
    };
}
exports.GalleryServices = GalleryServices;
