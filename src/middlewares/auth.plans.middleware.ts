import { NextFunction, Request, Response } from "express";
import { ApplicationException } from "../utils/Errors";
import { UserModel } from "../modules/user/user.model";
import { PricingPlanEnum } from "../types/user.module.types";

export const authPlans = (allowedPlans: string[], creditCost: number = 0) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;
    // step: make low plans allowed to top plans
    if (allowedPlans.includes(PricingPlanEnum.FREE)) {
      allowedPlans.push(PricingPlanEnum.BASIC);
      allowedPlans.push(PricingPlanEnum.PRO);
    }
    if (allowedPlans.includes(PricingPlanEnum.BASIC)) {
      allowedPlans.push(PricingPlanEnum.PRO);
    }
    // step: check user plan
    const userPricingPlan = user.pricingPlan;
    if (!allowedPlans.includes(userPricingPlan)) {
      throw new ApplicationException(
        "Please upgrade your plan to access this API",
        401
      );
    }
    // step: check credits cost
    const userAvaliableCredits = user.avaliableCredits;
    if (creditCost > userAvaliableCredits) {
      throw new ApplicationException(
        "Your credit not enough to access this API",
        400
      );
    }
    // step: calculate new credits
    const newAvaliableCredits = userAvaliableCredits - creditCost;
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: user._id },
      { $set: { avaliableCredits: newAvaliableCredits } }
    );
    next();
  };
};
