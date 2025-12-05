import fs from 'fs';
import { Request, Response, NextFunction } from "express";
import { ImageModel } from "../image/image.model";
import { IImageServices } from "../../types/image.module.types";
import { ApplicationException } from "../../utils/Errors";
import { successHandler } from "../../utils/successHandler";
import { paginationFunction } from "../../utils/pagination";
import { destroySingleFile, uploadSingleFile } from "../../utils/cloudinary/cloudinary.service";
import mongoose from "mongoose";
import { removeBackgroundFromImageBase64 } from "../../utils/ai/removeBackground";
import path from 'path';
import { generateSuitableBackgrounds } from '../../utils/ai/generateSuitableBackgrounds';
import axios from 'axios';
import FormData from "form-data";
import fetch from "node-fetch";


export class ImageServices implements IImageServices {
    constructor() { }

    getAllImages = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response> => {
        const { isPublic, category, tags, page = 1, size = 20 } = req.query;

        const userId = res.locals.user?._id?.toString();
        if (!userId) {
            throw new ApplicationException("User not authenticated", 401);
        }

        const query: any = { deletedAt: null, user: userId };

        if (typeof isPublic !== "undefined") {
            query.isPublic = isPublic === "true";
        }

        if (category) {
            query.category = category;
        }

        if (tags) {
            query.tags = { $all: (tags as string).split(",") };
        }

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
        console.log("IMAGES RESULT => ", images);


        if (!images.length) {
            return successHandler({
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


    deleteImage = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response> => {
        const imageId = req.params.imageId;
        const userId = res.locals.user?._id?.toString();

        if (!imageId || !mongoose.Types.ObjectId.isValid(imageId)) {
            throw new ApplicationException("Invalid image ID", 400);
        }

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            throw new ApplicationException("User not authenticated", 401);
        }

        const imageExist: any = {
            _id: new mongoose.Types.ObjectId(imageId),
            user: new mongoose.Types.ObjectId(userId),
            deletedAt: null,
        };

        const image = await ImageModel.findOne(imageExist);

        if (!image) {
            throw new ApplicationException("Image not found or already deleted", 404);
        }

        await destroySingleFile({ public_id: image.storageKey });

        image.status = "deleted";
        image.deletedAt = new Date();
        await image.save();

        return successHandler({
            res,
            message: "Image deleted successfully",
            result: {
                _id: image._id,
                deletedAt: image.deletedAt,
            },
        });
    };


    uploadImageWithoutBackground = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response> => {
        const userId = res.locals.user?._id?.toString();
        if (!userId) throw new ApplicationException("User not authenticated", 401);
        if (!req.file) throw new ApplicationException("No image uploaded", 400);

        const tmpFolder = path.join(__dirname, "../../tmp");
        if (!fs.existsSync(tmpFolder)) fs.mkdirSync(tmpFolder, { recursive: true });

        const fileBuffer = fs.readFileSync(req.file.path);
        const base64Image = fileBuffer.toString("base64");

        const resultBase64 = await removeBackgroundFromImageBase64({
            imageBase64: base64Image,
        });

        const tmpFilePath = path.join(tmpFolder, `no-bg-${Date.now()}.png`);
        fs.writeFileSync(tmpFilePath, Buffer.from(resultBase64, "base64"));

        const projectFolder = process.env.PROJECT_FOLDER || "DefaultProjectFolder";

        const { public_id, secure_url } = await uploadSingleFile({
            fileLocation: tmpFilePath,
            storagePathOnCloudinary: `${projectFolder}/${userId}/no-bg`,
        });
        console.log(public_id);


        const newImage = await ImageModel.create({
            user: new mongoose.Types.ObjectId(userId),
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

        fs.unlinkSync(req.file.path);
        fs.unlinkSync(tmpFilePath);

        return successHandler({
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

    generateSuitableBackgroundsFromImage = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response> => {
        const userId = res.locals.user?._id?.toString();
        if (!userId) throw new ApplicationException("User not authenticated", 401);

        const { imageId } = req.params;
        if (!imageId || !mongoose.Types.ObjectId.isValid(imageId))
            throw new ApplicationException("Invalid image ID", 400);

        // جلب الصورة من DB
        const image = await ImageModel.findOne({
            _id: new mongoose.Types.ObjectId(imageId),
            user: new mongoose.Types.ObjectId(userId),
            deletedAt: null,
        });
        if (!image) throw new ApplicationException("Image not found", 404);

        const tmpFolder = path.join(__dirname, "../../tmp");
        if (!fs.existsSync(tmpFolder)) fs.mkdirSync(tmpFolder, { recursive: true });

        // حفظ الصورة مؤقتًا
        const tmpImagePath = path.join(tmpFolder, `input-${Date.now()}.png`);
        const response = await fetch(image.url);
        const arrayBuffer = await response.arrayBuffer();
        fs.writeFileSync(tmpImagePath, Buffer.from(arrayBuffer));

        // إعداد Replicate API
        if (!process.env.REPLICATE_API_KEY)
            throw new ApplicationException("REPLICATE_API_KEY missing", 500);

        const replicateResponse = await axios.post(
            "https://api.replicate.com/v1/predictions",
            {
                version: "a9758c6e0e16d6a8c3f8480c7b2c4f4c9f0c0a9e0f3b6c0a4d1e5c6b7d8f9a0b", // مثال على Stable Diffusion model
                input: {
                    image: fs.createReadStream(tmpImagePath),
                    prompt:
                        "Generate a clean, studio-style background suitable for product showcase",
                    num_outputs: 4,
                },
            },
            {
                headers: {
                    Authorization: `Token ${process.env.REPLICATE_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const outputs = replicateResponse.data?.output || [];
        const savedImages: any[] = [];
        const projectFolder = process.env.PROJECT_FOLDER || "DefaultProjectFolder";

        for (const base64 of outputs) {
            const tmpOutputPath = path.join(tmpFolder, `bg-${Date.now()}-${Math.random()}.png`);
            fs.writeFileSync(tmpOutputPath, Buffer.from(base64, "base64"));

            const { public_id, secure_url } = await uploadSingleFile({
                fileLocation: tmpOutputPath,
                storagePathOnCloudinary: `${projectFolder}/${userId}/replicate-bg`,
            });

            const newImage = await ImageModel.create({
                user: new mongoose.Types.ObjectId(userId),
                url: secure_url,
                storageKey: public_id,
                filename: "generated-background.png",
                mimeType: "image/png",
                size: Buffer.from(base64, "base64").length,
                dimensions: { width: 0, height: 0 },
                status: "completed",
                isPublic: false,
                aiEdits: [
                    {
                        operation: "custom",
                        provider: "replicate",
                        prompt: "Generated suitable background for product",
                        parameters: { count: 4 },
                        timestamp: new Date(),
                        processingTime: 0,
                        cost: 0,
                    },
                ],
            });

            savedImages.push({
                _id: newImage._id,
                url: newImage.url,
                storageKey: newImage.storageKey,
                aiEdits: newImage.aiEdits,
            });

            fs.unlinkSync(tmpOutputPath);
        }

        fs.unlinkSync(tmpImagePath);

        return successHandler({
            res,
            message: "Generated suitable backgrounds successfully (Replicate)",
            result: savedImages,
        });
    };
}











