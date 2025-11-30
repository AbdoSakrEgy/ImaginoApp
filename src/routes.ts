import { Router } from "express";
const router = Router();
import userRouter from "./modules/user/user.controller";
import authRouter from "./modules/auth/auth.controller";
import galleryRouter from "./modules/gallery/gallery.controller";


router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/gallery", galleryRouter);

export default router;
