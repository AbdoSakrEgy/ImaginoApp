import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware";
import { ImageServices } from "./image.service";
import { multerUpload } from "../../utils/multer/multer.upload";
import { StoreInEnum } from "./../../utils/multer/multer.upload";
const upload = multerUpload({ sendedFileDest: "tmp", storeIn: StoreInEnum.disk });
const router = Router();
const imageServices = new ImageServices();

// Group 1
router.post("/gen-img-with-selected-background", auth, multerUpload({}).single("backgroundImage"), imageServices.genImgWithSelectedBackground,);
router.post("/gen-img-with-new-background", auth, imageServices.genImgWithNewBackground);
router.post("/gen-resize-img", auth, multerUpload({}).single("image"), imageServices.genResizeImg);
router.post("/blur-image-region", auth, multerUpload({}).single("image"), imageServices.blurImageRegion,);
router.get("/get-image", auth, imageServices.getImage);
router.get("/get-last-background-versions/:imageId", auth, imageServices.listBackgroundsForImage);
// Group 2
router.post("/gen-img-with-new-dimension", auth, multerUpload({}).single("image"), imageServices.genImgWithNewDimension,);
router.post("/gen-inhanced-quality-img", auth, multerUpload({}).single("image"), imageServices.genInhancedQualityImg,);
router.post("/gen-merge-logo-to-img", auth, multerUpload({}).array("images"), imageServices.genMergeLogoToImg,);
router.post("/extract-text-from-img", auth, multerUpload({}).single("image"), imageServices.extractTextFromImg,);
router.post("/recognize-items-in-img", auth, multerUpload({}).single("image"), imageServices.recognizeItemsInImage,);
// Group 3
router.get("/getall", auth, imageServices.getAllImages);
router.delete("/delete/:imageId", auth, imageServices.deleteImage);
router.post("/gen-img-without-background", auth, upload.single("imageFile"), imageServices.uploadImageWithoutBackground);
router.post("/gen-suitable-background", auth, imageServices.generateSuitableBackground);
router.post("/gen-change-image-style", auth, multerUpload({ sendedFileDest: "ai-style", sendedFileType: ["image/jpeg", "image/png", "image/webp"], }).single("image"), imageServices.genChangeImageStyle);

export default router;
