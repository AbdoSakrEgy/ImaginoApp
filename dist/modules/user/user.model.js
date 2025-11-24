"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const bcrypt_1 = require("../../utils/bcrypt");
const crypto_1 = require("../../utils/crypto");
const user_module_types_1 = require("../../types/user.module.types");
const userSchema = new mongoose_1.Schema({
    // personal info
    firstName: {
        type: String,
        trim: true,
        minlength: 3,
        maxlength: 20,
        required: true,
    },
    lastName: {
        type: String,
        trim: true,
        minlength: 3,
        maxlength: 20,
        required: true,
    },
    age: { type: Number, min: 18, max: 200 },
    gender: { type: String, enum: Object.values(user_module_types_1.Gender), default: user_module_types_1.Gender.MALE },
    phone: {
        type: String,
        trim: true,
        validate: {
            validator: (v) => /^\+?[1-9]\d{7,14}$/.test(v.replace(/[\s-]/g, "")),
            message: (props) => `${props.value} is not a valid phone number!`,
        },
        set: (value) => (value ? (0, crypto_1.encrypt)(value) : undefined),
        get: (value) => (value ? (0, crypto_1.decrypt)(value) : undefined),
    },
    role: { type: String, enum: Object.values(user_module_types_1.Role), default: user_module_types_1.Role.USER },
    // auth and OTP
    email: { type: String, required: true, unique: true },
    emailOtp: { otp: { type: String }, expiredAt: Date },
    newEmail: { type: String },
    newEmailOtp: { otp: { type: String }, expiredAt: Date },
    emailConfirmed: { type: Date },
    password: { type: String, min: 3, max: 20, required: true },
    passwordOtp: { otp: { type: String }, expiredAt: Date },
    credentialsChangedAt: Date,
    isActive: { type: Boolean, default: true },
    deletedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "user" },
    // others
    profileImage: { type: String },
    is2FAActive: { type: Boolean, default: false },
    otp2FA: { otp: { type: String }, expiredAt: Date },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });
// virtuals
userSchema.virtual("fullName").get(function () {
    return `${this.firstName} ${this.lastName}`;
});
userSchema.virtual("fullName").set(function (value) {
    const [firstName, lastName] = value.split(" ") || [];
    this.set({ firstName, lastName });
});
// hooks
// pre save
userSchema.pre("save", async function (next) {
    this.isFirstCreation = this.isNew;
    if (this.emailOtp && this.isModified("emailOtp")) {
        this.emailOtp = {
            otp: await (0, bcrypt_1.hash)(this.emailOtp?.otp),
            expiredAt: this.emailOtp?.expiredAt,
        };
    }
    if (this.newEmailOtp && this.isModified("newEmailOtp")) {
        this.newEmailOtp = {
            otp: await (0, bcrypt_1.hash)(this.newEmailOtp?.otp),
            expiredAt: this.newEmailOtp?.expiredAt,
        };
    }
    if (this.password && this.isModified("password")) {
        this.password = await (0, bcrypt_1.hash)(this.password);
    }
    if (this.passwordOtp && this.isModified("passwordOtp")) {
        this.passwordOtp = {
            otp: await (0, bcrypt_1.hash)(this.passwordOtp?.otp),
            expiredAt: this.passwordOtp?.expiredAt,
        };
    }
    if (this.otp2FA && this.isModified("otp2FA")) {
        this.otp2FA = {
            otp: await (0, bcrypt_1.hash)(this.otp2FA?.otp),
            expiredAt: this.otp2FA?.expiredAt,
        };
    }
});
userSchema.pre("findOneAndUpdate", async function () {
    const update = this.getUpdate();
    if (!update)
        return;
    const $set = update.$set || update;
    if ($set.emailOtp?.otp) {
        $set.emailOtp.otp = await (0, bcrypt_1.hash)($set.emailOtp.otp);
    }
    if ($set.newEmailOtp?.otp) {
        $set.newEmailOtp.otp = await (0, bcrypt_1.hash)($set.newEmailOtp.otp);
    }
    if ($set.password) {
        $set.password = await (0, bcrypt_1.hash)($set.password);
    }
    if ($set.passwordOtp?.otp) {
        $set.passwordOtp.otp = await (0, bcrypt_1.hash)($set.passwordOtp.otp);
    }
    if ($set.otp2FA?.otp) {
        $set.otp2FA.otp = await (0, bcrypt_1.hash)($set.otp2FA.otp);
    }
    if (!update.$set && $set !== update) {
        update.$set = $set;
    }
});
// model
exports.UserModel = (0, mongoose_1.model)("user", userSchema);
