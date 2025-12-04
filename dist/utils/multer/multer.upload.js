"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.multerUpload = exports.fileTypes = exports.StoreInEnum = void 0;
const multer_1 = __importDefault(require("multer"));
const Errors_1 = require("../Errors");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
var StoreInEnum;
(function (StoreInEnum) {
    StoreInEnum["disk"] = "disk";
    StoreInEnum["memory"] = "memory";
})(StoreInEnum || (exports.StoreInEnum = StoreInEnum = {}));
exports.fileTypes = {
    image: ["image/jpg", "image/jpeg", "image/png", "image/gif", "image/webp"],
    video: ["video/mp4", "video/webm"],
};
const multerUpload = ({ sendedFileDest = "general", sendedFileType = exports.fileTypes.image, storeIn = StoreInEnum.memory, }) => {
    const storage = storeIn === StoreInEnum.memory
        ? multer_1.default.memoryStorage()
        : multer_1.default.diskStorage({
            destination: (req, file, cb) => {
                const userId = req.user?._id?.toString() || "anonymous";
                const fullDest = path_1.default.join("uploads", sendedFileDest, userId);
                if (!fs_1.default.existsSync(fullDest)) {
                    fs_1.default.mkdirSync(fullDest, { recursive: true });
                }
                cb(null, fullDest);
            },
            filename: (req, file, cb) => {
                const timestamp = Date.now();
                const ext = path_1.default.extname(file.originalname);
                const name = path_1.default.basename(file.originalname, ext);
                cb(null, `${name}-${timestamp}${ext}`);
            },
        });
    const fileFilter = (req, file, cb) => {
        if (file.size > 200 * 1024 * 1024 && storeIn === StoreInEnum.memory) {
            return cb(new Errors_1.ApplicationException("Use disk not memory", 400), false);
        }
        else if (!sendedFileType.includes(file.mimetype)) {
            return cb(new Errors_1.ApplicationException("Invalid file format", 400), false);
        }
        cb(null, true);
    };
    return (0, multer_1.default)({ storage, fileFilter });
};
exports.multerUpload = multerUpload;
