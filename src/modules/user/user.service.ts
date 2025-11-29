import { UserModel } from "./user.model";
import { successHandler } from "../../utils/successHandler";
import { NextFunction, Request, Response } from "express";
import { promisify } from "util";
import { pipeline } from "stream";
import { IUserServices } from "../../types/user.module.types";
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
    return successHandler({ res });
  };

  // ============================ getFile ============================
  getFile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    successHandler({ res });
  };

  // ============================ createPresignedUrlToGetFile ============================
  createPresignedUrlToGetFile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    return successHandler({ res });
  };

  // ============================ deleteFile ============================
  deleteFile = async (req: Request, res: Response, next: NextFunction) => {
    return successHandler({ res });
  };

  // ============================ deleteMultiFiles ============================
  deleteMultiFiles = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    return successHandler({ res });
  };

  // ============================ updateBasicInfo ============================
  updateBasicInfo = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response> => {
    return successHandler({ res });
  };
}
