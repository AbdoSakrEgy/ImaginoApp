"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserServices = void 0;
const user_model_1 = require("./user.model");
const successHandler_1 = require("../../utils/successHandler");
const Errors_1 = require("../../utils/Errors");
const user_module_types_1 = require("../../types/user.module.types");
const cloudinary_service_1 = require("../../utils/cloudinary/cloudinary.service");
const stripe_service_1 = require("../../utils/stripe/stripe.service");
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
        const uploadResult = await (0, cloudinary_service_1.uploadSingleFile)({
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
            await (0, cloudinary_service_1.destroySingleFile)({
                public_id: currentUser.profileImage.public_id,
            });
        }
        const updatedUser = await this.userModel.findOneAndUpdate({ _id: user._id }, { $unset: { profileImage: "" } }, { new: true });
        return (0, successHandler_1.successHandler)({
            res,
            message: "Profile image deleted successfully",
            result: { user: updatedUser },
        });
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
    // ============================ payWithStripe ============================
    payWithStripe = async (req, res, next) => {
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
                throw new Errors_1.ApplicationException("Invalid coupon", 400);
            }
        }
        // step: calculate plan price
        let costAmount = 0;
        if (plan == user_module_types_1.PricingPlanEnum.BASIC) {
            costAmount = 50;
        }
        if (plan == user_module_types_1.PricingPlanEnum.PRO) {
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
        const discounts = [];
        if (checkCoupon) {
            const coupon = await (0, stripe_service_1.createCoupon)({
                duration: "once",
                currency: "egp",
                percent_off: checkCoupon.offer,
            });
            discounts.push({ coupon: coupon.id });
        }
        // step: apply stripe services
        // createCheckoutSession
        const checkoutSession = await (0, stripe_service_1.createCheckoutSession)({
            customer_email: user.email,
            line_items,
            mode: "payment",
            discounts,
            metadata: { userId: user._id.toString(), plan },
        });
        // Store the checkout session ID for reference
        user.checkoutSessionId = checkoutSession.id;
        await user.save();
        return (0, successHandler_1.successHandler)({ res, result: { checkoutSession } });
    };
    // ============================ webHookWithStripe ============================
    webHookWithStripe = async (req, res, next) => {
        const { userId, plan } = req.body.data.object.metadata;
        // step: check order existence
        const user = await user_model_1.UserModel.findOneAndUpdate({ _id: userId }, {
            $set: {
                paymentIntentId: req.body.data.object.payment_intent,
                pricingPlan: plan,
                avaliableCredits: 200,
            },
        });
        if (!user)
            throw new Errors_1.ApplicationException("User not found", 404);
        return (0, successHandler_1.successHandler)({ res, message: "webHookWithStripe done" });
    };
}
exports.UserServices = UserServices;
