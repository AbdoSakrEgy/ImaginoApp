"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_middleware_1 = require("./../../middlewares/auth.middleware");
const express_1 = require("express");
const image_service_1 = require("./image.service");
const router = (0, express_1.Router)();
const imageServices = new image_service_1.ImageServices();
router.get("/getall", auth_middleware_1.auth, imageServices.getAllImages);
exports.default = router;
