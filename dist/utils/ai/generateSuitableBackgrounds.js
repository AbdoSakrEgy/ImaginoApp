"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSuitableBackgrounds = void 0;
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const generateSuitableBackgrounds = async (options) => {
    const { imagePath, count = 4 } = options;
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is missing");
    }
    const form = new form_data_1.default();
    form.append("model", "gpt-image-1");
    form.append("n", String(count));
    form.append("size", "1024x1024");
    form.append("prompt", "Generate realistic high-quality backgrounds that are suitable for the subject in the provided image. " +
        "Backgrounds should be clean, studio-style, minimal, wooden table, gradient, or spotlight.");
    form.append("image", fs_1.default.createReadStream(imagePath));
    const response = await axios_1.default.post("https://api.openai.com/v1/images/edits", form, {
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
    });
    return response.data.data.map((item) => item.b64_json);
};
exports.generateSuitableBackgrounds = generateSuitableBackgrounds;
