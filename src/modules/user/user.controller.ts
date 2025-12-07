import { Router } from "express";
import { UserServices } from "./user.service";
import { auth } from "../../middlewares/auth.middleware";
import { validation } from "../../middlewares/validation.middleware";
import {
  updateBasicInfoSchema,
  uploadProfileImageSchema,
  payWithStripeSchema,
} from "./user.validation";
import { fileTypes, multerUpload, StoreInEnum } from "../../utils/multer/multer.upload";
import { authPlans } from "../../middlewares/auth.plans.middleware";
import { PricingPlanEnum } from "../../types/user.module.types";
const router = Router();
const userServices = new UserServices();

router.get("/user-profile", auth, authPlans([PricingPlanEnum.FREE]), userServices.userProfile);
router.get("/user-profile/:userId", auth, userServices.userProfile);
router.patch("/upload-profile-image",auth,multerUpload({ storeIn: StoreInEnum.disk, sendedFileDest: "profile" }).single("profileImage"),validation(uploadProfileImageSchema),userServices.uploadProfileImage,);
router.delete("/delete-profile-image", auth, userServices.deleteProfileImage);
router.patch("/update-basic-info",auth,validation(updateBasicInfoSchema),userServices.updateBasicInfo,);
router.post("/pay-with-stripe", auth, validation(payWithStripeSchema), userServices.payWithStripe);
router.post("/web-hook-with-stripe", userServices.webHookWithStripe);
router.get("/get-user-gallery", auth, userServices.getUserImages);

export default router;
