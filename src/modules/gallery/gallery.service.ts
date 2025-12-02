import { Request, Response, NextFunction } from "express";
import { HydratedDocument } from "mongoose";
import { IGallery, IGalleryServices } from "../../types/gallery.modules.types";
import { GalleryModel } from "../../modules/gallery/gallery.model";
import {
    uploadManyFiles,
    destroyManyFiles,
} from "../../utils/multer/cloudinary.services";
import { successHandler } from "../../utils/successHandler";
import { ApplicationException } from "../../utils/Errors";

export class GalleryServices implements IGalleryServices {
    constructor() { }

    // ============================ UploadGallery ============================
    uploadGallery = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response> => {
        const userId = res.locals.user._id.toString();
        const { title, desc, tag, status } = req.body
        if (!userId) throw new ApplicationException("Unauthorized", 401);

        if (!req.files || req.files.length === 0) {
            throw new ApplicationException("Please upload images", 400);
        }
        console.log(req.files);

        const files = Array.isArray(req.files) ? req.files : [req.files];
        const filePaths = files.map((f: any) => f.path);

        const uploadedImages = await uploadManyFiles({
            fileLocationArr: filePaths,
            storagePathOnCloudinary: `${process.env.PROJECT_FOLDER}/Gallery/${userId}`,
        });

        const gallery: HydratedDocument<IGallery> = await GalleryModel.create({
            title: title,
            description: desc,
            tags: tag || [],
            images: uploadedImages,
            userId,
            status: status || "private",
        });

        return successHandler({
            res,
            message: "Gallery created successfully",
            result: gallery,
        });
    };

    // // ============================ updateGallery ============================
    // updateGallery = async (
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    // ): Promise<Response> => {
    //     const { id } = req.params;
    //     const gallery = await GalleryModel.findById(id);
    //     if (!gallery) throw new ApplicationException("Gallery not found", 404);

    //     // Delete old images if new ones uploaded
    //     if (req.files && req.files.length > 0) {
    //         const oldPublicIds = gallery.images.map((img) => img.public_id);
    //         await destroyManyFiles({ public_ids: oldPublicIds });

    //         const files = Array.isArray(req.files) ? req.files : [req.files];
    //         const filePaths = files.map((f: any) => f.path);

    //         const uploadedImages = await uploadManyFiles({
    //             fileLocationArr: filePaths,
    //             storagePathOnCloudinary: `Gallery/${gallery.userId}`,
    //         });

    //         gallery.images = uploadedImages;
    //     }

    //     if (req.body.title) gallery.title = req.body.title;
    //     if (req.body.description) gallery.description = req.body.description;
    //     if (req.body.tags) gallery.tags = req.body.tags;
    //     if (req.body.status) gallery.status = req.body.status;

    //     const updatedGallery = await gallery.save();

    //     return successHandler({
    //         res,
    //         message: "Gallery updated successfully",
    //         result: updatedGallery,
    //     });
    // };
}