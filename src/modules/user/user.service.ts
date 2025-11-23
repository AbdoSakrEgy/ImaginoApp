import { UserModel } from "./user.model";
import { successHandler } from "../../utils/successHandler";
import { NextFunction, Request, Response } from "express";
import {
  deleteMultiFilesDTO,
  createPresignedUrlToGetFileDTO,
  updateBasicInfoDTO,
  uploadAvatarImageDTO,
} from "./user.dto";
import {
  createPreSignedUrlToUploadFileS3,
  uploadMultiFilesS3,
  uploadSingleSmallFileS3,
  uploadSingleLargeFileS3,
  getFileS3,
  createPresignedUrlToGetFileS3,
  deleteFileS3,
  deleteMultiFilesS3,
} from "../../utils/multer/S3.services";
import { HydratedDocument } from "mongoose";
import { StoreInEnum } from "../../utils/multer/multer.upload";
import { ApplicationExpection } from "../../utils/Errors";
import { promisify } from "util";
import { pipeline } from "stream";
import { IUser, IUserServices } from "../../types/user.module.types";
const createS3WriteStreamPipe = promisify(pipeline);

export class UserServices implements IUserServices {
  private userModel = UserModel;

  constructor() {}
  // ============================ userProfile ============================
  userProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    let user = res.locals.user;
    let userId = req.params?.userId;
    // step: if userId existence
    if (userId) {
      user = await this.userModel.findOne({ filter: { _id: userId } });
    }
    userId = user._id;
    return successHandler({ res, result: { user } });
  };

  // ============================ uploadProfileImage ============================
  uploadProfileImage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const user = res.locals.user as HydratedDocument<IUser>;
    // step: upload image
    const Key = await uploadSingleSmallFileS3({
      dest: `users/${user._id}/profileImage`,
      fileFromMulter: req.file as Express.Multer.File,
    });
    // step: update user
    const updatedUser = await this.userModel.findOneAndUpdate({
      filter: { _id: user._id },
      data: { $set: { profileImage: Key } },
    });
    return successHandler({
      res,
      message: "Profile image uploaded successfully",
      result: { Key },
    });
  };


  // ============================ getFile ============================
  getFile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { downloadName } = req.query;
    const path = req.params.path as unknown as string[];
    const Key = path.join("/");
    const fileObject = await getFileS3({ Key });
    if (!fileObject?.Body) {
      throw new ApplicationExpection("Failed to get file", 400);
    }
    res.setHeader(
      "Content-Type",
      `${fileObject.ContentType}` || "application/octet-stream"
    );
    if (downloadName) {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${downloadName}`
      );
    }
    return await createS3WriteStreamPipe(
      fileObject.Body as NodeJS.ReadableStream,
      res
    );
  };

  // ============================ createPresignedUrlToGetFile ============================
  createPresignedUrlToGetFile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const {
      download = false,
      downloadName = "dumy",
    }: createPresignedUrlToGetFileDTO = req.body;
    const path = req.params.path as unknown as string[];
    const Key = path.join("/");
    const url = await createPresignedUrlToGetFileS3({
      Key,
      download,
      downloadName,
    });
    return successHandler({
      res,
      message: "Use this URL to get file",
      result: { url },
    });
  };

  // ============================ deleteFile ============================
  deleteFile = async (req: Request, res: Response, next: NextFunction) => {
    const path = req.params.path as unknown as string[];
    const Key = path.join("/");
    const result = await deleteFileS3({ Key });
    return successHandler({
      res,
      message: "File deleted successfully",
    });
  };

  // ============================ deleteMultiFiles ============================
  deleteMultiFiles = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { Keys, Quiet = false }: deleteMultiFilesDTO = req.body;
    const result = await deleteMultiFilesS3({ Keys, Quiet });
    return successHandler({
      res,
      message: "Files deleted successfully",
    });
  };

  // ============================ updateBasicInfo ============================
  updateBasicInfo = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    const user = res.locals.user;
    const { firstName, lastName, age, gender, phone }: updateBasicInfoDTO =
      req.body;
    // step: update basic info
    const updatedUser = await this.userModel.findOneAndUpdate({
      filter: { _id: user._id },
      data: { $set: { firstName, lastName, age, gender, phone } },
    });
    if (!updatedUser) {
      return successHandler({
        res,
        message: "Error while update user",
        status: 500,
      });
    }
    return successHandler({ res, message: "User updated successfully" });
  };
}
