"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserServices = void 0;
const user_model_1 = require("./user.model");
const successHandler_1 = require("../../utils/successHandler");
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
        return (0, successHandler_1.successHandler)({ res });
    };
    // ============================ getFile ============================
    getFile = async (req, res, next) => {
        (0, successHandler_1.successHandler)({ res });
    };
    // ============================ createPresignedUrlToGetFile ============================
    createPresignedUrlToGetFile = async (req, res, next) => {
        return (0, successHandler_1.successHandler)({ res });
    };
    // ============================ deleteFile ============================
    deleteFile = async (req, res, next) => {
        return (0, successHandler_1.successHandler)({ res });
    };
    // ============================ deleteMultiFiles ============================
    deleteMultiFiles = async (req, res, next) => {
        return (0, successHandler_1.successHandler)({ res });
    };
    // ============================ updateBasicInfo ============================
    updateBasicInfo = async (req, res, next) => {
        return (0, successHandler_1.successHandler)({ res });
    };
}
exports.UserServices = UserServices;
