import { UserModel } from "./user.model";
import { successHandler } from "../../utils/successHandler";
import { NextFunction, Request, Response } from "express";
import { ApplicationException } from "../../utils/Errors";
import { IUserServices, PricingPlanEnum } from "../../types/user.module.types";
import { destroySingleFile, uploadSingleFile } from "../../utils/cloudinary/cloudinary.service";
import Stripe from "stripe";
import { createCheckoutSession, createCoupon } from "../../utils/stripe/stripe.service";
import { ImageModel } from "../image/image.model";
import mongoose from "mongoose";

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
      await destroySingleFile({
        public_id: currentUser.profileImage.public_id,
      });
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

  // ============================ payWithStripe ============================
  payWithStripe = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const user = res.locals.user;
    const { plan, userCoupon } = req.body;
    // step: check coupon validation
    let checkCoupon = undefined;
    if (userCoupon) {
      const allowedCoupons = [
        { code: "ADF-DFA-31-DA", offer: 15 },
        { code: "JMY-GHR-65-CS", offer: 30 },
      ];
      checkCoupon = allowedCoupons.filter((item) => item.code == userCoupon)[0];
      if (!checkCoupon) {
        throw new ApplicationException("Invalid coupon", 400);
      }
    }
    // step: calculate plan price
    let costAmount = 0;
    if (plan == PricingPlanEnum.BASIC) {
      costAmount = 50;
    }
    if (plan == PricingPlanEnum.PRO) {
      costAmount = 100;
    }
    // step: collect createCheckoutSession data
    const line_items = [
      {
        price_data: {
          currency: "egp",
          product_data: {
            name: `${user.firstName} will subscripe to ${plan} plan`,
            description: "plan description",
          },
          unit_amount: costAmount * 100,
        },
        quantity: 1,
      },
    ];
    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
    if (checkCoupon) {
      const coupon = await createCoupon({
        duration: "once",
        currency: "egp",
        percent_off: checkCoupon.offer,
      });
      discounts.push({ coupon: coupon.id });
    }
    // step: apply stripe services
    // createCheckoutSession
    const checkoutSession = await createCheckoutSession({
      customer_email: user.email,
      line_items,
      mode: "payment",
      discounts,
      metadata: { userId: user._id.toString(), plan },
    });
    // Store the checkout session ID for reference
    user.checkoutSessionId = checkoutSession.id;
    await user.save();
    return successHandler({ res, result: { checkoutSession } });
  };

  // ============================ webHookWithStripe ============================
  webHookWithStripe = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response> => {
    const { userId, plan } = req.body.data.object.metadata;
    // step: check order existence
    const user = await UserModel.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          paymentIntentId: req.body.data.object.payment_intent,
          pricingPlan: plan,
          avaliableCredits: 200,
        },
      },
    );
    if (!user) throw new ApplicationException("User not found", 404);
    return successHandler({ res, message: "webHookWithStripe done" });
  };

  // ============================ getUserImages ============================
  getUserImages = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
    const userId = res.locals.user?._id?.toString();
    if (!userId) throw new ApplicationException("User not authenticated", 401);

    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const size = Math.max(Math.min(parseInt((req.query.size as string) || "20", 10), 100), 1);

    const filter = { user: new mongoose.Types.ObjectId(userId), deletedAt: null } as const;

    const [totalCount, images] = await Promise.all([
      ImageModel.countDocuments(filter),
      ImageModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * size)
        .limit(size),
    ]);

    return successHandler({
      res,
      message: "User images fetched successfully",
      result: {
        items: images.map((image) => ({
          _id: image._id,
          url: image.url,
          storageKey: image.storageKey,
          filename: image.filename,
          mimeType: image.mimeType,
          size: image.size,
          dimensions: image.dimensions,
          status: image.status,
          isPublic: image.isPublic,
          aiEdits: image.aiEdits,
        })),
        page,
        size,
        totalCount,
        totalPages: Math.ceil(totalCount / size),
      },
    });
  };
}
