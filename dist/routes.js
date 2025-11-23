"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
const user_controller_1 = __importDefault(require("./modules/user/user.controller"));
const auth_controller_1 = __importDefault(require("./modules/auth/auth.controller"));
router.use("/auth", auth_controller_1.default);
router.use("/user", user_controller_1.default);
exports.default = router;
