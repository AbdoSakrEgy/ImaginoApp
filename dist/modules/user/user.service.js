"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserServices = void 0;
const user_model_1 = require("./user.model");
const successHandler_1 = require("../../utils/successHandler");
const Errors_1 = require("../../utils/Errors");
const cloudinary_services_1 = require("../../utils/multer/cloudinary.services");
class UserServices {
    userModel = user_model_1.UserModel;
    constructor() { }
    // ============================ userProfile ============================
    userProfile = async (req, res, next) => {
        let user = res.locals.user;
        const userId = req.params?.userId;
        // step: if userId existence load that user
        if (userId) {
            const foundUser = await this.userModel.findById(userId);
            if (!foundUser) {
                throw new Errors_1.ApplicationException("User not found", 404);
            }
            user = foundUser;
        }
        return (0, successHandler_1.successHandler)({ res, result: { user } });
    };
    // ============================ uploadProfileImage ============================
    uploadProfileImage = async (req, res, next) => {
        const user = res.locals.user;
        const file = req.file;
        if (!file) {
            throw new Errors_1.ApplicationException("profileImage is required", 400);
        }
        const uploadResult = await (0, cloudinary_services_1.uploadSingleFile)({
            fileLocation: file.path,
            storagePathOnCloudinary: `users/${user._id}/profile`,
        });
        const updatedUser = await this.userModel.findOneAndUpdate({ _id: user._id }, { $set: { profileImage: uploadResult } }, { new: true });
        return (0, successHandler_1.successHandler)({
            res,
            message: "Profile image updated successfully",
            result: { user: updatedUser },
        });
    };
    // ============================ deleteProfileImage ============================
    deleteProfileImage = async (req, res, next) => {
        const user = res.locals.user;
        const currentUser = await this.userModel.findById(user._id);
        if (currentUser?.profileImage?.public_id) {
            await (0, cloudinary_services_1.destroySingleFile)({ public_id: currentUser.profileImage.public_id });
        }
        const updatedUser = await this.userModel.findOneAndUpdate({ _id: user._id }, { $unset: { profileImage: "" } }, { new: true });
        return (0, successHandler_1.successHandler)({
            res,
            message: "Profile image deleted successfully",
            result: { user: updatedUser },
        });
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
        const user = res.locals.user;
        const { firstName, lastName, age, gender, phone } = req.body;
        const updatedUser = await this.userModel.findOneAndUpdate({ _id: user._id }, {
            $set: {
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                ...(age !== undefined && { age }),
                ...(gender && { gender }),
                ...(phone && { phone }),
            },
        }, {
            new: true,
            runValidators: true,
            context: "query",
        });
        return (0, successHandler_1.successHandler)({
            res,
            message: "Basic info updated successfully",
            result: { user: updatedUser },
        });
    };
}
exports.UserServices = UserServices;
