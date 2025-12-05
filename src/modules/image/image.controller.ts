import { StoreInEnum } from './../../utils/multer/multer.upload';
import { auth } from './../../middlewares/auth.middleware';
import { Router } from "express";
import { ImageServices } from "./image.service";
import multer from 'multer';
import { multerUpload } from '../../utils/multer/multer.upload';

const router = Router();





const imageServices = new ImageServices();
const upload = multerUpload({ sendedFileDest: "tmp", storeIn: StoreInEnum.disk });

router.get("/getall", auth, imageServices.getAllImages);
router.delete("/delete/:imageId", auth, imageServices.deleteImage);


router.post(
    "/gen-img-without-background",

    auth,
    upload.single("imageFile"),
    imageServices.uploadImageWithoutBackground
);

router.post(
    "/generate-suitable-bg/:imageId",
    auth,
    imageServices.generateSuitableBackgroundsFromImage
);





export default router;