import { NextFunction, Request, Response } from "express";
import mongoose, { Types } from "mongoose";
export type GalleryStatusType = "public" | "private";


export const GalleryStatus = {
    PUBLIC: "public",
    PRIVATE: "private",
};
Object.freeze(GalleryStatus);

export interface IGalleryDocument extends IGallery {
    isFirstCreation?: boolean;
}

export interface IGallery {
    title: string;
    description: string;
    tags: string[];

    images: {
        secure_url: string;
        public_id: string;
        width?: number;
        height?: number;
        sizeKB?: number;
    }[];


    status: GalleryStatusType,
    userId: mongoose.Schema.Types.ObjectId;
    deletedBy?: mongoose.Schema.Types.ObjectId;

    createdAt: Date;
    updatedAt: Date;
}

export interface IGalleryServices {
    uploadGallery(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response>;
    // updateGallery(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    // ): Promise<Response>;
    // deleteGallery(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    // ): Promise<Response>;
    // getGallery(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    // ): Promise<Response>;
    // getAllGalleries(
    //     req: Request,
    //     res: Response,
    //     next: NextFunction
    // ): Promise<Response>;

}
