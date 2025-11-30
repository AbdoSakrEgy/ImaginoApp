import { NextFunction, Request, Response } from "express";
import mongoose, { Types } from "mongoose";

export const GenderEnum = {
  MALE: "male",
  FEMALE: "female",
};
export const RoleEnum = {
  ADMIN: "admin",
  USER: "user",
};
export const PricingPlanEnum = {
  FREE: "free",
  BASIC: "basic",
  PRO: "pro",
};
Object.freeze(GenderEnum);
Object.freeze(RoleEnum);
Object.freeze(PricingPlanEnum);

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
  is2FAActive: boolean;
  otp2FA: { otp: string; expiredAt: Date };
  profileImage: { public_id: string; secure_url: string };
  checkoutSessionId: string;
  paymentIntentId: string;
  refundId: string;
  refundedAt: Date;
  pricingPlan: string;
  avaliableCredits: number;
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
  deleteProfileImage(
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
