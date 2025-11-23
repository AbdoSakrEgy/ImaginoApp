"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.check2FAOTPSchema = exports.activeDeactive2FASchema = exports.changePasswordSchema = exports.forgetPasswordSchema = exports.updatePasswordSchema = exports.resendEmailOtpSchema = exports.updateEmailSchema = exports.confirmEmailSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = __importDefault(require("zod"));
const user_module_types_1 = require("../../types/user.module.types");
exports.registerSchema = zod_1.default
    .object({
    firstName: zod_1.default.string().min(3).max(50),
    lastName: zod_1.default.string().min(3).max(50),
    age: zod_1.default.number().min(18).max(200).optional(),
    gender: zod_1.default.literal([user_module_types_1.Gender.male, user_module_types_1.Gender.female]).optional(),
    phone: zod_1.default.string().optional(),
    role: zod_1.default.literal([user_module_types_1.Role.admin, user_module_types_1.Role.customer, user_module_types_1.Role.seller]).optional(),
    email: zod_1.default.email(),
    password: zod_1.default.string(),
})
    .superRefine((args, ctx) => {
    if (args.phone) {
        const clean = args.phone.replace(/[\s-]/g, "");
        const phoneRegex = /^\+?[1-9]\d{7,14}$/;
        if (!phoneRegex.test(clean)) {
            ctx.addIssue({
                code: "custom",
                path: ["phone"],
                message: "Phone number is incorrect",
            });
        }
    }
    if (args.email) {
        if (args.email == "zzzzz@gmail.com") {
            ctx.addIssue({
                code: "custom",
                path: ["email"],
                message: "zzzzz@gmail.com not valid email to use :), test custom validation",
            });
        }
    }
});
exports.loginSchema = zod_1.default.object({
    email: zod_1.default.email(),
    password: zod_1.default.string(),
});
exports.confirmEmailSchema = zod_1.default.object({
    email: zod_1.default.email(),
    firstOtp: zod_1.default.string(),
    secondOtp: zod_1.default.string().optional(),
});
exports.updateEmailSchema = zod_1.default.object({
    newEmail: zod_1.default.email(),
});
exports.resendEmailOtpSchema = zod_1.default.object({
    email: zod_1.default.email(),
});
exports.updatePasswordSchema = zod_1.default.object({
    currentPassword: zod_1.default.string(),
    newPassword: zod_1.default.string(),
});
exports.forgetPasswordSchema = zod_1.default.object({
    email: zod_1.default.email(),
});
exports.changePasswordSchema = zod_1.default.object({
    email: zod_1.default.email(),
    otp: zod_1.default.string(),
    newPassword: zod_1.default.string(),
});
exports.activeDeactive2FASchema = zod_1.default.object({
    otp: zod_1.default.string().optional(),
});
exports.check2FAOTPSchema = zod_1.default.object({
    userId: zod_1.default.string(),
    otp: zod_1.default.string(),
});
