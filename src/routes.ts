import { Router } from "express";
const router = Router();
import userRouter from "./modules/user/user.controller";
import authRouter from "./modules/auth/auth.controller";
import imageRouter from "./modules/image/image.controller";

router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/image", imageRouter);

export default router;
