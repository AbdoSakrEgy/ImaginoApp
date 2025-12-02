"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authPlans = void 0;
const Errors_1 = require("../utils/Errors");
const user_model_1 = require("../modules/user/user.model");
const user_module_types_1 = require("../types/user.module.types");
const authPlans = (allowedPlans, creditCost = 0) => {
    return async (req, res, next) => {
        const user = res.locals.user;
        // step: make low plans allowed to top plans
        if (allowedPlans.includes(user_module_types_1.PricingPlanEnum.FREE)) {
            allowedPlans.push(user_module_types_1.PricingPlanEnum.BASIC);
            allowedPlans.push(user_module_types_1.PricingPlanEnum.PRO);
        }
        if (allowedPlans.includes(user_module_types_1.PricingPlanEnum.BASIC)) {
            allowedPlans.push(user_module_types_1.PricingPlanEnum.PRO);
        }
        // step: check user plan
        const userPricingPlan = user.pricingPlan;
        if (!allowedPlans.includes(userPricingPlan)) {
            throw new Errors_1.ApplicationException("Please upgrade your plan to access this API", 401);
        }
        // step: check credits cost
        const userAvaliableCredits = user.avaliableCredits;
        if (creditCost > userAvaliableCredits) {
            throw new Errors_1.ApplicationException("Your credit not enough to access this API", 400);
        }
        // step: calculate new credits
        const newAvaliableCredits = userAvaliableCredits - creditCost;
        const updatedUser = await user_model_1.UserModel.findOneAndUpdate({ _id: user._id }, { $set: { avaliableCredits: newAvaliableCredits } });
        next();
    };
};
exports.authPlans = authPlans;
