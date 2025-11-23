import { NextFunction, Request, Response } from "express";
import mongoose, { Types } from "mongoose";

export const Gender = {
  MALE: "male",
  FEMALE: "female",
};
export const Role = {
  ADMIN: "admin",
  USER: "user",
};
Object.freeze(Gender);
Object.freeze(Role);

export interface IUser {
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  phone: string;
  role: string;
  email: string;
  emailOtp: { otp: string; expiredAt: Date };
  newEmail: string;
  newEmailOtp: { otp: string; expiredAt: Date };
  emailConfirmed: Date;
  password: string;
  passwordOtp: { otp: string; expiredAt: Date };
  credentialsChangedAt: Date;
  isActive: boolean;
  deletedBy: mongoose.Schema.Types.ObjectId;
  profileImage: string;
  is2FAActive: boolean;
  otp2FA: { otp: string; expiredAt: Date };
}

export interface IUserServices {
  userProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response>;
  uploadProfileImage(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response>;
  getFile(req: Request, res: Response, next: NextFunction): Promise<void>;
  createPresignedUrlToGetFile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response>;
  deleteFile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response>;
  deleteMultiFiles(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response>;
  updateBasicInfo(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response>;
}
