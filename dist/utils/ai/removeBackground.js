"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeBackgroundFromImageBase64 = void 0;
const axios_1 = __importDefault(require("axios"));
const removeBackgroundFromImageBase64 = async ({ imageBase64, }) => {
    if (!process.env.REMOVE_BG_API_KEY) {
        throw new Error("REMOVE_BG_API_KEY not set in environment");
    }
    const response = await (0, axios_1.default)({
        method: "post",
        url: "https://api.remove.bg/v1.0/removebg",
        data: {
            image_file_b64: imageBase64,
            size: "auto",
            format: "png",
        },
        headers: {
            "X-Api-Key": process.env.REMOVE_BG_API_KEY,
            "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
    });
    const base64Result = Buffer.from(response.data, "binary").toString("base64");
    return base64Result;
};
exports.removeBackgroundFromImageBase64 = removeBackgroundFromImageBase64;
