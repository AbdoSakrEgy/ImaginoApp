import { Router } from "express";
const router = Router();
import userRouter from "./modules/user/user.controller";
import authRouter from "./modules/auth/auth.controller";

router.use("/auth", authRouter);
router.use("/user", userRouter);

export default router;
