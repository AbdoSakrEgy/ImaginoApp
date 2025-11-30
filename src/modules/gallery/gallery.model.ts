import mongoose, { Schema, model, HydratedDocument } from "mongoose";
import { IGallery, GalleryStatus, IGalleryDocument } from "../../types/gallery.modules.types";

const gallerySchema = new Schema<IGallery>(
    {
        title: { type: String, required: true, trim: true, maxlength: 100 },
        description: { type: String, trim: true, maxlength: 500 },
        tags: { type: [String], default: [] },

        images: [
            {
                secure_url: { type: String, required: true },
                public_id: { type: String, required: true },
                width: { type: Number },
                height: { type: Number },
                sizeKB: { type: Number },
            },
        ],

        userId: {
            type: Schema.Types.ObjectId,
            ref: "user",
            required: true
        },
        status: {
            type: String,
            enum: ["public", "private"],
            default: "private"
        },
        deletedBy: {
            type: Schema.Types.ObjectId,
            ref: "user",
            required: false
        },
    },
    {
        timestamps: true,

    }
);

gallerySchema.pre(
    "save",
    async function (this: HydratedDocument<IGalleryDocument>): Promise<void> {
        this.isFirstCreation = this.isNew;
    }
);


gallerySchema.virtual("imageCount").get(function () {
    return this.images.length;
});

// model
export const GalleryModel = model<IGallery>("gallery", gallerySchema);
