import { auth } from './../../middlewares/auth.middleware';
import { Router } from "express";
import { ImageServices } from "./image.service";

const router = Router();





const imageServices = new ImageServices();

router.get("/getall", auth, imageServices.getAllImages);




export default router;