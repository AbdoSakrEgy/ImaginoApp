"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFolder = exports.deleteByPrefix = exports.destroyManyFiles = exports.destroySingleFile = exports.uploadManyFiles = exports.uploadSingleFile = void 0;
// config
const cloudinary = require("cloudinary").v2;
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET,
    secure: true,
});
// uploadSingleFile
const uploadSingleFile = async ({ fileLocation, storagePathOnCloudinary = "ImaginoApp", }) => {
    const { public_id, secure_url } = await cloudinary.uploader.upload(fileLocation, {
        folder: `${process.env.APP_NAME}/${storagePathOnCloudinary}`,
    });
    //* If you used returned secure_url will not work, you have to modify it to be sutiable for browsers
    return { public_id, secure_url };
};
exports.uploadSingleFile = uploadSingleFile;
// uploadManyFiles
const uploadManyFiles = async ({ fileLocationArr = [], storagePathOnCloudinary = "ImaginoApp", }) => {
    let images = [];
    for (const item of fileLocationArr) {
        const { public_id, secure_url } = await (0, exports.uploadSingleFile)({
            fileLocation: item,
            storagePathOnCloudinary,
        });
        images.push({ public_id, secure_url });
    }
    return images;
};
exports.uploadManyFiles = uploadManyFiles;
// destroySingleFile
const destroySingleFile = async ({ public_id }) => {
    await cloudinary.uploader.destroy(public_id);
};
exports.destroySingleFile = destroySingleFile;
// destroyManyFiles
const destroyManyFiles = async ({ public_ids = [] }) => {
    await cloudinary.api.delete_resources(public_ids);
};
exports.destroyManyFiles = destroyManyFiles;
// deleteByPrefix
const deleteByPrefix = async ({ storagePathOnCloudinary, }) => {
    await cloudinary.api.delete_resources_by_prefix(`${process.env.APP_NAME}/${storagePathOnCloudinary}`);
};
exports.deleteByPrefix = deleteByPrefix;
// deleteFolder
const deleteFolder = async ({ storagePathOnCloudinary, }) => {
    await cloudinary.api.delete_folder(`${process.env.APP_NAME}/${storagePathOnCloudinary}`);
};
exports.deleteFolder = deleteFolder;
