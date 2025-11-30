import { UserModel } from "./user.model";
import { successHandler } from "../../utils/successHandler";
import { NextFunction, Request, Response } from "express";
import { ApplicationException } from "../../utils/Errors";
import { IUserServices } from "../../types/user.module.types";
import { destroySingleFile, uploadSingleFile } from "../../utils/multer/cloudinary.services";

export class UserServices implements IUserServices {
  private userModel = UserModel;

  constructor() {}
  // ============================ userProfile ============================
  userProfile = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    let user = res.locals.user;
    const userId = req.params?.userId;
    // step: if userId existence load that user
    if (userId) {
      const foundUser = await this.userModel.findById(userId);
      if (!foundUser) {
        throw new ApplicationException("User not found", 404);
      }
      user = foundUser;
    }
    return successHandler({ res, result: { user } });
  };

  // ============================ uploadProfileImage ============================
  uploadProfileImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const user = res.locals.user;
    const file = req.file;

    if (!file) {
      throw new ApplicationException("profileImage is required", 400);
    }

    const uploadResult = await uploadSingleFile({
      fileLocation: (file as any).path,
      storagePathOnCloudinary: `users/${user._id}/profile`,
    });

    const updatedUser = await this.userModel.findOneAndUpdate(
      { _id: user._id },
      { $set: { profileImage: uploadResult } },
      { new: true },
    );

    return successHandler({
      res,
      message: "Profile image updated successfully",
      result: { user: updatedUser },
    });
  };

  // ============================ deleteProfileImage ============================
  deleteProfileImage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const user = res.locals.user;

    const currentUser = await this.userModel.findById(user._id);
    if (currentUser?.profileImage?.public_id) {
      await destroySingleFile({ public_id: currentUser.profileImage.public_id });
    }

    const updatedUser = await this.userModel.findOneAndUpdate(
      { _id: user._id },
      { $unset: { profileImage: "" } },
      { new: true },
    );

    return successHandler({
      res,
      message: "Profile image deleted successfully",
      result: { user: updatedUser },
    });
  };

  // ============================ getFile ============================
  getFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    successHandler({ res });
  };

  // ============================ createPresignedUrlToGetFile ============================
  createPresignedUrlToGetFile = async (req: Request, res: Response, next: NextFunction) => {
    return successHandler({ res });
  };

  // ============================ deleteFile ============================
  deleteFile = async (req: Request, res: Response, next: NextFunction) => {
    return successHandler({ res });
  };

  // ============================ deleteMultiFiles ============================
  deleteMultiFiles = async (req: Request, res: Response, next: NextFunction) => {
    return successHandler({ res });
  };

  // ============================ updateBasicInfo ============================
  updateBasicInfo = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const user = res.locals.user;
    const { firstName, lastName, age, gender, phone } = req.body;

    const updatedUser = await this.userModel.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(age !== undefined && { age }),
          ...(gender && { gender }),
          ...(phone && { phone }),
        },
      },
      {
        new: true,
        runValidators: true,
        context: "query",
      },
    );

    return successHandler({
      res,
      message: "Basic info updated successfully",
      result: { user: updatedUser },
    });
  };
}
