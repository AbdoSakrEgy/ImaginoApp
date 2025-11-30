"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const gallery_service_1 = require("./gallery.service");
const multer_upload_1 = require("../../utils/multer/multer.upload");
const router = (0, express_1.Router)();
const galleryServices = new gallery_service_1.GalleryServices();
const upload = (0, multer_upload_1.multerUpload)({
    sendedFileDest: 'Gallery',
    sendedFileType: ['image/jpg', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    storeIn: multer_upload_1.StoreInEnum.disk,
});
router.post('/upload', auth_middleware_1.auth, upload.array('image', 3), galleryServices.uploadGallery);
exports.default = router;
