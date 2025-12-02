"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalleryModel = void 0;
const mongoose_1 = require("mongoose");
const gallerySchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true, trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    tags: {
        type: [String],
        default: ["avatar"]
    },
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
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    status: {
        type: String,
        enum: ["public", "private"],
        default: "private"
    },
    deletedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "user",
        required: false
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// gallerySchema.pre(
//     "save",
//     async function (this: HydratedDocument<IGalleryDocument>): Promise<void> {
//         this.isFirstCreation = this.isNew;
//     }
// );
gallerySchema.virtual("imageCount").get(function () {
    return this.images.length;
});
// model
exports.GalleryModel = (0, mongoose_1.model)("gallery", gallerySchema);
