"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserServices = void 0;
const user_model_1 = require("./user.model");
const successHandler_1 = require("../../utils/successHandler");
const S3_services_1 = require("../../utils/multer/S3.services");
const Errors_1 = require("../../utils/Errors");
const util_1 = require("util");
const stream_1 = require("stream");
const createS3WriteStreamPipe = (0, util_1.promisify)(stream_1.pipeline);
class UserServices {
    userModel = user_model_1.UserModel;
    constructor() { }
    // ============================ userProfile ============================
    userProfile = async (req, res, next) => {
        let user = res.locals.user;
        let userId = req.params?.userId;
        // step: if userId existence
        if (userId) {
            user = await this.userModel.findOne({ filter: { _id: userId } });
        }
        userId = user._id;
        return (0, successHandler_1.successHandler)({ res, result: { user } });
    };
    // ============================ uploadProfileImage ============================
    uploadProfileImage = async (req, res, next) => {
        const user = res.locals.user;
        // step: upload image
        const Key = await (0, S3_services_1.uploadSingleSmallFileS3)({
            dest: `users/${user._id}/profileImage`,
            fileFromMulter: req.file,
        });
        // step: update user
        const updatedUser = await this.userModel.findOneAndUpdate({
            filter: { _id: user._id },
            data: { $set: { profileImage: Key } },
        });
        return (0, successHandler_1.successHandler)({
            res,
            message: "Profile image uploaded successfully",
            result: { Key },
        });
    };
    // ============================ getFile ============================
    getFile = async (req, res, next) => {
        const { downloadName } = req.query;
        const path = req.params.path;
        const Key = path.join("/");
        const fileObject = await (0, S3_services_1.getFileS3)({ Key });
        if (!fileObject?.Body) {
            throw new Errors_1.ApplicationExpection("Failed to get file", 400);
        }
        res.setHeader("Content-Type", `${fileObject.ContentType}` || "application/octet-stream");
        if (downloadName) {
            res.setHeader("Content-Disposition", `attachment; filename=${downloadName}`);
        }
        return await createS3WriteStreamPipe(fileObject.Body, res);
    };
    // ============================ createPresignedUrlToGetFile ============================
    createPresignedUrlToGetFile = async (req, res, next) => {
        const { download = false, downloadName = "dumy", } = req.body;
        const path = req.params.path;
        const Key = path.join("/");
        const url = await (0, S3_services_1.createPresignedUrlToGetFileS3)({
            Key,
            download,
            downloadName,
        });
        return (0, successHandler_1.successHandler)({
            res,
            message: "Use this URL to get file",
            result: { url },
        });
    };
    // ============================ deleteFile ============================
    deleteFile = async (req, res, next) => {
        const path = req.params.path;
        const Key = path.join("/");
        const result = await (0, S3_services_1.deleteFileS3)({ Key });
        return (0, successHandler_1.successHandler)({
            res,
            message: "File deleted successfully",
        });
    };
    // ============================ deleteMultiFiles ============================
    deleteMultiFiles = async (req, res, next) => {
        const { Keys, Quiet = false } = req.body;
        const result = await (0, S3_services_1.deleteMultiFilesS3)({ Keys, Quiet });
        return (0, successHandler_1.successHandler)({
            res,
            message: "Files deleted successfully",
        });
    };
    // ============================ updateBasicInfo ============================
    updateBasicInfo = async (req, res, next) => {
        const user = res.locals.user;
        const { firstName, lastName, age, gender, phone } = req.body;
        // step: update basic info
        const updatedUser = await this.userModel.findOneAndUpdate({
            filter: { _id: user._id },
            data: { $set: { firstName, lastName, age, gender, phone } },
        });
        if (!updatedUser) {
            return (0, successHandler_1.successHandler)({
                res,
                message: "Error while update user",
                status: 500,
            });
        }
        return (0, successHandler_1.successHandler)({ res, message: "User updated successfully" });
    };
}
exports.UserServices = UserServices;
