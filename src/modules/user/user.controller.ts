import { Router } from "express";
import { UserServices } from "./user.service";
import { auth } from "../../middlewares/auth.middleware";
import { validation } from "../../middlewares/validation.middleware";
import {
  deleteMultiFilesSchema,
  createPresignedUrlToGetFileSchema,
  updateBasicInfoSchema,
  uploadAvatarImageSchema,
  uploadProfileImageSchema,
  uploadProfileVideoSchema,
} from "./user.validation";
import {
  fileTypes,
  multerUpload,
  StoreInEnum,
} from "../../utils/multer/multer.upload";
const router = Router();
const userServices = new UserServices();

router.get("/user-profile", auth, userServices.userProfile);
router.get("/user-profile/:userId", auth, userServices.userProfile);
router.patch(
  "/upload-profile-image",
  auth,
  multerUpload({}).single("profileImage"),
  validation(uploadProfileImageSchema),
  userServices.uploadProfileImage
);
//! next api after use it from browser is generate => Error [ERR_HTTP_HEADERS_SENT]...
router.get("/get-file/*path", userServices.getFile);
router.get(
  "/create-presignedUrl-toGetFile/*path",
  validation(createPresignedUrlToGetFileSchema),
  userServices.createPresignedUrlToGetFile
);
router.delete("/delete-file/*path", userServices.deleteFile);
router.delete(
  "/delete-multi-files",
  validation(deleteMultiFilesSchema),
  userServices.deleteMultiFiles
);
router.patch(
  "/update-basic-info",
  auth,
  validation(updateBasicInfoSchema),
  userServices.updateBasicInfo
);

export default router;
