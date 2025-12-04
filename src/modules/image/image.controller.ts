import { Router } from "express";
import { auth } from "../../middlewares/auth.middleware";
import { ImageServices } from "./image.service";
import { multerUpload } from "../../utils/multer/multer.upload";
const router = Router();
const imageServices = new ImageServices();

router.get("/git-image", auth, imageServices.gitImage);
router.delete("/delete-image", auth, imageServices.deleteImage);
router.post("/gen-img-without-background", auth, imageServices.genImgWithoutBackground);
router.post("/gen-sutiable-backgrounds", auth, imageServices.genSutiableBackgrounds);
router.post("/gen-img-with-selected-background", auth, imageServices.genImgWithSelectedBackground);
router.post("/gen-img-with-new-background", auth, imageServices.genImgWithNewBackground);
router.post("/gen-resize-img", auth, imageServices.genResizeImg);
router.post("/gen-img-with-new-dimension", auth,multerUpload({}).single("image"), imageServices.genImgWithNewDimension);
router.post("/gen-inhanced-quality-img", auth,multerUpload({}).single("image"), imageServices.genInhancedQualityImg);
router.post("/gen-merge-logo-to-img", auth,multerUpload({}).array("images"), imageServices.genMergeLogoToImg);

export default router;
